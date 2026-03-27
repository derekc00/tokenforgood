import { execFile } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

async function execDocker(
  ...args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('docker', args)
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number }
    return {
      stdout: (e.stdout ?? '').trim(),
      stderr: (e.stderr ?? '').trim(),
      exitCode: e.code ?? 1,
    }
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Handle returned by {@link createNetwork} + {@link startProxy}. Carries
 * everything needed to attach an agent container to the isolated network and
 * to tear it all down afterwards.
 */
export interface NetworkHandle {
  /** The Docker network name / ID the agent container should join. */
  networkId: string
  /** Short container ID of the running tinyproxy sidecar. */
  proxyContainerId: string
  /** Human-readable container name — use this as the `--network alias` value. */
  proxyContainerName: string
}

/**
 * Domains the proxy sidecar is permitted to forward traffic to.
 * github.com is intentionally absent — GitHub access goes through the
 * credential broker only.
 */
export const PROXY_ALLOWLIST = [
  'registry.npmjs.org',
  '.fastly.net', // npm CDN
  'pypi.org',
  'files.pythonhosted.org',
  'api.anthropic.com',
  'api.openai.com',
  'tokenforgood.dev',
] as const

// ---------------------------------------------------------------------------
// Network lifecycle
// ---------------------------------------------------------------------------

/**
 * Creates an isolated Docker bridge network for a single task run.
 *
 * The network name embeds the task ID and a timestamp so concurrent runs
 * never collide. Returns the network name, which also serves as its ID for
 * all subsequent Docker operations.
 *
 * @param taskId - Unique identifier for the task being sandboxed.
 * @returns The newly created Docker network name.
 */
export async function createNetwork(taskId: string): Promise<string> {
  const networkName = `tfg-${taskId}-${Date.now()}`
  const result = await execDocker('network', 'create', '--driver', 'bridge', networkName)

  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to create Docker network "${networkName}": ${result.stderr || result.stdout}`,
    )
  }

  return networkName
}

/**
 * Starts the tinyproxy sidecar container attached to the given network.
 *
 * The sidecar enforces the {@link PROXY_ALLOWLIST} — the agent container has
 * no direct internet access and must route all outbound traffic through this
 * proxy. Waits up to 5 seconds for the container to reach a running state.
 *
 * @param networkId - Docker network name returned by {@link createNetwork}.
 * @param configPath - Absolute host path to the tinyproxy.conf file.
 * @returns The container ID and name of the running proxy sidecar.
 */
export async function startProxy(
  networkId: string,
  configPath: string,
  filterPath: string,
): Promise<{ containerId: string; containerName: string }> {
  const containerName = `tfg-proxy-${Date.now()}`

  const runResult = await execDocker(
    'run',
    '-d',
    '--name',
    containerName,
    '--network',
    networkId,
    '-v',
    `${configPath}:/etc/tinyproxy/tinyproxy.conf:ro`,
    '-v',
    `${filterPath}:/etc/tinyproxy/filter.txt:ro`,
    'alpine/tinyproxy',
  )

  if (runResult.exitCode !== 0) {
    throw new Error(
      `Failed to start proxy container "${containerName}": ${runResult.stderr || runResult.stdout}`,
    )
  }

  const containerId = runResult.stdout

  // Poll until the container reports Running=true, up to 5 seconds.
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    const inspectResult = await execDocker(
      'inspect',
      '--format',
      '{{.State.Running}}',
      containerId,
    )

    if (inspectResult.stdout === 'true') {
      return { containerId, containerName }
    }

    // Brief pause before next poll — avoids hammering the Docker daemon.
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  throw new Error(
    `Proxy container "${containerName}" did not reach running state within 5 seconds`,
  )
}

// ---------------------------------------------------------------------------
// Config generation
// ---------------------------------------------------------------------------

/**
 * Generates regex filter rules for tinyproxy's `Filter` file.
 *
 * Each entry in {@link PROXY_ALLOWLIST} is converted to a line-anchored
 * regular expression. A leading `.` (wildcard subdomain) becomes a suffix
 * match; otherwise the domain is matched exactly.
 *
 * @returns Newline-separated regex patterns suitable for a tinyproxy filter file.
 */
export function generateFilterRules(): string {
  const lines = PROXY_ALLOWLIST.map((domain) => {
    // Escape dots in the domain for use in a regex.
    const escaped = domain.replace(/\./g, '\\.')

    if (domain.startsWith('.')) {
      // e.g. ".fastly.net" → any subdomain of fastly.net (but not evilnotfastly.net)
      return `^.*${escaped}$`
    }

    // Exact domain match.
    return `^${escaped}$`
  })

  return lines.join('\n') + '\n'
}

/**
 * Generates the content of a `tinyproxy.conf` configuration file.
 *
 * Key settings:
 * - Listens on port 8888 on all interfaces within the Docker network.
 * - Allows connections from anywhere inside the isolated network (`0.0.0.0/0`).
 * - `FilterDefaultDeny Yes` blocks all domains not matched by the filter file.
 *
 * @param filterPath - Absolute path (inside the container) to the filter file.
 * @returns The full tinyproxy.conf file contents as a string.
 */
export function generateTinyproxyConfig(filterPath: string = '/etc/tinyproxy/filter.txt'): string {
  return [
    'Port 8888',
    'Listen 0.0.0.0',
    'Timeout 30',
    'MaxClients 10',
    'Allow 0.0.0.0/0',
    `Filter "${filterPath}"`,
    'FilterDefaultDeny Yes',
    'FilterURLs Yes',
    '',
  ].join('\n')
}

/**
 * Writes `tinyproxy.conf` and `filter.txt` to the specified directory.
 *
 * The config file references the filter file at its container-side path
 * (`/etc/tinyproxy/filter.txt`) — the caller is responsible for mounting
 * both files into the container at those locations.
 *
 * @param dir - Absolute host path to the directory where the files will be written.
 * @returns Absolute host paths to the written config and filter files.
 */
export function writeProxyConfig(dir: string): { configPath: string; filterPath: string } {
  const configPath = path.join(dir, 'tinyproxy.conf')
  const filterPath = path.join(dir, 'filter.txt')

  fs.writeFileSync(filterPath, generateFilterRules(), 'utf8')
  // Config references the filter at its container-side mount path.
  fs.writeFileSync(configPath, generateTinyproxyConfig('/etc/tinyproxy/filter.txt'), 'utf8')

  return { configPath, filterPath }
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

/**
 * Stops the proxy sidecar container and removes both the container and the
 * Docker network.
 *
 * Errors from individual cleanup steps are swallowed so that a partial
 * failure (e.g. the container was already removed) does not prevent the
 * remaining resources from being cleaned up.
 *
 * @param handle - The {@link NetworkHandle} returned when the sandbox was created.
 */
export async function teardownNetwork(handle: NetworkHandle): Promise<void> {
  await execDocker('stop', '--time=5', handle.proxyContainerId)
  await execDocker('rm', '-f', handle.proxyContainerId)
  await execDocker('network', 'rm', handle.networkId)
}
