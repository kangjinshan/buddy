export interface ParsedActorLine {
  text?: string
  sessionId?: string
  threadId?: string
  rawType?: string
}

export type BuddyMessage =
  | { kind: 'break'; reason?: string }
  | { kind: 'message'; text: string }

export function parseClaudeStreamLine(line: string): ParsedActorLine {
  const json = JSON.parse(line)
  const text = Array.isArray(json.message?.content)
    ? json.message.content
        .filter((part: { type?: string; text?: string }) => part.type === 'text' && part.text)
        .map((part: { text: string }) => part.text)
        .join('')
    : undefined

  return {
    text,
    sessionId: json.session_id,
    rawType: json.type
  }
}

export function parseCodexJsonLine(line: string): ParsedActorLine {
  const json = JSON.parse(line)
  const text = Array.isArray(json.content)
    ? json.content
        .filter((part: { text?: string }) => part.text)
        .map((part: { text: string }) => part.text)
        .join('')
    : json.message

  return {
    text,
    threadId: json.thread_id,
    rawType: json.type
  }
}

export function parseActorLine(actor: string, line: string): ParsedActorLine {
  if (actor === 'claude') return parseClaudeStreamLine(line)
  if (actor === 'codex') return parseCodexJsonLine(line)
  return parseCodexJsonLine(line)
}

export function parseBuddyMessage(text: string): BuddyMessage {
  const trimmed = text.trim()
  const fields = new Map<string, string>()
  for (const line of trimmed.split(/\r?\n/)) {
    const index = line.indexOf('=')
    if (index !== -1) fields.set(line.slice(0, index), line.slice(index + 1))
  }

  if (fields.get('type') === 'break') {
    return { kind: 'break', reason: fields.get('reason') }
  }

  return { kind: 'message', text }
}
