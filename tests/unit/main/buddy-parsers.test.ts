import { describe, expect, it } from 'vitest'
import {
  parseBuddyMessage,
  parseClaudeStreamLine,
  parseCodexJsonLine
} from '../../../src/main/buddy/parsers'

describe('buddy actor parsers', () => {
  it('extracts text from Claude stream-json content blocks', () => {
    const event = parseClaudeStreamLine(JSON.stringify({
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'hello' }]
      },
      session_id: 'claude-session'
    }))

    expect(event).toMatchObject({
      text: 'hello',
      sessionId: 'claude-session'
    })
  })

  it('extracts text from Codex json lines', () => {
    const event = parseCodexJsonLine(JSON.stringify({
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'done' }],
      thread_id: 'codex-thread'
    }))

    expect(event).toMatchObject({
      text: 'done',
      threadId: 'codex-thread'
    })
  })

  it('detects break messages', () => {
    expect(parseBuddyMessage('type=break\nreason=done')).toMatchObject({
      kind: 'break',
      reason: 'done'
    })
  })
})
