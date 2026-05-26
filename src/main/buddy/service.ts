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

export class BuddyCoreService {
  async checkHealth(): Promise<boolean> {
    return true
  }

  async bootstrap(): Promise<BootstrapResponse> {
    return {
      version: 'native',
      repo_root: '',
      data_root: '',
      tasks: []
    }
  }

  async getTasks(): Promise<Task[]> {
    return []
  }

  async getTaskDetail(_taskId: string, _workspaceKey?: string): Promise<TaskDetail> {
    throw new Error('Task detail store is not implemented yet')
  }

  async createTask(_input: CreateTaskInput): Promise<CreateTaskResult> {
    throw new Error('Task creation is not implemented yet')
  }

  async deleteTask(_taskId: string, _workspaceKey?: string): Promise<void> {
    throw new Error('Task deletion is not implemented yet')
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

  async getEvents(_taskId: string, _since: number, _workspaceKey?: string): Promise<{ events: Event[] }> {
    return { events: [] }
  }

  async updateGlobalSettings(settings: GlobalSettings): Promise<GlobalSettings> {
    return settings
  }
}
