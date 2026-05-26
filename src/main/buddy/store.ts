import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  CreateTaskInput,
  CreateTaskResult,
  Event,
  GlobalSettings,
  Task,
  TaskDetail,
  TaskSettings,
  TaskState
} from '../../shared/types'
import { createBuddyPaths, taskDir, workspaceKeyForRepo } from './paths'
import { parseEventLine, parseTaskSettings, parseTaskState } from './schemas'

interface TaskMeta {
  task_text?: string
  context_text?: string
}

export class BuddyStore {
  constructor(public readonly dataRoot: string) {}

  async getTasks(): Promise<Task[]> {
    const paths = createBuddyPaths(this.dataRoot)
    const workspaceKeys = await listDirectoryNames(paths.workspacesDir)
    const tasks: Task[] = []

    for (const workspaceKey of workspaceKeys) {
      const tasksDir = join(paths.workspacesDir, workspaceKey, 'tasks')
      const taskIds = await listDirectoryNames(tasksDir)
      for (const taskId of taskIds) {
        try {
          const state = await this.readTaskState(taskId, workspaceKey)
          tasks.push({
            task_id: taskId,
            workspace_key: workspaceKey,
            status: state.status,
            updated_at: state.updated_at ?? '',
            repo_root: state.repo_root ?? '',
            round: state.round,
            active_run: state.active_run ?? null
          })
        } catch {
          // Ignore unreadable task directories; schema errors surface on detail load.
        }
      }
    }

    return tasks.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }

  async getTaskDetail(taskId: string, workspaceKey: string): Promise<TaskDetail> {
    const state = await this.readTaskState(taskId, workspaceKey)
    const settings = await this.readTaskSettings(taskId, workspaceKey)
    const meta = await this.readTaskMeta(taskId, workspaceKey)
    const events = await this.readEvents(taskId, workspaceKey)

    return {
      task_id: taskId,
      workspace_key: workspaceKey,
      state,
      settings,
      task_text: meta.task_text ?? '',
      context_text: meta.context_text ?? '',
      transcript: [],
      events,
      latest_failure: state.latest_failure ?? null
    }
  }

  async getEvents(taskId: string, since: number, workspaceKey: string): Promise<{ events: Event[] }> {
    const events = await this.readEvents(taskId, workspaceKey)
    return { events: events.filter((event) => event.seq > since) }
  }

  async createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
    const repoRoot = input.repo_root ?? ''
    const workspaceKey = workspaceKeyForRepo(repoRoot || input.task_id)
    const dir = this.taskDirectory(input.task_id, workspaceKey)
    const now = new Date().toISOString()

    await mkdir(join(dir, 'artifacts'), { recursive: true })
    await atomicWriteJson(join(dir, 'settings.json'), defaultTaskSettings(input.settings))
    await atomicWriteJson(join(dir, 'state.json'), defaultTaskState(repoRoot, now))
    await atomicWriteJson(join(dir, 'task.json'), {
      task_text: input.task_text ?? '',
      context_text: input.context_text ?? ''
    })
    await atomicWriteText(join(dir, 'transcript.md'), initialTranscript(input, now))
    await appendEventLine(join(dir, 'events.jsonl'), {
      seq: 1,
      type: 'task.created',
      ts: now,
      payload: {
        task_text: input.task_text ?? '',
        context_text: input.context_text ?? ''
      }
    })

    return { task: input.task_id, path: dir, workspace_key: workspaceKey }
  }

  async deleteTask(taskId: string, workspaceKey: string): Promise<void> {
    await rm(this.taskDirectory(taskId, workspaceKey), { recursive: true, force: true })
  }

  async updateGlobalSettings(settings: GlobalSettings): Promise<GlobalSettings> {
    const path = createBuddyPaths(this.dataRoot).globalSettings
    await atomicWriteJson(path, settings)
    return settings
  }

  async readTaskState(taskId: string, workspaceKey: string): Promise<TaskState> {
    return parseTaskState(await readJson(this.statePath(taskId, workspaceKey))) as TaskState
  }

  async readTaskSettings(taskId: string, workspaceKey: string): Promise<TaskSettings> {
    return parseTaskSettings(await readJson(this.settingsPath(taskId, workspaceKey))) as TaskSettings
  }

  async updateTaskState(
    taskId: string,
    workspaceKey: string,
    update: (state: TaskState) => TaskState
  ): Promise<TaskState> {
    const next = update(await this.readTaskState(taskId, workspaceKey))
    await atomicWriteJson(this.statePath(taskId, workspaceKey), next)
    return next
  }

  async appendTaskEvent(
    taskId: string,
    workspaceKey: string,
    event: Omit<Event, 'seq' | 'ts'> & Partial<Pick<Event, 'seq' | 'ts'>>
  ): Promise<Event> {
    const events = await this.readEvents(taskId, workspaceKey)
    const next: Event = {
      seq: event.seq ?? events.reduce((max, item) => Math.max(max, item.seq), 0) + 1,
      ts: event.ts ?? new Date().toISOString(),
      type: event.type,
      actor: event.actor,
      payload: event.payload
    }
    await appendEventLine(this.eventsPath(taskId, workspaceKey), next)
    return next
  }

  taskDirectory(taskId: string, workspaceKey: string): string {
    return taskDir(createBuddyPaths(this.dataRoot), workspaceKey, taskId)
  }

  statePath(taskId: string, workspaceKey: string): string {
    return join(this.taskDirectory(taskId, workspaceKey), 'state.json')
  }

  settingsPath(taskId: string, workspaceKey: string): string {
    return join(this.taskDirectory(taskId, workspaceKey), 'settings.json')
  }

  eventsPath(taskId: string, workspaceKey: string): string {
    return join(this.taskDirectory(taskId, workspaceKey), 'events.jsonl')
  }

  private async readTaskMeta(taskId: string, workspaceKey: string): Promise<TaskMeta> {
    const path = join(this.taskDirectory(taskId, workspaceKey), 'task.json')
    try {
      return await readJson(path) as TaskMeta
    } catch {
      return {}
    }
  }

  private async readEvents(taskId: string, workspaceKey: string): Promise<Event[]> {
    const path = this.eventsPath(taskId, workspaceKey)
    try {
      const text = await readFile(path, 'utf8')
      return text
        .split(/\r?\n/)
        .filter(Boolean)
        .map(parseEventLine) as Event[]
    } catch {
      return []
    }
  }
}

async function listDirectoryNames(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {
    return []
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await atomicWriteText(path, JSON.stringify(value))
}

async function atomicWriteText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await writeFile(tmp, value)
  await rename(tmp, path)
}

async function appendEventLine(path: string, event: Event): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(event)}\n`, { flag: 'a' })
}

function defaultTaskSettings(overrides?: Record<string, unknown>): TaskSettings {
  return {
    protocol_version: '1',
    countdown_seconds: 30,
    flow_policy: 'claude_then_codex',
    role_mode: 'claude_implements',
    launchers: {},
    ...overrides
  } as TaskSettings
}

function defaultTaskState(repoRoot: string, now: string): TaskState {
  return {
    status: 'READY',
    round: 1,
    next_actor: 'claude',
    active_run: null,
    updated_at: now,
    repo_root: repoRoot,
    pending_break: null
  }
}

function initialTranscript(input: CreateTaskInput, now: string): string {
  const lines = [
    `# ${input.task_id}`,
    '',
    `Created: ${now}`,
    '',
    '## Task',
    input.task_text ?? '',
    '',
    '## Context',
    input.context_text ?? ''
  ]
  return `${lines.join('\n')}\n`
}
