/**
 * Docker orchestration module for the TokenForGood CLI sandbox.
 *
 * Shells out to the `docker` binary via child_process.execFile — no
 * shell interpolation, no dockerode, zero new runtime dependencies.
 */

import { execFile } from 'node:child_process'
import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpawnConfig {
  imageRef: string
  networkId: string
  workdir: string
  claudeBinaryPath: string
  authFilePath: string
  settingsJson: string
  /** Name of the proxy sidecar container on the Docker network. */
  proxyContainerName: string
  /** Port the credential broker is listening on (host-side, reached via host.docker.internal). */
  brokerPort: number
  envVars: Record<string, string>
  /** Container memory limit in MiB. Defaults to 4096. */
  memoryLimitMb: number
  /** Hard timeout in seconds before the container is killed. Defaults to 5400 (90 min). */
  timeoutSeconds: number
}

interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

// ---------------------------------------------------------------------------
// Internal helper — NOT exported
// ---------------------------------------------------------------------------

function execDocker(...args: string[]): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile('docker', args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        // Binary not found — surface as a distinguishable result
        resolve({ stdout: '', stderr: 'ENOENT', exitCode: 127 })
        return
      }
      const exitCode =
        err?.code !== undefined ? (typeof err.code === 'number' ? err.code : 1) : 0
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode })
    })
  })
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Checks whether the Docker binary is reachable and the daemon is running.
 * Also validates that the server version is >= 20.10 (required for
 * --add-host=host.docker.internal:host-gateway on Linux).
 */
export async function checkDockerAvailable(): Promise<{ available: boolean; error?: string }> {
  const info = await execDocker('info')

  if (info.exitCode === 127 || info.stderr === 'ENOENT') {
    return {
      available: false,
      error: 'Docker is required. Install Docker Desktop: https://docs.docker.com/get-docker/',
    }
  }

  if (info.exitCode !== 0) {
    return {
      available: false,
      error: 'Docker daemon not running. Start Docker Desktop and try again.',
    }
  }

  // Validate version >= 20.10
  const versionResult = await execDocker('version', '--format', '{{.Server.Version}}')
  if (versionResult.exitCode === 0 && versionResult.stdout) {
    const parts = versionResult.stdout.split('.').map((p) => parseInt(p, 10))
    const major = parts[0] ?? 0
    const minor = parts[1] ?? 0
    const meetsMinimum = major > 20 || (major === 20 && minor >= 10)
    if (!meetsMinimum) {
      return {
        available: false,
        error: `Docker >= 20.10 is required (found ${versionResult.stdout}). Please upgrade Docker Desktop.`,
      }
    }
  }

  return { available: true }
}

/**
 * Pulls a Docker image from its registry.
 * Throws if the pull fails.
 */
export async function pullImage(imageRef: string): Promise<void> {
  const result = await execDocker('pull', imageRef)
  if (result.exitCode !== 0) {
    throw new Error(`Failed to pull sandbox image: ${result.stderr}`)
  }
}

/**
 * Returns true when the specified image exists in the local Docker image cache.
 */
export async function imageExists(imageRef: string): Promise<boolean> {
  const result = await execDocker('image', 'inspect', imageRef)
  return result.exitCode === 0
}

/**
 * Creates and starts a sandboxed Docker container from the given config.
 * Auth and settings files are copied into the container before it is started.
 *
 * @returns The container ID of the running container.
 */
export async function spawnContainer(config: SpawnConfig): Promise<string> {
  const {
    imageRef,
    networkId,
    claudeBinaryPath,
    authFilePath,
    settingsJson,
    proxyContainerName,
    brokerPort,
    envVars,
    memoryLimitMb = 4096,
  } = config

  // Build env flag pairs
  // HTTP(S)_PROXY points to the tinyproxy sidecar on the Docker network (port 8888).
  // BROKER_URL tells the agent how to reach the credential broker on the host.
  const envFlags: string[] = [
    '-e',
    `HTTP_PROXY=http://${proxyContainerName}:8888`,
    '-e',
    `HTTPS_PROXY=http://${proxyContainerName}:8888`,
    '-e',
    `BROKER_URL=http://host.docker.internal:${brokerPort}`,
    '-e',
    'npm_config_ignore_scripts=true',
    ...Object.entries(envVars).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
  ]

  const createArgs = [
    'create',
    `--network=${networkId}`,
    `--memory=${memoryLimitMb}m`,
    '--read-only',
    '--tmpfs',
    '/workspace:rw,exec,size=2g',
    '--tmpfs',
    '/tmp:rw,noexec,size=512m',
    '-v',
    `${claudeBinaryPath}:/usr/local/bin/claude:ro`,
    '--user',
    'sandbox',
    '--add-host=host.docker.internal:host-gateway',
    '-w',
    '/workspace',
    ...envFlags,
    imageRef,
  ]

  const createResult = await execDocker(...createArgs)
  if (createResult.exitCode !== 0) {
    throw new Error(`Failed to create sandbox container: ${createResult.stderr}`)
  }

  const containerId = createResult.stdout

  // Copy auth file into /tmp/claude-auth/ inside the container
  const authCpResult = await execDocker('cp', authFilePath, `${containerId}:/tmp/claude-auth/`)
  if (authCpResult.exitCode !== 0) {
    await execDocker('rm', '-f', containerId)
    throw new Error(`Failed to copy auth file into container: ${authCpResult.stderr}`)
  }

  // Write settingsJson to a host temp file, then copy into the container
  const tmpDir = await mkdtemp(join(tmpdir(), 'tfg-settings-'))
  const settingsTmpPath = join(tmpDir, 'settings.json')
  try {
    await writeFile(settingsTmpPath, settingsJson, 'utf8')
    const settingsCpResult = await execDocker(
      'cp',
      settingsTmpPath,
      `${containerId}:/home/sandbox/.claude/settings.json`,
    )
    if (settingsCpResult.exitCode !== 0) {
      await execDocker('rm', '-f', containerId)
      throw new Error(`Failed to copy settings into container: ${settingsCpResult.stderr}`)
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }

  // Start the container
  const startResult = await execDocker('start', containerId)
  if (startResult.exitCode !== 0) {
    await execDocker('rm', '-f', containerId)
    throw new Error(`Failed to start sandbox container: ${startResult.stderr}`)
  }

  return containerId
}

/**
 * Gracefully stops a running container.
 * Sends SIGTERM and waits up to `timeoutSec` seconds before sending SIGKILL.
 */
export async function stopContainer(containerId: string, timeoutSec: number = 10): Promise<void> {
  await execDocker('stop', `--time=${timeoutSec}`, containerId)
}

/**
 * Copies a single file from inside a container to the host filesystem.
 */
export async function exportFile(
  containerId: string,
  containerPath: string,
  hostPath: string,
): Promise<void> {
  const result = await execDocker('cp', `${containerId}:${containerPath}`, hostPath)
  if (result.exitCode !== 0) {
    throw new Error(`Failed to export file from container: ${result.stderr}`)
  }
}

/**
 * Force-removes a container (running or stopped).
 */
export async function removeContainer(containerId: string): Promise<void> {
  await execDocker('rm', '-f', containerId)
}

/**
 * Exports the container log file, stops the container, then removes it.
 * Errors during log export are swallowed so the container is always cleaned up.
 */
export async function teardown(
  containerId: string,
  logContainerPath: string,
  logHostPath: string,
): Promise<void> {
  try {
    await exportFile(containerId, logContainerPath, logHostPath)
  } catch {
    // Best-effort log export — don't block teardown
  }
  await stopContainer(containerId)
  await removeContainer(containerId)
}

/**
 * Waits for a container to exit on its own, racing against a timeout.
 * If the timeout fires first the container is stopped and
 * `{ exitCode: -1, timedOut: true }` is returned.
 */
export async function waitForExit(
  containerId: string,
  timeoutMs: number,
): Promise<{ exitCode: number; timedOut: boolean }> {
  return new Promise((resolve) => {
    let settled = false

    const timer = setTimeout(async () => {
      if (settled) return
      settled = true
      await stopContainer(containerId)
      resolve({ exitCode: -1, timedOut: true })
    }, timeoutMs)

    execDocker('wait', containerId).then((result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const exitCode =
        result.exitCode === 0 ? parseInt(result.stdout, 10) : result.exitCode
      resolve({ exitCode: isNaN(exitCode) ? 1 : exitCode, timedOut: false })
    })
  })
}
