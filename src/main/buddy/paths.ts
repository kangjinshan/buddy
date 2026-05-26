import { createHash } from 'node:crypto'
import { join } from 'node:path'

export interface BuddyPaths {
  dataRoot: string
  globalSettings: string
  workspacesDir: string
  runtimeTasksDir: string
}

export function createBuddyPaths(dataRoot: string): BuddyPaths {
  return {
    dataRoot,
    globalSettings: join(dataRoot, 'global', 'settings.json'),
    workspacesDir: join(dataRoot, 'workspaces'),
    runtimeTasksDir: join(dataRoot, 'runtime', 'tasks')
  }
}

export function workspaceKeyForRepo(repoRoot: string): string {
  return createHash('sha256').update(repoRoot).digest('hex').slice(0, 12)
}

export function workspaceDir(paths: BuddyPaths, workspaceKey: string): string {
  return join(paths.workspacesDir, workspaceKey)
}

export function taskDir(paths: BuddyPaths, workspaceKey: string, taskId: string): string {
  return join(workspaceDir(paths, workspaceKey), 'tasks', taskId)
}
