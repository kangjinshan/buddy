import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  CountdownInput,
  SendMessageInput,
  StartTaskInput,
  TaskState
} from '../../shared/types'
import { buildLauncherCommand, runLauncher } from './launchers'
import { createRunLock, removeRunLock } from './locks'
import { parseActorLine, parseBuddyMessage, ParsedActorLine } from './parsers'
import { buildActorPrompt } from './prompts'
import { BuddyStore } from './store'

const ACTOR_STATUS: Record<string, TaskState['status']> = {
  claude: 'RUNNING_CLAUDE',
  codex: 'RUNNING_CODEX',
  opencode: 'RUNNING_OPENCODE',
  kimi: 'RUNNING_KIMI'
}

interface RunnerOptions {
  executeLaunchers?: boolean
}

export class BuddyRunner {
  private readonly executeLaunchers: boolean

  constructor(
    private readonly store: BuddyStore,
    options: RunnerOptions = {}
  ) {
    this.executeLaunchers = options.executeLaunchers ?? true
  }

  async startTask(taskId: string, input: StartTaskInput): Promise<{ run_id: string }> {
    if (!input.workspace_key) throw new Error('workspace_key is required')
    const workspaceKey = input.workspace_key
    const detail = await this.store.getTaskDetail(taskId, workspaceKey)
    const actor = input.actor ?? detail.state.next_actor ?? 'claude'
    const status = ACTOR_STATUS[actor]
    if (!status) throw new Error(`Unsupported actor: ${actor}`)
    const runId = `run_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
    const startedAt = new Date().toISOString()

    await this.store.updateTaskState(taskId, workspaceKey, (state) => {
      if (state.status !== 'READY' && state.status !== 'PAUSED') {
        throw new Error(`Cannot start task from ${state.status}`)
      }
      return {
        ...state,
        status,
        active_run: { actor, started_at: startedAt },
        updated_at: startedAt
      }
    })
    await this.store.appendTaskEvent(taskId, workspaceKey, {
      type: 'actor.started',
      actor,
      payload: { run_id: runId }
    })

    if (!this.executeLaunchers) {
      return { run_id: runId }
    }

    await this.executeActor(taskId, workspaceKey, actor, runId)
    return { run_id: runId }
  }

  async sendMessage(taskId: string, input: SendMessageInput): Promise<void> {
    if (!input.workspace_key) throw new Error('workspace_key is required')
    await this.store.appendTranscript(
      taskId,
      input.workspace_key,
      `\n\n## Human\n\n${input.message ?? ''}\n`
    )
    await this.store.appendTaskEvent(taskId, input.workspace_key, {
      type: 'message.added',
      actor: input.actor,
      payload: { message: input.message ?? '' }
    })
  }

  async pauseCountdown(taskId: string, input: CountdownInput): Promise<void> {
    if (!input.workspace_key) throw new Error('workspace_key is required')
    await this.store.updateTaskState(taskId, input.workspace_key, (state) => {
      if (state.status !== 'COUNTDOWN' || state.countdown?.status !== 'running') {
        throw new Error('No running countdown to pause')
      }
      return {
        ...state,
        status: 'READY',
        countdown: { ...state.countdown, status: 'paused' },
        updated_at: new Date().toISOString()
      }
    })
    await this.store.appendTaskEvent(taskId, input.workspace_key, {
      type: 'countdown.paused',
      payload: {}
    })
  }

  async skipCountdown(taskId: string, input: CountdownInput): Promise<{ run_id: string }> {
    if (!input.workspace_key) throw new Error('workspace_key is required')
    const detail = await this.store.getTaskDetail(taskId, input.workspace_key)
    const actor = input.next_actor ?? detail.state.countdown?.default_next_actor
    if (!actor) throw new Error('next actor is required')
    await this.store.updateTaskState(taskId, input.workspace_key, (state) => ({
      ...state,
      status: 'READY',
      countdown: state.countdown ? { ...state.countdown, status: 'skipped' } : undefined,
      updated_at: new Date().toISOString()
    }))
    await this.store.appendTaskEvent(taskId, input.workspace_key, {
      type: 'countdown.skipped',
      payload: { next_actor: actor }
    })
    return this.startTask(taskId, { workspace_key: input.workspace_key, actor })
  }

  async interrupt(taskId: string, workspaceKey: string): Promise<void> {
    await this.store.updateTaskState(taskId, workspaceKey, (state) => ({
      ...state,
      status: 'PAUSED',
      active_run: null,
      updated_at: new Date().toISOString()
    }))
    await this.store.appendTaskEvent(taskId, workspaceKey, {
      type: 'actor.interrupted',
      payload: {}
    })
  }

  private async executeActor(taskId: string, workspaceKey: string, actor: string, runId: string): Promise<void> {
    const detail = await this.store.getTaskDetail(taskId, workspaceKey)
    const launcher = detail.settings.launchers[actor] ?? {
      command: actor,
      env: {},
      timeout_seconds: 600
    }
    const taskDirectory = this.store.taskDirectory(taskId, workspaceKey)
    const artifactsDir = join(taskDirectory, 'artifacts')
    await mkdir(artifactsDir, { recursive: true })
    const prompt = buildActorPrompt({
      actor,
      round: detail.state.round,
      repoRoot: detail.state.repo_root ?? '',
      taskText: detail.task_text,
      contextText: detail.context_text,
      transcript: detail.transcript
    })
    const promptFile = join(artifactsDir, `${runId}-prompt.md`)
    await writeFile(promptFile, prompt)
    const command = buildLauncherCommand({
      actor,
      command: launcher.command,
      promptFile,
      sessionId: sessionIdForActor(actor, detail.state)
    })
    const outputLines: string[] = []
    const stderrLines: string[] = []
    const parsedLines: ParsedActorLine[] = []
    const lockPath = await createRunLock(this.store.dataRoot, {
      workspace_key: workspaceKey,
      task_id: taskId,
      run_id: runId,
      pid: process.pid
    })

    try {
      const result = await runLauncher({
        command: command.command,
        args: command.args,
        cwd: await existingCwd(detail.state.repo_root),
        env: launcher.env,
        stdinText: prompt,
        timeoutMs: launcher.timeout_seconds * 1000,
        onStdout: (line) => {
          outputLines.push(line)
          try {
            const parsed = parseActorLine(actor, line)
            parsedLines.push(parsed)
          } catch {
            parsedLines.push({ text: line })
          }
        },
        onStderr: (line) => stderrLines.push(line)
      })

      await writeFile(join(artifactsDir, `${runId}-output.md`), outputLines.join('\n'))

      if (result.exitCode !== 0) {
        throw new Error(stderrLines.join('\n') || `Actor exited with ${result.exitCode}`)
      }

      await this.completeActor(taskId, workspaceKey, actor, runId, parsedLines)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const failureMessage = stderrLines.join('\n') || message
      await this.markFailed(taskId, workspaceKey, actor, failureMessage)
      throw error
    } finally {
      await removeRunLock(lockPath)
    }
  }

  private async completeActor(
    taskId: string,
    workspaceKey: string,
    actor: string,
    runId: string,
    parsedLines: ParsedActorLine[]
  ): Promise<void> {
    const text = parsedLines.map((line) => line.text).filter(Boolean).join('\n')
    const sessionId = lastValue(parsedLines.map((line) => line.sessionId))
    const threadId = lastValue(parsedLines.map((line) => line.threadId))
    const message = parseBuddyMessage(text)
    const detail = await this.store.getTaskDetail(taskId, workspaceKey)
    const nextActor = actor === 'claude' ? 'codex' : 'claude'
    const now = new Date().toISOString()

    await this.store.appendTranscript(taskId, workspaceKey, `\n\n## ${actor}\n\n${text}\n`)
    await this.store.appendTaskEvent(taskId, workspaceKey, {
      type: 'actor.completed',
      actor,
      payload: { run_id: runId, text }
    })

    await this.store.updateTaskState(taskId, workspaceKey, (state) => {
      const next: TaskState = {
        ...state,
        active_run: null,
        updated_at: now
      }
      if (actor === 'claude' && sessionId) next.claude_session_id = sessionId
      if (actor === 'codex' && threadId) next.codex_thread_id = threadId

      if (message.kind === 'break') {
        if (detail.state.pending_break?.actor && detail.state.pending_break.actor !== actor) {
          return {
            ...next,
            status: 'DONE',
            countdown: undefined,
            pending_break: null
          }
        }
        return {
          ...next,
          status: 'COUNTDOWN',
          next_actor: nextActor,
          pending_break: { actor },
          countdown: {
            status: 'running',
            remaining: detail.settings.countdown_seconds,
            default_next_actor: nextActor,
            deadline: new Date(Date.now() + detail.settings.countdown_seconds * 1000).toISOString()
          }
        }
      }

      return {
        ...next,
        status: 'COUNTDOWN',
        next_actor: nextActor,
        countdown: {
          status: 'running',
          remaining: detail.settings.countdown_seconds,
          default_next_actor: nextActor,
          deadline: new Date(Date.now() + detail.settings.countdown_seconds * 1000).toISOString()
        }
      }
    })
  }

  private async markFailed(taskId: string, workspaceKey: string, actor: string, message: string): Promise<void> {
    const failure = {
      message,
      actor,
      ts: new Date().toISOString()
    }
    await this.store.updateTaskState(taskId, workspaceKey, (state) => ({
      ...state,
      status: 'FAILED',
      active_run: null,
      latest_failure: failure,
      updated_at: failure.ts
    }))
    await this.store.appendTaskEvent(taskId, workspaceKey, {
      type: 'actor.failed',
      actor,
      payload: { error: message }
    })
  }
}

function sessionIdForActor(actor: string, state: TaskState): string | undefined {
  if (actor === 'claude') return state.claude_session_id
  if (actor === 'codex') return state.codex_thread_id
  if (actor === 'opencode') return state.opencode_session_id
  if (actor === 'kimi') return state.kimi_session_id
  return undefined
}

function lastValue(values: Array<string | undefined>): string | undefined {
  const filtered = values.filter(Boolean)
  return filtered[filtered.length - 1]
}

async function existingCwd(path?: string): Promise<string> {
  if (!path) return process.cwd()
  try {
    await access(path)
    return path
  } catch {
    return process.cwd()
  }
}
