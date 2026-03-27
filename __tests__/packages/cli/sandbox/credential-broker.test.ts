import { describe, it, expect, vi, afterEach } from 'vitest'
import http from 'node:http'
import { startBroker, type BrokerHandle } from '../../../../packages/cli/src/sandbox/credential-broker.js'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface RequestResult {
  status: number
  body: string
}

function makeRequest(
  port: number,
  reqPath: string,
  method: string,
  headers: Record<string, string> = {},
  body: string = '',
): Promise<RequestResult> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
    }

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      })
    })

    req.on('error', reject)

    if (body) {
      req.write(body)
    }
    req.end()
  })
}

// ---------------------------------------------------------------------------
// Test-scoped broker lifecycle
// ---------------------------------------------------------------------------

const brokers: BrokerHandle[] = []

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  // Stop all brokers started in this suite
  for (const broker of brokers) {
    try {
      await broker.stop()
    } catch {
      // ignore
    }
  }
  brokers.length = 0
})

async function createBroker(overrides: Partial<{
  githubToken: string
  allowedRepo: string
  taskId: string
}> = {}): Promise<BrokerHandle> {
  const broker = await startBroker({
    githubToken: overrides.githubToken ?? 'ghp_test_token',
    allowedRepo: overrides.allowedRepo ?? 'test-owner/test-repo',
    taskId: overrides.taskId ?? 'task-001',
  })
  brokers.push(broker)
  return broker
}

// ---------------------------------------------------------------------------
// startBroker — server lifecycle
// ---------------------------------------------------------------------------

describe('startBroker — server binding', () => {
  it('binds to a valid TCP port (> 0)', async () => {
    const broker = await createBroker()
    expect(broker.port).toBeGreaterThan(0)
    expect(broker.port).toBeLessThanOrEqual(65535)
  })

  it('returns a non-empty nonce string', async () => {
    const broker = await createBroker()
    expect(typeof broker.nonce).toBe('string')
    expect(broker.nonce.length).toBeGreaterThan(0)
  })

  it('nonce is a 64-character hex string (32 random bytes)', async () => {
    const broker = await createBroker()
    expect(/^[0-9a-f]{64}$/.test(broker.nonce)).toBe(true)
  })

  it('two brokers get different nonces', async () => {
    const a = await createBroker()
    const b = await createBroker()
    expect(a.nonce).not.toBe(b.nonce)
  })

  it('two brokers bind to different ports', async () => {
    const a = await createBroker()
    const b = await createBroker()
    expect(a.port).not.toBe(b.port)
  })

  it('server actually accepts connections on the assigned port', async () => {
    const broker = await createBroker()
    // A request without a nonce should still get a response (403, not ECONNREFUSED)
    const result = await makeRequest(broker.port, '/clone-repo', 'POST')
    expect(result.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// Nonce validation — missing / wrong nonce
// ---------------------------------------------------------------------------

describe('nonce validation', () => {
  it('returns 403 when X-Broker-Nonce header is absent', async () => {
    const broker = await createBroker()
    const result = await makeRequest(broker.port, '/clone-repo', 'POST', {}, '{}')
    expect(result.status).toBe(403)
  })

  it('returns 403 when X-Broker-Nonce is an empty string', async () => {
    const broker = await createBroker()
    const result = await makeRequest(
      broker.port,
      '/clone-repo',
      'POST',
      { 'X-Broker-Nonce': '' },
      '{}',
    )
    expect(result.status).toBe(403)
  })

  it('returns 403 when X-Broker-Nonce is wrong', async () => {
    const broker = await createBroker()
    const result = await makeRequest(
      broker.port,
      '/clone-repo',
      'POST',
      { 'X-Broker-Nonce': 'wrong-nonce-value' },
      '{}',
    )
    expect(result.status).toBe(403)
  })

  it('returns 403 when X-Broker-Nonce is all zeros', async () => {
    const broker = await createBroker()
    const result = await makeRequest(
      broker.port,
      '/clone-repo',
      'POST',
      { 'X-Broker-Nonce': '0'.repeat(64) },
      '{}',
    )
    expect(result.status).toBe(403)
  })

  it('403 response body contains an error field', async () => {
    const broker = await createBroker()
    const result = await makeRequest(broker.port, '/clone-repo', 'POST')
    const parsed = JSON.parse(result.body)
    expect(typeof parsed.error).toBe('string')
  })

  it('returns 403 for all routes when nonce is missing', async () => {
    const broker = await createBroker()
    const routes = [
      { path: '/clone-repo', method: 'POST' },
      { path: '/create-draft-pr', method: 'POST' },
      { path: '/unknown', method: 'GET' },
    ]

    for (const route of routes) {
      const result = await makeRequest(broker.port, route.path, route.method)
      expect(result.status).toBe(403)
    }
  })
})

// ---------------------------------------------------------------------------
// POST /clone-repo — repo validation
// ---------------------------------------------------------------------------

describe('POST /clone-repo — repo validation', () => {
  it('returns 403 when the requested repo does not match the allowed repo', async () => {
    const broker = await createBroker({ allowedRepo: 'owner/allowed-repo' })

    const result = await makeRequest(
      broker.port,
      '/clone-repo',
      'POST',
      { 'X-Broker-Nonce': broker.nonce },
      JSON.stringify({ repo: 'owner/other-repo' }),
    )
    expect(result.status).toBe(403)
  })

  it('returns 403 for a completely different repo', async () => {
    const broker = await createBroker({ allowedRepo: 'owner/allowed-repo' })

    const result = await makeRequest(
      broker.port,
      '/clone-repo',
      'POST',
      { 'X-Broker-Nonce': broker.nonce },
      JSON.stringify({ repo: 'attacker/evil-repo' }),
    )
    expect(result.status).toBe(403)
  })

  it('returns 400 when the request body is missing the repo field', async () => {
    const broker = await createBroker()

    const result = await makeRequest(
      broker.port,
      '/clone-repo',
      'POST',
      { 'X-Broker-Nonce': broker.nonce },
      JSON.stringify({}),
    )
    expect(result.status).toBe(400)
  })

  it('returns 400 when the request body is invalid JSON', async () => {
    const broker = await createBroker()

    const result = await makeRequest(
      broker.port,
      '/clone-repo',
      'POST',
      { 'X-Broker-Nonce': broker.nonce },
      'not-json',
    )
    expect(result.status).toBe(400)
  })

  it('returns 400 when repo field is a number instead of a string', async () => {
    const broker = await createBroker()

    const result = await makeRequest(
      broker.port,
      '/clone-repo',
      'POST',
      { 'X-Broker-Nonce': broker.nonce },
      JSON.stringify({ repo: 42 }),
    )
    expect(result.status).toBe(400)
  })

  it('proceeds past validation when the correct repo is supplied (calls GitHub API)', async () => {
    const broker = await createBroker({ allowedRepo: 'owner/allowed-repo' })

    // Mock fetch so it returns a successful response (no real network call)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/x-gzip' },
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
          releaseLock: vi.fn(),
        }),
      },
    }))

    const result = await makeRequest(
      broker.port,
      '/clone-repo',
      'POST',
      { 'X-Broker-Nonce': broker.nonce },
      JSON.stringify({ repo: 'owner/allowed-repo' }),
    )
    // Should be 200, not 403 or 400
    expect(result.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Unknown routes
// ---------------------------------------------------------------------------

describe('unknown routes', () => {
  it('returns 404 for an unrecognised POST route', async () => {
    const broker = await createBroker()

    const result = await makeRequest(
      broker.port,
      '/unknown-route',
      'POST',
      { 'X-Broker-Nonce': broker.nonce },
      '{}',
    )
    expect(result.status).toBe(404)
  })

  it('returns 404 for a GET request to an unknown path', async () => {
    const broker = await createBroker()

    const result = await makeRequest(
      broker.port,
      '/does-not-exist',
      'GET',
      { 'X-Broker-Nonce': broker.nonce },
    )
    expect(result.status).toBe(404)
  })

  it('returns 404 for GET /clone-repo (method mismatch)', async () => {
    const broker = await createBroker()

    const result = await makeRequest(
      broker.port,
      '/clone-repo',
      'GET',
      { 'X-Broker-Nonce': broker.nonce },
    )
    expect(result.status).toBe(404)
  })

  it('404 response body contains an error field', async () => {
    const broker = await createBroker()

    const result = await makeRequest(
      broker.port,
      '/unknown-route',
      'POST',
      { 'X-Broker-Nonce': broker.nonce },
      '{}',
    )
    const parsed = JSON.parse(result.body)
    expect(typeof parsed.error).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// stop() — graceful shutdown
// ---------------------------------------------------------------------------

describe('stop()', () => {
  it('resolves without throwing on first call', async () => {
    const broker = await startBroker({
      githubToken: 'ghp_test',
      allowedRepo: 'owner/repo',
      taskId: 'task-stop-test',
    })
    await expect(broker.stop()).resolves.toBeUndefined()
  })

  it('server refuses new connections after stop()', async () => {
    const broker = await startBroker({
      githubToken: 'ghp_test',
      allowedRepo: 'owner/repo',
      taskId: 'task-stop-conn',
    })
    const { port } = broker
    await broker.stop()

    // Attempting to connect after stop should result in an error (ECONNREFUSED)
    await expect(
      makeRequest(port, '/clone-repo', 'POST'),
    ).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// GitHub API proxying — error propagation
// ---------------------------------------------------------------------------

describe('POST /clone-repo — GitHub API error handling', () => {
  it('returns 502 when GitHub API responds with a non-OK status', async () => {
    const broker = await createBroker({ allowedRepo: 'owner/repo' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
      body: null,
    }))

    const result = await makeRequest(
      broker.port,
      '/clone-repo',
      'POST',
      { 'X-Broker-Nonce': broker.nonce },
      JSON.stringify({ repo: 'owner/repo' }),
    )
    expect(result.status).toBe(502)
  })

  it('returns 502 when fetch throws a generic error', async () => {
    const broker = await createBroker({ allowedRepo: 'owner/repo' })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')))

    const result = await makeRequest(
      broker.port,
      '/clone-repo',
      'POST',
      { 'X-Broker-Nonce': broker.nonce },
      JSON.stringify({ repo: 'owner/repo' }),
    )
    expect(result.status).toBe(502)
  })

  it('returns 504 when fetch is aborted (timeout)', async () => {
    const broker = await createBroker({ allowedRepo: 'owner/repo' })

    const abortError = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))

    const result = await makeRequest(
      broker.port,
      '/clone-repo',
      'POST',
      { 'X-Broker-Nonce': broker.nonce },
      JSON.stringify({ repo: 'owner/repo' }),
    )
    expect(result.status).toBe(504)
  })
})
