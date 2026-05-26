import { describe, expect, it } from 'vitest'
import { parseEventLine, parseTaskState } from '../../../src/main/buddy/schemas'

describe('buddy schemas', () => {
  it('parses task state with optional fields', () => {
    const state = parseTaskState({
      status: 'READY',
      round: 1,
      next_actor: 'claude',
      active_run: null
    })

    expect(state.status).toBe('READY')
    expect(state.round).toBe(1)
  })

  it('parses event json lines', () => {
    const event = parseEventLine('{"seq":1,"type":"task.created","ts":"2026-05-26T00:00:00.000Z","payload":{}}')

    expect(event.seq).toBe(1)
    expect(event.type).toBe('task.created')
  })

  it('rejects malformed event json lines', () => {
    expect(() => parseEventLine('{bad')).toThrow()
  })
})
