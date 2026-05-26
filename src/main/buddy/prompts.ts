import type { TranscriptEntry } from '../../shared/types'

export interface BuildActorPromptInput {
  actor: string
  round: number
  repoRoot: string
  taskText: string
  contextText: string
  transcript: TranscriptEntry[]
}

export function buildActorPrompt(input: BuildActorPromptInput): string {
  return [
    `You are ${input.actor} in a Buddy engineering loop.`,
    `Round: ${input.round}`,
    `Repository: ${input.repoRoot}`,
    '',
    'Task:',
    input.taskText || '(empty)',
    '',
    'Context:',
    input.contextText || '(empty)',
    '',
    'Previous transcript:',
    input.transcript.map((entry) => `${entry.role}: ${entry.content}`).join('\n') || '(none)',
    '',
    'Respond using the Buddy Message Protocol.'
  ].join('\n')
}
