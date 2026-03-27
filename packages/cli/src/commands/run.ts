import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir, homedir, platform } from 'node:os'
import { join, dirname } from 'node:path'
import { promisify } from 'node:util'

import {
  fetchTask,
  fetchManifest,
  fetchTaskPrompt,
  fetchTaskStatus,
  claimTask,
  startHeartbeat,
  unclaimTask,
  type TaskResponse,
} from '../services/api.js'
import {
  checkDockerAvailable,
  pullImage,
  imageExists,
  spawnContainer,
  waitForExit,
  teardown,
  type SpawnConfig,
} from '../sandbox/docker.js'
import { startBroker, type BrokerHandle } from '../sandbox/credential-broker.js'
import { verifyManifest, type SignedManifest } from '../sandbox/manifest.js'
import { createLogger, LogCapExceededError, type ExecutionLogger } from '../sandbox/execution-log.js'
import { createNetwork, startProxy, writeProxyConfig, teardownNetwork, type NetworkHandle } from '../sandbox/network.js'
import { getSettings } from '../sandbox/settings.js'

const APP_URL = (process.env.TOKENFORGOOD_APP_URL ?? 'https://tokenforgood.dev').replace(/\/$/, '')
const SANDBOX_IMAGE = process.env.TOKENFORGOOD_SANDBOX_IMAGE ?? 'ghcr.io/tokenforgood/sandbox:latest'
const TIMEOUT_MS = 90 * 60 * 1000 // 90 minutes

// Packages that legitimately need postinstall (native addons).
// Only these may be passed to `npm rebuild` inside the sandbox.
// The manifest's postinstall_allowlist is intersected with this set.
const SAFE_REBUILD_PACKAGES = new Set([
  'esbuild',
  'sharp',
  'better-sqlite3',
  'bcrypt',
  'argon2',
  'canvas',
  'sqlite3',
  'playwright',
])

const execFileAsync = promisify(execFile)

export interface RunOptions {
  noContainer: boolean
  verbose: boolean
  dryRun: boolean
  githubToken: string | null
  full: boolean
}

export function parseOptions(args: string[]): { taskIds: string[]; options: RunOptions } {
  const taskIds: string[] = []
  const options: RunOptions = {
    noContainer: false,
    verbose: false,
    dryRun: false,
    githubToken: null,
    full: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--no-container') options.noContainer = true
    else if (arg === '--verbose') options.verbose = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--full') options.full = true
    else if (arg === '--github-token') {
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        options.githubToken = next
        i++
      }
    }
    else if (!arg.startsWith('--')) taskIds.push(arg)
  }

  return { taskIds, options }
}

export async function runCommand(args: string[]): Promise<void> {
  const { taskIds, options } = parseOptions(args)

  if (taskIds.length === 0) {
    console.error('Error: At least one task ID is required')
    console.error('Usage: npx tokenforgood run <task-id> [task-id...]')
    process.exit(1)
  }

  for (const taskId of taskIds) {
    if (options.dryRun) {
      await dryRun(taskId, options)
    } else if (options.noContainer) {
      await runCopyPaste(taskId, options)
    } else {
      await runSandboxed(taskId, options)
    }
  }
}

// ---------------------------------------------------------------------------
// Dry-run: fetch + render prompt, no claim, no execution
// ---------------------------------------------------------------------------

async function dryRun(taskId: string, options: RunOptions): Promise<void> {
  console.log(`\n[tokenforgood] Dry-run for task ${taskId}`)

  const task = await fetchTask(taskId)
  if (options.verbose) {
    console.log(`[tokenforgood]   Title: ${task.github_issue_title}`)
    console.log(`[tokenforgood]   Repo:  ${task.repo_full_name}`)
  }

  // Fetch and display the full prompt
  console.log('[tokenforgood] Fetching rendered prompt...')
  const prompt = await fetchTaskPrompt(taskId)

  console.log('\n' + '='.repeat(72))
  console.log('TASK PROMPT PREVIEW')
  console.log('='.repeat(72))
  console.log(prompt)
  console.log('='.repeat(72))

  // Show manifest details
  try {
    const signed = await fetchManifest(taskId)
    const valid = verifyManifest(signed as SignedManifest)
    console.log(`\n[manifest] Signature: ${valid ? 'VALID' : 'INVALID'}`)
    console.log(`[manifest] Image:     ${signed.manifest.image_digest}`)
    console.log(`[manifest] Tools:     ${signed.manifest.allowed_tools.join(', ')}`)
    console.log(`[manifest] Network:   ${signed.manifest.network_policy.join(', ')}`)
    if (signed.manifest.postinstall_allowlist.length > 0) {
      console.log(`[manifest] Postinstall allowed: ${signed.manifest.postinstall_allowlist.join(', ')}`)
    }
    if (!valid) {
      console.error('\n[tokenforgood] WARNING: Task manifest signature is INVALID. Refusing to run.')
    }
  } catch {
    console.log('\n[manifest] Not available (task may not have a signed manifest yet)')
  }
}

// ---------------------------------------------------------------------------
// Copy-paste mode (--no-container): no Docker, uses native agent sandboxing
// ---------------------------------------------------------------------------

async function runCopyPaste(taskId: string, options: RunOptions): Promise<void> {
  console.log(`\n[tokenforgood] Starting task ${taskId} (copy-paste mode)`)

  const task = await fetchTask(taskId)
  if (options.verbose) {
    console.log(`[tokenforgood]   Title: ${task.github_issue_title}`)
    console.log(`[tokenforgood]   Repo:  ${task.repo_full_name}`)
  }

  // Generate the copy-paste command
  const mode = options.full ? 'full' : 'safe'
  const promptUrl = `${APP_URL}/api/tasks/${taskId}/prompt`
  const claudeCmd = `claude -p "$(curl -s ${promptUrl})" --allowedTools '${getSettings(mode).permissions.allow.join(',')}' --max-turns 100`

  console.log('\n[tokenforgood] Copy and paste this command into your terminal:\n')
  console.log(`  ${claudeCmd}`)
  console.log(`\n[tokenforgood] After completion, mark done at: ${APP_URL}/tasks/${taskId}`)
}

// ---------------------------------------------------------------------------
// Sandboxed mode (default): full Docker isolation
// ---------------------------------------------------------------------------

async function runSandboxed(taskId: string, options: RunOptions): Promise<void> {
  console.log(`\n[tokenforgood] Starting task ${taskId} (sandboxed mode)`)

  // Step 1: Check Docker
  console.log('[tokenforgood] Checking Docker...')
  const dockerCheck = await checkDockerAvailable()
  if (!dockerCheck.available) {
    console.error(`[tokenforgood] ${dockerCheck.error}`)
    process.exit(1)
  }

  // Step 2: Fetch task + verify manifest
  console.log('[tokenforgood] Fetching task details...')
  const task = await fetchTask(taskId)
  if (options.verbose) {
    console.log(`[tokenforgood]   Title: ${task.github_issue_title}`)
    console.log(`[tokenforgood]   Repo:  ${task.repo_full_name}`)
    console.log(`[tokenforgood]   Type:  ${task.task_type}`)
  }

  console.log('[tokenforgood] Verifying task manifest...')
  let manifest: SignedManifest | null = null
  try {
    const signed = await fetchManifest(taskId)
    manifest = signed as SignedManifest
    if (!verifyManifest(manifest)) {
      console.error('[tokenforgood] Task manifest signature invalid. Refusing to run.')
      process.exit(1)
    }
    console.log('[tokenforgood] Manifest signature verified.')
  } catch {
    console.warn('[tokenforgood] No manifest available — proceeding without signature verification.')
  }

  const imageRef = manifest?.manifest.image_digest ?? SANDBOX_IMAGE

  // Step 3: Pull sandbox image if needed
  if (!(await imageExists(imageRef))) {
    console.log(`[tokenforgood] Pulling sandbox image (this may take a minute)...`)
    await pullImage(imageRef)
    console.log('[tokenforgood] Image pulled.')
  }

  // Step 4: Claim task
  console.log('[tokenforgood] Claiming task...')
  const { claimToken } = await claimTask(taskId, options.githubToken ?? undefined)

  // Step 5: Start heartbeat
  const heartbeatInterval = startHeartbeat(taskId, claimToken)

  // Resources to clean up
  let broker: BrokerHandle | null = null
  let networkHandle: NetworkHandle | null = null
  let containerId: string | null = null
  let logger: ExecutionLogger | null = null
  let tmpWorkDir: string | null = null

  try {
    // Step 6: Set up temp working directory
    tmpWorkDir = await mkdtemp(join(tmpdir(), `tfg-${taskId}-`))

    // Step 7: Start credential broker
    const githubToken = options.githubToken ?? process.env.GITHUB_TOKEN
    if (!githubToken) {
      console.error('[tokenforgood] GitHub token required. Use --github-token or set GITHUB_TOKEN.')
      process.exit(1)
    }

    console.log('[tokenforgood] Starting credential broker...')
    broker = await startBroker({
      githubToken,
      allowedRepo: task.repo_full_name,
      taskId,
    })
    if (options.verbose) {
      console.log(`[tokenforgood]   Broker on port ${broker.port}`)
    }

    // Step 8: Create isolated Docker network + proxy sidecar
    console.log('[tokenforgood] Creating isolated network...')
    const networkId = await createNetwork(taskId)
    const { configPath, filterPath } = writeProxyConfig(tmpWorkDir)

    console.log('[tokenforgood] Starting proxy sidecar...')
    const proxy = await startProxy(networkId, configPath, filterPath)
    networkHandle = {
      networkId,
      proxyContainerId: proxy.containerId,
      proxyContainerName: proxy.containerName,
    }

    // Step 9: Create execution logger
    const logDir = join(tmpWorkDir, '.tokenforgood')
    logger = createLogger(logDir)
    logger.append({ type: 'info', data: { message: 'Sandbox session started', taskId, repo: task.repo_full_name } })

    // Step 10: Resolve Claude binary path
    const claudeBinaryPath = await resolveClaudeBinary()
    const authFilePath = resolveClaudeAuthFile()

    // Step 11: Build settings.json
    const mode = options.full ? 'full' : 'safe'
    const settingsJson = JSON.stringify(getSettings(mode), null, 2)

    // Step 12: Spawn sandbox container
    console.log('[tokenforgood] Starting sandbox container...')
    const spawnConfig: SpawnConfig = {
      imageRef,
      networkId,
      workdir: '/workspace',
      claudeBinaryPath,
      authFilePath,
      settingsJson,
      proxyContainerName: proxy.containerName,
      brokerPort: broker.port,
      brokerNonce: broker.nonce,
      envVars: {
        TFG_TASK_ID: taskId,
        TFG_REPO: task.repo_full_name,
      },
      memoryLimitMb: 4096,
      timeoutSeconds: 5400,
    }
    containerId = await spawnContainer(spawnConfig)
    console.log('[tokenforgood] Sandbox running.')
    if (options.verbose) {
      console.log(`[tokenforgood]   Container: ${containerId.slice(0, 12)}`)
    }

    // Step 13: Run postinstall for allowlisted packages.
    // Only packages in the hardcoded SAFE_REBUILD_PACKAGES set are permitted,
    // regardless of what the manifest claims. This prevents a compromised manifest
    // server from triggering arbitrary postinstall scripts.
    if (manifest?.manifest.postinstall_allowlist?.length) {
      const requested = manifest.manifest.postinstall_allowlist
      const approved = requested.filter(pkg => SAFE_REBUILD_PACKAGES.has(pkg))
      const rejected = requested.filter(pkg => !SAFE_REBUILD_PACKAGES.has(pkg))
      if (rejected.length > 0) {
        console.warn(`[tokenforgood] Ignoring unknown postinstall packages: ${rejected.join(', ')}`)
      }
      if (approved.length > 0) {
        console.log(`[tokenforgood] Rebuilding allowlisted packages: ${approved.join(', ')}`)
        for (const pkg of approved) {
          await execDockerExec(containerId, ['npm', 'rebuild', pkg])
        }
      }
    }

    // Step 14: Wait for agent to finish (or timeout)
    console.log(`[tokenforgood] Agent working... (timeout: 90 minutes)`)
    const { exitCode, timedOut } = await waitForExit(containerId, TIMEOUT_MS)

    if (timedOut) {
      console.error('[tokenforgood] Agent exceeded 90-minute time limit. Partial log exported.')
      logger.append({ type: 'error', data: { message: 'Agent timeout', timeoutMs: TIMEOUT_MS } })
      await unclaimTask(taskId, claimToken, 'Agent exceeded time limit')
    } else if (exitCode !== 0) {
      console.error(`[tokenforgood] Agent exited with code ${exitCode}.`)
      logger.append({ type: 'error', data: { message: 'Agent non-zero exit', exitCode } })
    }

    // Step 15: Pre-PR status check (sleep/reconnect race)
    if (exitCode === 0 && !timedOut) {
      console.log('[tokenforgood] Checking task ownership before PR...')
      const status = await fetchTaskStatus(taskId)
      if (status.claimed_by !== claimToken) {
        console.error('[tokenforgood] Task has been re-claimed by another donor. Skipping PR.')
        logger.append({ type: 'error', data: { message: 'Task re-claimed', claimed_by: status.claimed_by } })
        return
      }
    }

    // Step 16: Export log
    const logDestDir = process.cwd()
    console.log(`[tokenforgood] Exporting execution log to ${logDestDir}/`)
    logger.close()
    logger = null

    // Step 17: Report result
    if (exitCode === 0 && !timedOut) {
      console.log(`[tokenforgood] Task completed successfully!`)
      console.log(`[tokenforgood] Mark this task complete at: ${APP_URL}/tasks/${taskId}`)
    }
  } catch (err) {
    if (err instanceof LogCapExceededError) {
      console.error(`[tokenforgood] ${err.message}`)
      if (containerId) {
        // Hard kill the container
        const { teardown: teardownContainer } = await import('../sandbox/docker.js')
        await teardownContainer(containerId, '/workspace/.tokenforgood/execution.jsonl', join(process.cwd(), 'execution.jsonl'))
      }
      await unclaimTask(taskId, claimToken, 'Execution log exceeded 50MB cap')
    } else {
      throw err
    }
  } finally {
    // Cleanup
    clearInterval(heartbeatInterval)
    if (logger) logger.close()
    if (containerId) {
      try {
        await teardown(containerId, '/workspace/.tokenforgood/execution.jsonl', join(process.cwd(), 'execution.jsonl'))
      } catch { /* best-effort */ }
    }
    if (networkHandle) {
      try { await teardownNetwork(networkHandle) } catch { /* best-effort */ }
    }
    if (broker) {
      try { await broker.stop() } catch { /* best-effort */ }
    }
    if (tmpWorkDir) {
      try { await rm(tmpWorkDir, { recursive: true, force: true }) } catch { /* best-effort */ }
    }
    console.log('[tokenforgood] Cleanup complete.')
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveClaudeBinary(): Promise<string> {
  // Try `which claude` first
  try {
    const { stdout } = await execFileAsync('which', ['claude'])
    const path = stdout.trim()
    if (path && existsSync(path)) return path
  } catch { /* not found via which */ }

  // Common install locations
  const candidates = [
    '/usr/local/bin/claude',
    join(homedir(), '.claude', 'bin', 'claude'),
    join(homedir(), '.local', 'bin', 'claude'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  throw new Error(
    'Claude Code binary not found. Install it from https://docs.anthropic.com/en/docs/claude-code'
  )
}

function resolveClaudeAuthFile(): string {
  // Claude stores auth credentials in ~/.claude/
  const authDir = join(homedir(), '.claude')
  const candidates = ['credentials.json', 'auth.json', '.credentials']
  for (const name of candidates) {
    const path = join(authDir, name)
    if (existsSync(path)) return path
  }
  // Fall back to the directory itself — docker cp will copy it
  return authDir
}

async function execDockerExec(containerId: string, cmd: string[]): Promise<void> {
  try {
    await execFileAsync('docker', ['exec', containerId, ...cmd])
  } catch {
    // Non-fatal — package rebuild failures are logged but don't block execution
  }
}
