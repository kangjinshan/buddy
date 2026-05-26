import { describe, expect, it } from 'vitest'
import { buildActorPrompt } from '../../../src/main/buddy/prompts'

describe('buildActorPrompt', () => {
  it('includes task, context, actor, round, and repo root', () => {
    const prompt = buildActorPrompt({
      actor: 'claude',
      round: 1,
      repoRoot: '/tmp/repo',
      taskText: 'Build feature',
      contextText: 'Use tests',
      transcript: []
    })

    expect(prompt).toContain('claude')
    expect(prompt).toContain('/tmp/repo')
    expect(prompt).toContain('Build feature')
    expect(prompt).toContain('Use tests')
  })
})
