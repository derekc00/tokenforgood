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

// ---------------------------------------------------------------------------
// Manifest / prompt / status / unclaim
// ---------------------------------------------------------------------------

const SignedManifestSchema = z.object({
  manifest: z.object({
    task_id: z.string(),
    repo_url: z.string(),
    issue_url: z.string(),
    template_name: z.string(),
    system_prompt_sha256: z.string(),
    allowed_tools: z.array(z.string()),
    network_policy: z.array(z.string()),
    image_digest: z.string(),
    postinstall_allowlist: z.array(z.string()),
    created_at: z.string(),
  }),
  signature: z.string(),
  signing_key: z.string(),
  signing_key_signature: z.string(),
})

export type SignedManifestResponse = z.infer<typeof SignedManifestSchema>

export async function fetchManifest(taskId: string): Promise<SignedManifestResponse> {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}/manifest`)
  if (!response.ok) throw new Error(`Failed to fetch manifest for task: ${taskId}`)
  return SignedManifestSchema.parse(await response.json())
}

export async function fetchTaskPrompt(taskId: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}/prompt`)
  if (!response.ok) throw new Error(`Failed to fetch prompt for task: ${taskId}`)
  const data = await response.json() as { full_prompt: string }
  return data.full_prompt
}

export async function fetchTaskStatus(taskId: string): Promise<{ claimed_by: string | null; status: string }> {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}`)
  if (!response.ok) throw new Error(`Failed to fetch task status: ${taskId}`)
  const data = TaskResponseSchema.parse(await response.json())
  return { claimed_by: (data as any).claimed_by ?? null, status: (data as any).status ?? 'unknown' }
}

export async function unclaimTask(taskId: string, claimToken: string, reason: string): Promise<void> {
  await fetch(`${API_BASE}/api/tasks/${taskId}/unclaim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${claimToken}`,
    },
    body: JSON.stringify({ reason }),
  }).catch(() => { /* unclaim failures are non-fatal */ })
}
