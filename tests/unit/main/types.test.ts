import { describe, expect, it } from 'vitest'
import type { BuddyError, TaskEventEnvelope } from '../../../src/shared/types'

describe('native buddy shared types', () => {
  it('supports structured IPC errors', () => {
    const error: BuddyError = {
      code: 'TASK_NOT_FOUND',
      message: 'Task not found',
      recoverable: false,
      details: { task_id: 'missing' }
    }

    expect(error.code).toBe('TASK_NOT_FOUND')
    expect(error.recoverable).toBe(false)
  })

  it('supports task event envelopes for live IPC updates', () => {
    const envelope: TaskEventEnvelope = {
      workspace_key: 'abc123def456',
      task_id: 'demo',
      event: {
        seq: 1,
        type: 'task.updated',
        ts: '2026-05-26T00:00:00.000Z',
        payload: { status: 'READY' }
      }
    }

    expect(envelope.event.type).toBe('task.updated')
  })
})
