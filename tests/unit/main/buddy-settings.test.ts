import { access, mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BuddyStore } from '../../../src/main/buddy/store'

describe('BuddyStore settings and delete', () => {
  it('updates global settings', async () => {
    const root = await mkdtemp(join(tmpdir(), 'buddy-settings-'))
    const store = new BuddyStore(root)

    await store.updateGlobalSettings({ countdown_seconds: 45 })

    await expect(readFile(join(root, 'global', 'settings.json'), 'utf8')).resolves.toContain('"countdown_seconds":45')
  })

  it('deletes task directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'buddy-delete-'))
    const store = new BuddyStore(root)
    const created = await store.createTask({ task_id: 'demo', repo_root: '/tmp/repo' })

    await store.deleteTask('demo', created.workspace_key)

    await expect(access(created.path)).rejects.toThrow()
  })
})
