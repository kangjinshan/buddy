import { z } from 'zod'

const taskStatusSchema = z.enum([
  'READY',
  'RUNNING_CLAUDE',
  'RUNNING_CODEX',
  'RUNNING_OPENCODE',
  'RUNNING_KIMI',
  'COUNTDOWN',
  'PAUSED',
  'FAILED',
  'DONE'
])

const activeRunSchema = z.object({
  run_id: z.string().optional(),
  actor: z.string(),
  started_at: z.string(),
  status: z.string().optional(),
  session_id_before: z.string().nullable().optional(),
  session_id_after: z.string().nullable().optional()
})

const countdownSchema = z.object({
  status: z.enum(['running', 'paused', 'elapsed', 'skipped', 'expired']),
  remaining: z.number().default(0),
  default_next_actor: z.string(),
  deadline: z.string().optional()
})

function optionalLegacyNullable<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => value === null ? undefined : value, schema.optional())
}

const failureSchema = z.object({
  message: z.string(),
  actor: z.string().optional(),
  run_id: z.string().optional(),
  ts: z.string().optional(),
  output_file: z.string().optional(),
  event_file: z.string().optional()
})

export const taskStateSchema = z.object({
  protocol_version: z.string().optional(),
  task_id: z.string().optional(),
  status: taskStatusSchema,
  round: z.number(),
  rounds_in_window: z.number().default(0),
  next_actor: z.string(),
  countdown: optionalLegacyNullable(countdownSchema),
  active_run: activeRunSchema.nullable().optional(),
  claude_session_id: optionalLegacyNullable(z.string()),
  codex_thread_id: optionalLegacyNullable(z.string()),
  opencode_session_id: optionalLegacyNullable(z.string()),
  kimi_session_id: optionalLegacyNullable(z.string()),
  context_hash: z.string().optional(),
  context_sent: z.record(z.string(), z.boolean()).default({}),
  updated_at: z.string().optional(),
  repo_root: z.string().optional(),
  pending_break: z.object({ actor: z.string().optional(), round: z.number().optional() }).nullable().optional(),
  last_error: failureSchema.nullable().optional(),
  consecutive_failures: z.number().optional(),
  latest_failure: failureSchema.nullable().optional()
})

export const launcherSchema = z.object({
  command: z.string(),
  env: z.record(z.string(), z.string()).default({}),
  timeout_seconds: z.number().default(600)
})

export const taskSettingsSchema = z.object({
  protocol_version: z.string().default('1'),
  countdown_seconds: z.number().default(30),
  flow_policy: z.string().default('claude_then_codex'),
  role_mode: z.string().default('claude_implements'),
  launchers: z.record(z.string(), launcherSchema).default({}),
  implementer_actor: z.string().optional(),
  reviewer_actor: z.string().optional(),
  max_rounds: z.number().optional(),
  max_consecutive_failures: z.number().optional(),
  seed_claude_session_id: z.string().optional(),
  seed_codex_thread_id: z.string().optional(),
  seed_opencode_session_id: z.string().optional(),
  seed_kimi_session_id: z.string().optional()
})

export const globalSettingsSchema = z.object({
  protocol_version: z.string().default('1'),
  countdown_seconds: z.number().default(30),
  max_rounds: z.number().default(10),
  max_consecutive_failures: z.number().default(3),
  launchers: z.record(z.string(), launcherSchema).default({})
})

export const eventSchema = z.object({
  seq: z.number(),
  type: z.string(),
  actor: z.string().optional(),
  ts: z.string(),
  run_id: z.string().optional(),
  payload: z.record(z.string(), z.unknown())
})

export function parseTaskState(input: unknown) {
  return taskStateSchema.parse(input)
}

export function parseTaskSettings(input: unknown) {
  return taskSettingsSchema.parse(input)
}

export function parseGlobalSettings(input: unknown) {
  return globalSettingsSchema.parse(input)
}

export function parseEventLine(line: string) {
  return eventSchema.parse(JSON.parse(line))
}
