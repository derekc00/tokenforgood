/**
 * Integration tests for task lifecycle API routes.
 *
 * Strategy: direct function imports — each route handler is a plain async
 * function that accepts a NextRequest and returns a NextResponse.  We
 * construct NextRequest objects in-process; no HTTP server is required.
 *
 * The data layer uses the in-memory mock service (createMockDataService),
 * which is what getDataService() re-exports.  Each test suite gets a fresh
 * service instance via vi.mock so state never leaks across tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Route handlers under test
// ---------------------------------------------------------------------------
import { GET as getTasks, POST as postTasks } from '@/app/api/tasks/route'
import { POST as claimTask } from '@/app/api/tasks/[id]/claim/route'
import { POST as unclaimTask } from '@/app/api/tasks/[id]/unclaim/route'
import { POST as heartbeatTask } from '@/app/api/tasks/[id]/heartbeat/route'
import { POST as completeTask } from '@/app/api/tasks/[id]/complete/route'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const VALID_ISSUE_URL = 'https://github.com/owner/repo/issues/1'
const VALID_TEMPLATE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567801'
const VALID_PR_URL = 'https://github.com/owner/repo/pull/42'
const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a NextRequest for a route that doesn't need an id segment. */
function makeRequest(
  url: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> },
): NextRequest {
  const method = options?.method ?? 'GET'
  const headers = new Headers(options?.headers ?? {})
  const init: RequestInit = { method }

  if (options?.body !== undefined) {
    init.body = JSON.stringify(options.body)
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    init.headers = headers
  } else {
    init.headers = headers
  }

  return new NextRequest(url, init)
}

/** Resolve the params promise that Next.js App Router injects into dynamic routes. */
function routeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

// ---------------------------------------------------------------------------
// Module-level mock: replace the data service with a fresh in-memory instance
// before each test so tasks created in one test don't appear in another.
// ---------------------------------------------------------------------------
import { createMockDataService } from '@/lib/services/mock-data-service'

let _service = createMockDataService()

vi.mock('@/lib/services', () => ({
  getDataService: () => _service,
}))

beforeEach(() => {
  _service = createMockDataService()
})

// ===========================================================================
// GET /api/tasks
// ===========================================================================
describe('GET /api/tasks', () => {
  it('returns 200 and a paginated list', async () => {
    const req = makeRequest('http://localhost/api/tasks')
    const res = await getTasks(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('data')
    expect(Array.isArray(body.data)).toBe(true)
    expect(body).toHaveProperty('total')
  })

  it('returns 400 for an invalid status query param', async () => {
    const req = makeRequest('http://localhost/api/tasks?status=invalid-status')
    const res = await getTasks(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toHaveProperty('error')
  })

  it('accepts valid filter params', async () => {
    const req = makeRequest('http://localhost/api/tasks?status=open&per_page=5')
    const res = await getTasks(req)

    expect(res.status).toBe(200)
  })
})

// ===========================================================================
// POST /api/tasks
// ===========================================================================
describe('POST /api/tasks', () => {
  it('creates a task and returns 201', async () => {
    const req = makeRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: { github_issue_url: VALID_ISSUE_URL, template_id: VALID_TEMPLATE_ID },
    })
    const res = await postTasks(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toHaveProperty('id')
    expect(body.status).toBe('open')
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'text/plain' },
    })
    const res = await postTasks(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 when github_issue_url is missing', async () => {
    const req = makeRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: { template_id: VALID_TEMPLATE_ID },
    })
    const res = await postTasks(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toHaveProperty('error', 'Validation failed')
  })

  it('returns 400 when github_issue_url is not a GitHub issue URL', async () => {
    const req = makeRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: {
        github_issue_url: 'https://not-github.com/owner/repo/issues/1',
        template_id: VALID_TEMPLATE_ID,
      },
    })
    const res = await postTasks(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 when template_id is missing', async () => {
    const req = makeRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: { github_issue_url: VALID_ISSUE_URL },
    })
    const res = await postTasks(req)

    expect(res.status).toBe(400)
  })

  it('newly created task is retrievable from GET /api/tasks', async () => {
    await postTasks(
      makeRequest('http://localhost/api/tasks', {
        method: 'POST',
        body: { github_issue_url: VALID_ISSUE_URL, template_id: VALID_TEMPLATE_ID },
      }),
    )

    const listRes = await getTasks(makeRequest('http://localhost/api/tasks?status=open'))
    const body = await listRes.json()

    const found = body.data.some(
      (t: { github_issue_url: string }) => t.github_issue_url === VALID_ISSUE_URL,
    )
    expect(found).toBe(true)
  })
})

// ===========================================================================
// POST /api/tasks/:id/claim
// ===========================================================================
describe('POST /api/tasks/:id/claim', () => {
  async function createAndGetTaskId(): Promise<string> {
    const res = await postTasks(
      makeRequest('http://localhost/api/tasks', {
        method: 'POST',
        body: { github_issue_url: VALID_ISSUE_URL, template_id: VALID_TEMPLATE_ID },
      }),
    )
    const body = await res.json()
    return body.id as string
  }

  it('claims an open task and returns 200 with a claim_token', async () => {
    const id = await createAndGetTaskId()
    const res = await claimTask(
      makeRequest(`http://localhost/api/tasks/${id}/claim`, { method: 'POST' }),
      routeParams(id),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body).toHaveProperty('claim_token')
  })

  it('returns 409 when the task is already claimed', async () => {
    const id = await createAndGetTaskId()

    // First claim succeeds
    await claimTask(
      makeRequest(`http://localhost/api/tasks/${id}/claim`, { method: 'POST' }),
      routeParams(id),
    )

    // Second claim by a different anonymous user hits 409
    const res = await claimTask(
      makeRequest(`http://localhost/api/tasks/${id}/claim`, { method: 'POST' }),
      routeParams(id),
    )
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.success).toBe(false)
  })

  it('returns 409 for a non-existent task ID', async () => {
    const res = await claimTask(
      makeRequest(`http://localhost/api/tasks/${NONEXISTENT_ID}/claim`, { method: 'POST' }),
      routeParams(NONEXISTENT_ID),
    )

    expect(res.status).toBe(409)
  })
})

// ===========================================================================
// POST /api/tasks/:id/heartbeat
// ===========================================================================
describe('POST /api/tasks/:id/heartbeat', () => {
  async function createAndClaim(): Promise<{ id: string; claim_token: string }> {
    const createRes = await postTasks(
      makeRequest('http://localhost/api/tasks', {
        method: 'POST',
        body: { github_issue_url: VALID_ISSUE_URL, template_id: VALID_TEMPLATE_ID },
      }),
    )
    const { id } = await createRes.json()

    const claimRes = await claimTask(
      makeRequest(`http://localhost/api/tasks/${id}/claim`, { method: 'POST' }),
      routeParams(id),
    )
    const { claim_token } = await claimRes.json()
    return { id, claim_token }
  }

  it('accepts claim_token from Authorization Bearer header', async () => {
    const { id, claim_token } = await createAndClaim()

    const res = await heartbeatTask(
      makeRequest(`http://localhost/api/tasks/${id}/heartbeat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${claim_token}` },
      }),
      routeParams(id),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.task_id).toBe(id)
  })

  it('accepts claim_token from JSON request body', async () => {
    const { id, claim_token } = await createAndClaim()

    const res = await heartbeatTask(
      makeRequest(`http://localhost/api/tasks/${id}/heartbeat`, {
        method: 'POST',
        body: { claim_token },
      }),
      routeParams(id),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 400 when no token is provided via body', async () => {
    const { id } = await createAndClaim()

    const res = await heartbeatTask(
      makeRequest(`http://localhost/api/tasks/${id}/heartbeat`, {
        method: 'POST',
        body: {},
      }),
      routeParams(id),
    )

    expect(res.status).toBe(400)
  })

  it('returns 409 for a non-existent task ID', async () => {
    const res = await heartbeatTask(
      makeRequest(`http://localhost/api/tasks/${NONEXISTENT_ID}/heartbeat`, {
        method: 'POST',
        body: { claim_token: 'any-token' },
      }),
      routeParams(NONEXISTENT_ID),
    )

    expect(res.status).toBe(409)
  })
})

// ===========================================================================
// POST /api/tasks/:id/complete
//
// AUTH GAP — the route currently hard-codes userId = 'anonymous' because real
// session-based auth has not been wired up yet.  As a result:
//   • Any unauthenticated caller can complete any claimed task.
//   • The claim_token returned by /claim is accepted in the response but is
//     NOT validated on /complete — it is ignored entirely.
//
// TODO (auth): Once auth is integrated, add tests that verify:
//   1. A request without a valid session / Bearer token is rejected (401).
//   2. A request from a user who did NOT claim the task is rejected (403).
//   3. Only the original claimer (identity matches task.claimed_by) can
//      successfully complete the task.
// ===========================================================================
describe('POST /api/tasks/:id/complete', () => {
  async function createClaimedTask(): Promise<{ id: string; claim_token: string }> {
    const createRes = await postTasks(
      makeRequest('http://localhost/api/tasks', {
        method: 'POST',
        body: { github_issue_url: VALID_ISSUE_URL, template_id: VALID_TEMPLATE_ID },
      }),
    )
    const { id } = await createRes.json()

    const claimRes = await claimTask(
      makeRequest(`http://localhost/api/tasks/${id}/claim`, { method: 'POST' }),
      routeParams(id),
    )
    const { claim_token } = await claimRes.json()
    return { id, claim_token }
  }

  // NOTE: this test reflects CURRENT stubbed behavior — the route accepts any
  // caller without verifying identity because userId is hard-coded to
  // 'anonymous'.  The claim_token is not checked on this endpoint.
  // TODO (auth): once ownership enforcement is added this test should supply a
  // valid session credential and the bare-anonymous variant should return 401.
  it('completes a claimed task with pr_url and returns 200', async () => {
    const { id } = await createClaimedTask()

    const res = await completeTask(
      makeRequest(`http://localhost/api/tasks/${id}/complete`, {
        method: 'POST',
        body: { pr_url: VALID_PR_URL },
      }),
      routeParams(id),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 400 when neither pr_url nor issue_comment_url is provided', async () => {
    const { id } = await createClaimedTask()

    const res = await completeTask(
      makeRequest(`http://localhost/api/tasks/${id}/complete`, {
        method: 'POST',
        body: {},
      }),
      routeParams(id),
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 when pr_url fails the GitHub PR URL pattern', async () => {
    const { id } = await createClaimedTask()

    const res = await completeTask(
      makeRequest(`http://localhost/api/tasks/${id}/complete`, {
        method: 'POST',
        body: { pr_url: 'https://github.com/owner/repo/issues/42' }, // issue URL, not PR URL
      }),
      routeParams(id),
    )

    expect(res.status).toBe(400)
  })

  it('returns 404 for a non-existent task ID', async () => {
    const res = await completeTask(
      makeRequest(`http://localhost/api/tasks/${NONEXISTENT_ID}/complete`, {
        method: 'POST',
        body: { pr_url: VALID_PR_URL },
      }),
      routeParams(NONEXISTENT_ID),
    )

    expect(res.status).toBe(404)
  })

  it('returns 409 when trying to complete an unclaimed task', async () => {
    // Create a task but do NOT claim it
    const createRes = await postTasks(
      makeRequest('http://localhost/api/tasks', {
        method: 'POST',
        body: { github_issue_url: VALID_ISSUE_URL, template_id: VALID_TEMPLATE_ID },
      }),
    )
    const { id } = await createRes.json()

    const res = await completeTask(
      makeRequest(`http://localhost/api/tasks/${id}/complete`, {
        method: 'POST',
        body: { pr_url: VALID_PR_URL },
      }),
      routeParams(id),
    )

    expect(res.status).toBe(409)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const { id } = await createClaimedTask()

    const req = new NextRequest(`http://localhost/api/tasks/${id}/complete`, {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'text/plain' },
    })
    const res = await completeTask(req, routeParams(id))

    expect(res.status).toBe(400)
  })
})

// ===========================================================================
// POST /api/tasks/:id/unclaim
// ===========================================================================
describe('POST /api/tasks/:id/unclaim', () => {
  async function createAndClaimTask(): Promise<{ id: string }> {
    const createRes = await postTasks(
      makeRequest('http://localhost/api/tasks', {
        method: 'POST',
        body: { github_issue_url: VALID_ISSUE_URL, template_id: VALID_TEMPLATE_ID },
      }),
    )
    const { id } = await createRes.json()
    await claimTask(
      makeRequest(`http://localhost/api/tasks/${id}/claim`, { method: 'POST' }),
      routeParams(id),
    )
    return { id }
  }

  it('unclaims a claimed task and returns 200', async () => {
    const { id } = await createAndClaimTask()

    const res = await unclaimTask(
      makeRequest(`http://localhost/api/tasks/${id}/unclaim`, { method: 'POST' }),
      routeParams(id),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 409 for a non-existent task ID', async () => {
    const res = await unclaimTask(
      makeRequest(`http://localhost/api/tasks/${NONEXISTENT_ID}/unclaim`, { method: 'POST' }),
      routeParams(NONEXISTENT_ID),
    )

    expect(res.status).toBe(409)
  })

  it('task is claimable again after being unclaimed', async () => {
    const { id } = await createAndClaimTask()

    await unclaimTask(
      makeRequest(`http://localhost/api/tasks/${id}/unclaim`, { method: 'POST' }),
      routeParams(id),
    )

    const res = await claimTask(
      makeRequest(`http://localhost/api/tasks/${id}/claim`, { method: 'POST' }),
      routeParams(id),
    )

    expect(res.status).toBe(200)
  })
})
