import { describe, expect, it } from 'vitest'
import { buildLauncherCommand } from '../../../src/main/buddy/launchers'

describe('launcher command builder', () => {
  it('builds Claude non-interactive stream-json command', () => {
    expect(buildLauncherCommand({
      actor: 'claude',
      command: 'claude',
      promptFile: '/tmp/prompt.md'
    })).toEqual({
      command: 'claude',
      args: ['-p', '--output-format', 'stream-json', '--verbose', '--input-format', 'text']
    })
  })

  it('builds Codex json command', () => {
    expect(buildLauncherCommand({
      actor: 'codex',
      command: 'codex',
      promptFile: '/tmp/prompt.md'
    }).args).toContain('--json')
  })
})
