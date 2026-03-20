const API_BASE = process.env.TOKENFORGOOD_API_URL ?? 'https://tokenforgood.dev'

export async function fetchTask(taskId: string): Promise<TaskResponse> {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}`)
  if (!response.ok) throw new Error(`Task not found: ${taskId}`)
  const data: TaskResponse = await response.json()
  return data
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
  const data: { claim_token: string } = await response.json()
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

// Types
export interface TaskResponse {
  id: string
  github_issue_url: string
  github_issue_title: string
  repo_full_name: string
  task_type: string
  template: { name: string; recommended_mode: string } | null
}
