import type { BrowserWindowConstructorOptions } from 'electron'

export function createMainWindowOptions(
  preloadPath: string,
  platform: NodeJS.Platform = process.platform
): BrowserWindowConstructorOptions {
  const base: BrowserWindowConstructorOptions = {
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: preloadPath,
      sandbox: false
    }
  }

  if (platform === 'darwin') {
    return {
      ...base,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 19 }
    }
  }

  return {
    ...base,
    titleBarStyle: 'hidden',
    titleBarOverlay: false
  }
}
