import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BuddyRunner } from '../../../src/main/buddy/runner'
import { BuddyStore } from '../../../src/main/buddy/store'

describe('BuddyRunner state transitions', () => {
  it('moves READY task to RUNNING actor state when launchers are deferred', async () => {
    const root = await mkdtemp(join(tmpdir(), 'buddy-runner-'))
    const store = new BuddyStore(root)
    const created = await store.createTask({ task_id: 'demo', repo_root: '/tmp/repo' })
    const runner = new BuddyRunner(store, { executeLaunchers: false })

    const result = await runner.startTask('demo', {
      workspace_key: created.workspace_key,
      actor: 'claude'
    })

    const detail = await store.getTaskDetail('demo', created.workspace_key)

    expect(result.run_id).toMatch(/^run_/)
    expect(detail.state.status).toBe('RUNNING_CLAUDE')
    expect(detail.state.active_run?.actor).toBe('claude')
  })
})
