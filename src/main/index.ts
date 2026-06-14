// Must be set before electron-updater is imported (via updater.ts)
process.env.ELECTRON_UPDATER_ALLOW_HTTP = '1'

import { app, BrowserWindow, ipcMain, dialog, shell, clipboard } from 'electron'
import { WindowManager } from './window-manager'
import { registerBuddyHandlers } from './ipc/buddy-handlers'
import { BuddyCoreService } from './buddy/service'
import { BuddyEventBus } from './buddy/events'
import { fixShellPath } from './buddy/shell-path'
import { setupMenu, updateMenuLanguage } from './menu'
import { initUpdater, checkForUpdates, downloadUpdate, quitAndInstall, setUpdaterWindow } from './updater'
import { mkdir, writeFile, stat, readFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

fixShellPath()

async function statClipboardPaths(paths: string[]): Promise<Array<{ path: string; size: number }>> {
  const unique = [...new Set(paths.filter(Boolean))]
  const results: Array<{ path: string; size: number }> = []
  for (const candidate of unique) {
    try {
      const resolved = await realpath(candidate)
      const s = await stat(resolved)
      results.push({ path: resolved, size: s.size })
    } catch {
      try {
        const s = await stat(candidate)
        results.push({ path: candidate, size: s.size })
      } catch {
        // Ignore inaccessible clipboard entries.
      }
    }
  }
  return results
}

function decodeClipboardFileUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed.startsWith('file://')) return null
  try {
    const url = new URL(trimmed)
    let path = decodeURIComponent(url.pathname)
    if (process.platform === 'win32') {
      if (/^\/[A-Za-z]:\//.test(path)) path = path.slice(1)
      return path.replace(/\//g, '\\')
    }
    return path
  } catch {
    return null
  }
}

function parseWindowsClipboardFileNameW(buffer: Buffer): string[] {
  const text = buffer.toString('utf16le').replace(/\u0000+$/, '')
  return text
    .split('\u0000')
    .map((part) => part.trim())
    .filter((part) => /^[A-Za-z]:\\/.test(part) || part.startsWith('\\\\'))
}

async function readMacClipboardFilePaths(): Promise<string[]> {
  const paths: string[] = []

  // Prefer NSFilenamesPboardType which contains real POSIX paths
  if (clipboard.has('NSFilenamesPboardType')) {
    const buffer = clipboard.readBuffer('NSFilenamesPboardType')
    const text = buffer.toString('utf8')

    // Try XML plist format first
    if (text.includes('<string>')) {
      const matches = text.match(/<string>([^<]+)<\/string>/g)
      if (matches) {
        for (const m of matches) {
          const p = m.replace(/<\/?string>/g, '').trim()
          if (p.startsWith('/')) paths.push(p)
        }
      }
    }

    // Binary plist fallback: extract null-separated path strings
    if (paths.length === 0 && buffer.length > 0) {
      const raw = buffer.toString('utf8')
      const parts = raw.split(/\0|\n/)
      for (const part of parts) {
        const p = part.trim()
        if (p.startsWith('/') && !p.includes('�')) {
          paths.push(p)
        }
      }
    }
  }

  // Fallback to file URLs
  if (paths.length === 0 && clipboard.has('public.file-url')) {
    const buffer = clipboard.readBuffer('public.file-url')
    const text = buffer.toString('utf8')
    for (const value of text.split('\0')) {
      const decoded = decodeClipboardFileUrl(value)
      if (decoded) paths.push(decoded)
    }
  }

  return paths
}

async function readGenericClipboardFilePaths(): Promise<string[]> {
  const paths: string[] = []
  const formats = clipboard.availableFormats()

  if (process.platform === 'win32' && formats.includes('FileNameW')) {
    const raw = clipboard.readBuffer('FileNameW')
    if (raw.length > 0) {
      paths.push(...parseWindowsClipboardFileNameW(raw))
    }
  }

  const uriList = clipboard.read('text/uri-list')
  if (typeof uriList === 'string' && uriList.trim()) {
    for (const line of uriList.split(/\r?\n/)) {
      const decoded = decodeClipboardFileUrl(line)
      if (decoded) paths.push(decoded)
    }
  }

  const text = clipboard.readText()
  if (text.trim()) {
    for (const line of text.split(/\r?\n/)) {
      const value = line.trim()
      if (!value) continue
      const decoded = decodeClipboardFileUrl(value)
      if (decoded) {
        paths.push(decoded)
        continue
      }
      if (process.platform === 'win32') {
        if (/^[A-Za-z]:\\/.test(value) || value.startsWith('\\\\')) paths.push(value)
      } else if (value.startsWith('/')) {
        paths.push(value)
      }
    }
  }

  return paths
}

const windowManager = new WindowManager()
const buddyEvents = new BuddyEventBus()
const buddyService = new BuddyCoreService({ events: buddyEvents })

app.setName('Buddy')

registerBuddyHandlers(ipcMain, buddyService)
buddyEvents.subscribe((event) => {
  windowManager.getMainWindow()?.webContents.send('buddy:event', event)
})

app.whenReady().then(async () => {
  await buddyService.recoverInterruptedRuns()
  windowManager.createWindow()
  const mainWindow = windowManager.getMainWindow()
  if (mainWindow) {
    setupMenu(mainWindow)
    initUpdater(mainWindow)
  }

  ipcMain.handle('updater:check', () => {
    checkForUpdates()
  })

  ipcMain.handle('updater:download', () => {
    downloadUpdate()
  })

  ipcMain.handle('updater:install', () => {
    quitAndInstall()
  })

  ipcMain.handle('dialog:selectDirectory', async (_event, defaultPath?: string) => {
    const win = windowManager.getMainWindow()
    const dialogOptions: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath
    }
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('window:isFullScreen', () => {
    return windowManager.getMainWindow()?.isFullScreen() ?? false
  })

  ipcMain.on('menu:updateLanguage', (_event, lang: string) => {
    updateMenuLanguage(lang)
  })

  ipcMain.handle('shell:openInFinder', async (_event, path: string) => {
    try {
      const pathStat = await stat(path)
      if (pathStat.isFile()) {
        shell.showItemInFolder(path)
        return
      }
    } catch {
      // Fall through to openPath.
    }
    await shell.openPath(path)
  })

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('clipboard:readFilePaths', async () => {
    try {
      const rawPaths =
        process.platform === 'darwin'
          ? await readMacClipboardFilePaths()
          : await readGenericClipboardFilePaths()
      return statClipboardPaths(rawPaths)
    } catch {
      return []
    }
  })

  ipcMain.handle('attachment:saveBuffer', async (_event, taskId: string, workspaceKey: string, name: string, bufferBase64: string) => {
    const taskDirPath = buddyService.getStore().taskDirectory(taskId, workspaceKey)
    const artifactsDir = join(taskDirPath, 'attachments')
    await mkdir(artifactsDir, { recursive: true })
    const ext = name.includes('.') ? '.' + name.split('.').pop() : ''
    const filename = `${randomUUID()}${ext}`
    const filePath = join(artifactsDir, filename)
    await writeFile(filePath, Buffer.from(bufferBase64, 'base64'))
    return filePath
  })

  ipcMain.handle('attachment:readFileAsDataURL', async (_event, filePath: string, mimeType: string) => {
    const buffer = await readFile(filePath)
    const base64 = buffer.toString('base64')
    return `data:${mimeType};base64,${base64}`
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createWindow()
      const mainWindow = windowManager.getMainWindow()
      if (mainWindow) {
        setupMenu(mainWindow)
        setUpdaterWindow(mainWindow)
      }
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
