import { z } from 'zod'

export const API_BASE = process.env.TOKENFORGOOD_API_URL ?? 'https://tokenforgood.dev'

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const TaskResponseSchema = z.object({
  id: z.string(),
  github_issue_url: z.string(),
  github_issue_title: z.string(),
  repo_full_name: z.string(),
  task_type: z.string(),
  template: z
    .object({ name: z.string(), recommended_mode: z.string() })
    .nullable(),
})

const ClaimResponseSchema = z.object({
  claim_token: z.string(),
})

// ---------------------------------------------------------------------------
// Types — derived from schemas to avoid duplication
// ---------------------------------------------------------------------------

export type TaskResponse = z.infer<typeof TaskResponseSchema>

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function fetchTask(taskId: string): Promise<TaskResponse> {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}`)
  if (!response.ok) throw new Error(`Task not found: ${taskId}`)
  return TaskResponseSchema.parse(await response.json())
}

export async function claimTask(taskId: string, githubToken?: string): Promise<{ claimToken: string }> {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
    body: JSON.stringify({}),
  })
  if (!response.ok) throw new Error('Failed to claim task')
  const data = ClaimResponseSchema.parse(await response.json())
  return { claimToken: data.claim_token }
}

export async function sendHeartbeat(taskId: string, claimToken: string): Promise<void> {
  await fetch(`${API_BASE}/api/tasks/${taskId}/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${claimToken}`,
    },
    body: JSON.stringify({ claim_token: claimToken }),
  }).catch(() => { /* heartbeat failures are non-fatal */ })
}

export function startHeartbeat(taskId: string, claimToken: string): NodeJS.Timeout {
  return setInterval(() => {
    void sendHeartbeat(taskId, claimToken)
  }, 60_000) // every 60 seconds
}
