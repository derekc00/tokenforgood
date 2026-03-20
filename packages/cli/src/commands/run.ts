import {
  fetchTask,
  claimTask,
  startHeartbeat,
  type TaskResponse,
} from '../services/api.js'

export interface RunOptions {
  noContainer: boolean
  verbose: boolean
  dryRun: boolean
  githubToken: string | null
  full: boolean
}

// Sandbox handle — extended in future phases when real sandboxing is wired up
interface SandboxHandle {
  workdir: string
  mode: 'safe' | 'full'
}

function parseOptions(args: string[]): { taskIds: string[]; options: RunOptions } {
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
    else if (arg === '--github-token') options.githubToken = args[++i] ?? null
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

  if (options.dryRun) {
    console.log('[dry-run] Would run the following tasks:')
    for (const id of taskIds) {
      console.log(`  - Task ${id}`)
    }
    return
  }

  for (const taskId of taskIds) {
    await runSingleTask(taskId, options)
  }
}

async function runSingleTask(taskId: string, options: RunOptions): Promise<void> {
  console.log(`\n[tokenforgood] Starting task ${taskId}`)

  // Step 1: Fetch task details
  console.log('[tokenforgood] Fetching task details...')
  const task = await fetchTask(taskId)
  if (options.verbose) {
    console.log(`[tokenforgood]   Title: ${task.github_issue_title}`)
    console.log(`[tokenforgood]   Repo:  ${task.repo_full_name}`)
    console.log(`[tokenforgood]   Type:  ${task.task_type}`)
  }

  // Step 2: Claim task
  console.log('[tokenforgood] Claiming task...')
  const { claimToken } = await claimTask(
    taskId,
    options.githubToken ?? undefined,
  )

  // Step 3: Start heartbeat loop
  console.log('[tokenforgood] Starting heartbeat...')
  const heartbeatInterval = startHeartbeat(taskId, claimToken)

  try {
    // Step 4: Set up sandbox
    if (options.verbose) console.log('[tokenforgood] Setting up sandbox...')
    const sandbox = await setupSandbox(task, options)

    // Step 5: Launch Claude Code
    console.log('[tokenforgood] Launching Claude Code...')
    await runClaudeCode(task, sandbox, options)

    // Step 6: Open draft PR
    console.log('[tokenforgood] Opening draft PR...')
    const prUrl = await openDraftPR(task, sandbox)

    console.log(`[tokenforgood] Done! Draft PR: ${prUrl}`)
    console.log(`[tokenforgood] Mark this task complete at: https://tokenforgood.dev/tasks/${taskId}`)
  } finally {
    clearInterval(heartbeatInterval)
    console.log('[tokenforgood] Heartbeat stopped')
  }
}

// ---------------------------------------------------------------------------
// Placeholder implementations — replaced in future phases
// ---------------------------------------------------------------------------

async function setupSandbox(
  task: TaskResponse,
  options: RunOptions,
): Promise<SandboxHandle> {
  const mode = options.full ? 'full' : 'safe'
  console.log(`[tokenforgood] Setting up isolated workspace... (mode: ${mode}, repo: ${task.repo_full_name})`)
  // TODO: clone repo, write .claude/settings.json from sandbox/settings.ts,
  //       optionally spin up Docker container when --no-container is not set.
  return { workdir: `/tmp/tokenforgood/${task.id}`, mode }
}

async function runClaudeCode(
  task: TaskResponse,
  sandbox: SandboxHandle,
  options: RunOptions,
): Promise<void> {
  console.log(`[tokenforgood] Running Claude Code with ${sandbox.mode === 'safe' ? 'Safe' : 'Full'} Mode permissions...`)
  if (options.verbose) {
    console.log(`[tokenforgood]   Workdir: ${sandbox.workdir}`)
    console.log(`[tokenforgood]   Issue:   ${task.github_issue_url}`)
  }
  // TODO: spawn `claude --dangerously-skip-permissions` (or equivalent) inside
  //       the sandbox workdir, passing the task prompt derived from the issue.
}

async function openDraftPR(
  task: TaskResponse,
  _sandbox: SandboxHandle,
): Promise<string> {
  // TODO: push branch from sandbox workdir, call GitHub API to open draft PR
  return `https://github.com/${task.repo_full_name}/pull/1`
}
