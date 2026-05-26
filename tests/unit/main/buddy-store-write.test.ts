import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BuddyStore } from '../../../src/main/buddy/store'

describe('BuddyStore writes', () => {
  it('creates a task with state, settings, transcript, metadata, and initial event', async () => {
    const root = await mkdtemp(join(tmpdir(), 'buddy-write-'))
    const store = new BuddyStore(root)

    const result = await store.createTask({
      task_id: 'demo',
      repo_root: '/tmp/repo',
      task_text: 'Build it',
      context_text: 'Use tests'
    })

    const taskDir = join(root, 'workspaces', result.workspace_key, 'tasks', 'demo')
    await expect(readFile(join(taskDir, 'state.json'), 'utf8')).resolves.toContain('"status":"READY"')
    await expect(readFile(join(taskDir, 'settings.json'), 'utf8')).resolves.toContain('"protocol_version":"1"')
    await expect(readFile(join(taskDir, 'task.json'), 'utf8')).resolves.toContain('"task_text":"Build it"')
    await expect(readFile(join(taskDir, 'transcript.md'), 'utf8')).resolves.toContain('Build it')
    await expect(readFile(join(taskDir, 'events.jsonl'), 'utf8')).resolves.toContain('"task.created"')
  })
})
