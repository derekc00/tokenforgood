import * as http from 'node:http'
import * as crypto from 'node:crypto'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Configuration required to start the credential broker.
 */
export interface BrokerConfig {
  /** GitHub personal access token — never forwarded to the container. */
  githubToken: string
  /** Repository the broker is allowed to operate on, in "owner/repo" format. */
  allowedRepo: string
  /** Task ID associated with this broker session. */
  taskId: string
}

/**
 * Handle returned by {@link startBroker}. Provides the port and nonce the
 * container needs, plus a `stop` function for graceful shutdown.
 */
export interface BrokerHandle {
  /** The OS-assigned port the broker is listening on (bound to 127.0.0.1). */
  port: number
  /** Cryptographic nonce the container must supply in `X-Broker-Nonce`. */
  nonce: string
  /** Gracefully closes the HTTP server and resolves when the last connection is done. */
  stop: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Reads the full body of an incoming request as a UTF-8 string. */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Writes a JSON response with the given status code. */
function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/**
 * Makes an authenticated request to the GitHub API with a configurable
 * timeout. Adds the required authorization, accept, and user-agent headers.
 */
async function githubFetch(
  token: string,
  url: string,
  options: RequestInit,
  timeoutMs: number = 30_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'tokenforgood-cli',
        ...(options.headers ?? {}),
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleCloneRepo(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: BrokerConfig,
): Promise<void> {
  let body: { repo?: unknown }
  try {
    body = JSON.parse(await readBody(req)) as { repo?: unknown }
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' })
    return
  }

  if (typeof body.repo !== 'string') {
    sendJson(res, 400, { error: 'Missing or invalid "repo" field' })
    return
  }

  if (body.repo !== config.allowedRepo) {
    sendJson(res, 403, { error: 'Repo not allowed' })
    return
  }

  const [owner, repo] = config.allowedRepo.split('/')
  const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball`

  let ghResponse: Response
  try {
    ghResponse = await githubFetch(config.githubToken, tarballUrl, {
      method: 'GET',
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      sendJson(res, 504, { error: 'GitHub API timeout' })
    } else {
      sendJson(res, 502, { error: 'GitHub API error' })
    }
    return
  }

  if (!ghResponse.ok) {
    sendJson(res, 502, { error: 'GitHub API error', status: ghResponse.status })
    return
  }

  const contentType = ghResponse.headers.get('content-type') ?? 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': contentType })

  // Stream the tarball body directly to the client — the token never appears
  // in the container's request or response beyond the raw bytes of the archive.
  if (!ghResponse.body) {
    res.end()
    return
  }

  const reader = ghResponse.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
  } finally {
    reader.releaseLock()
  }
  res.end()
}

async function handleCreateDraftPr(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: BrokerConfig,
): Promise<void> {
  let body: { title?: unknown; body?: unknown; head?: unknown; base?: unknown }
  try {
    body = JSON.parse(await readBody(req)) as typeof body
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' })
    return
  }

  if (
    typeof body.title !== 'string' ||
    typeof body.body !== 'string' ||
    typeof body.head !== 'string' ||
    typeof body.base !== 'string'
  ) {
    sendJson(res, 400, { error: 'Missing or invalid fields: title, body, head, base are required' })
    return
  }

  const prUrl = `https://api.github.com/repos/${config.allowedRepo}/pulls`

  let ghResponse: Response
  try {
    ghResponse = await githubFetch(
      config.githubToken,
      prUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: body.title,
          body: body.body,
          head: body.head,
          base: body.base,
          draft: true,
        }),
      },
    )
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      sendJson(res, 504, { error: 'GitHub API timeout' })
    } else {
      sendJson(res, 502, { error: 'GitHub API error' })
    }
    return
  }

  if (!ghResponse.ok) {
    sendJson(res, 502, { error: 'GitHub API error', status: ghResponse.status })
    return
  }

  const data = await ghResponse.json() as { html_url?: string; number?: number }
  sendJson(res, 200, { pr_url: data.html_url, pr_number: data.number })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Starts the credential broker HTTP server bound to `127.0.0.1` on a
 * randomly assigned port. The server proxies GitHub operations on behalf of
 * the sandboxed agent so the GitHub token is never forwarded into the
 * container.
 *
 * The container must include the `X-Broker-Nonce` header (set to the value
 * returned in {@link BrokerHandle.nonce}) on every request.
 *
 * Inside a Docker container reach the broker via:
 * `http://host.docker.internal:<port>`
 *
 * @param config - GitHub token, allowed repo, and task ID.
 * @returns A handle with the assigned port, the nonce, and a `stop` function.
 */
export function startBroker(config: BrokerConfig): Promise<BrokerHandle> {
  return new Promise((resolve, reject) => {
    const nonce = crypto.randomBytes(32).toString('hex')

    const server = http.createServer((req, res) => {
      // Nonce validation — applied to every request
      const providedNonce = req.headers['x-broker-nonce']
      if (providedNonce !== nonce) {
        sendJson(res, 403, { error: 'Invalid nonce' })
        return
      }

      const route = `${req.method ?? ''} ${req.url ?? ''}`

      void (async () => {
        try {
          if (route === 'POST /clone-repo') {
            await handleCloneRepo(req, res, config)
          } else if (route === 'POST /create-draft-pr') {
            await handleCreateDraftPr(req, res, config)
          } else {
            sendJson(res, 404, { error: 'Not found' })
          }
        } catch (err) {
          // Last-resort handler — should not normally be reached
          sendJson(res, 500, {
            error: err instanceof Error ? err.message : 'Internal server error',
          })
        }
      })()
    })

    server.on('error', reject)

    // Bind to 127.0.0.1 only — the token must not be reachable from outside
    // the host. Port 0 lets the OS assign a free port.
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        server.close()
        reject(new Error('Unexpected server address format'))
        return
      }

      const port = addr.port

      const stop = (): Promise<void> =>
        new Promise((res, rej) => server.close((err) => (err ? rej(err) : res())))

      resolve({ port, nonce, stop })
    })
  })
}
