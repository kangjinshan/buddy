import { describe, expect, it, vi } from 'vitest'
import { BuddyEventBus } from '../../../src/main/buddy/events'

describe('BuddyEventBus', () => {
  it('publishes task event envelopes to subscribers', () => {
    const bus = new BuddyEventBus()
    const callback = vi.fn()
    const unsubscribe = bus.subscribe(callback)

    bus.publish({
      workspace_key: 'abc123def456',
      task_id: 'demo',
      event: {
        seq: 1,
        type: 'task.updated',
        ts: '2026-05-26T00:00:00.000Z',
        payload: {}
      }
    })

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ task_id: 'demo' }))

    unsubscribe()
    bus.publish({
      workspace_key: 'abc123def456',
      task_id: 'demo',
      event: {
        seq: 2,
        type: 'task.updated',
        ts: '2026-05-26T00:00:01.000Z',
        payload: {}
      }
    })

    expect(callback).toHaveBeenCalledTimes(1)
  })
})
