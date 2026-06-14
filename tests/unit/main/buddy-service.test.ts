import { mkdtemp } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, win32 } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BuddyCoreService, resolveDefaultDataRoot } from '../../../src/main/buddy/service'

describe('BuddyCoreService', () => {
  it('reports native health without HTTP', async () => {
    const service = new BuddyCoreService()

    await expect(service.checkHealth()).resolves.toBe(true)
  })

  it('uses the Buddy Application Support directory by default', async () => {
    const service = new BuddyCoreService()

    await expect(service.bootstrap()).resolves.toMatchObject({
      data_root: join(homedir(), 'Library', 'Application Support', 'buddy')
    })
  })

  it('resolves Windows default data root under appData', () => {
    const root = resolveDefaultDataRoot('win32', 'C:\\Users\\demo\\AppData\\Roaming')
    expect(root).toBe(win32.join('C:\\Users\\demo\\AppData\\Roaming', 'buddy'))
  })

  it('returns bootstrap with native global CLI settings', async () => {
    const root = await mkdtemp(join(tmpdir(), 'buddy-service-bootstrap-'))
    const service = new BuddyCoreService(root)

    await expect(service.bootstrap()).resolves.toMatchObject({
      version: 'native',
      tasks: [],
      global_settings: {
        launchers: {
          claude: { command: 'claude' },
          codex: { command: 'codex' }
        }
      }
    })
  })
})
