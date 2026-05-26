import { homedir } from 'node:os'
import { join } from 'node:path'
import type {
  BootstrapResponse,
  CountdownInput,
  CreateTaskInput,
  CreateTaskResult,
  Event,
  GlobalSettings,
  SendMessageInput,
  StartTaskInput,
  Task,
  TaskDetail
} from '../../shared/types'
import { BuddyStore } from './store'

export class BuddyCoreService {
  private readonly store: BuddyStore

  constructor(dataRoot = defaultDataRoot()) {
    this.store = new BuddyStore(dataRoot)
  }

  async checkHealth(): Promise<boolean> {
    return true
  }

  async bootstrap(): Promise<BootstrapResponse> {
    return {
      version: 'native',
      repo_root: '',
      data_root: this.store.dataRoot,
      tasks: await this.store.getTasks()
    }
  }

  getTasks(): Promise<Task[]> {
    return this.store.getTasks()
  }

  getTaskDetail(taskId: string, workspaceKey?: string): Promise<TaskDetail> {
    if (!workspaceKey) throw new Error('workspaceKey is required')
    return this.store.getTaskDetail(taskId, workspaceKey)
  }

  createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
    return this.store.createTask(input)
  }

  deleteTask(taskId: string, workspaceKey?: string): Promise<void> {
    if (!workspaceKey) throw new Error('workspaceKey is required')
    return this.store.deleteTask(taskId, workspaceKey)
  }

  async startTask(_taskId: string, _input: StartTaskInput): Promise<void> {
    throw new Error('Runner is not implemented yet')
  }

  async sendMessage(_taskId: string, _input: SendMessageInput): Promise<void> {
    throw new Error('Messaging is not implemented yet')
  }

  async skipCountdown(_taskId: string, _input: CountdownInput): Promise<void> {
    throw new Error('Countdown is not implemented yet')
  }

  async pauseCountdown(_taskId: string, _input: CountdownInput): Promise<void> {
    throw new Error('Countdown is not implemented yet')
  }

  async interrupt(_taskId: string, _workspaceKey?: string): Promise<void> {
    throw new Error('Interrupt is not implemented yet')
  }

  getEvents(taskId: string, since: number, workspaceKey?: string): Promise<{ events: Event[] }> {
    if (!workspaceKey) throw new Error('workspaceKey is required')
    return this.store.getEvents(taskId, since, workspaceKey)
  }

  updateGlobalSettings(settings: GlobalSettings): Promise<GlobalSettings> {
    return this.store.updateGlobalSettings(settings)
  }
}

function defaultDataRoot(): string {
  return join(homedir(), 'Library', 'Application Support', 'buddy')
}
