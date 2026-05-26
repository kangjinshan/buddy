import { spawn } from 'node:child_process'
import { once } from 'node:events'

export interface LauncherCommandInput {
  actor: string
  command: string
  promptFile: string
  sessionId?: string
}

export interface LauncherCommand {
  command: string
  args: string[]
}

export function buildLauncherCommand(input: LauncherCommandInput): LauncherCommand {
  if (input.actor === 'claude') {
    return {
      command: input.command,
      args: [
        '-p',
        '--output-format',
        'stream-json',
        '--verbose',
        '--input-format',
        'text',
        ...(input.sessionId ? ['--resume', input.sessionId] : [])
      ]
    }
  }

  if (input.actor === 'codex') {
    return {
      command: input.command,
      args: ['--json', ...(input.sessionId ? ['resume', input.sessionId] : [])]
    }
  }

  return {
    command: input.command,
    args: []
  }
}

export async function runLauncher(input: {
  command: string
  args: string[]
  cwd: string
  env?: Record<string, string>
  stdinText?: string
  timeoutMs: number
  onStdout(line: string): void
  onStderr(line: string): void
}): Promise<{ exitCode: number | null }> {
  const [command, ...prefixArgs] = splitCommand(input.command)
  const child = spawn(command, [...prefixArgs, ...input.args], {
    cwd: input.cwd,
    env: { ...process.env, ...input.env },
    stdio: ['pipe', 'pipe', 'pipe']
  })

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    for (const line of chunk.split(/\r?\n/).filter(Boolean)) input.onStdout(line)
  })
  child.stderr.on('data', (chunk: string) => {
    for (const line of chunk.split(/\r?\n/).filter(Boolean)) input.onStderr(line)
  })

  child.stdin.end(input.stdinText ?? '')

  const timeout = setTimeout(() => child.kill('SIGTERM'), input.timeoutMs)
  const [exitCode] = await once(child, 'exit') as [number | null]
  clearTimeout(timeout)
  return { exitCode }
}

function splitCommand(command: string): string[] {
  const matches = command.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [command]
  return matches.map((part) => part.replace(/^"|"$/g, ''))
}
