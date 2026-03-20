import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseOptions, runCommand } from '../../../packages/cli/src/commands/run.js'

// ---------------------------------------------------------------------------
// parseOptions — default values
// ---------------------------------------------------------------------------

describe('parseOptions — defaults', () => {
  it('returns empty taskIds when no args are passed', () => {
    const { taskIds } = parseOptions([])
    expect(taskIds).toEqual([])
  })

  it('returns all options as false/null by default', () => {
    const { options } = parseOptions([])
    expect(options.noContainer).toBe(false)
    expect(options.verbose).toBe(false)
    expect(options.dryRun).toBe(false)
    expect(options.full).toBe(false)
    expect(options.githubToken).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseOptions — individual flags
// ---------------------------------------------------------------------------

describe('parseOptions — --no-container', () => {
  it('sets noContainer to true', () => {
    const { options } = parseOptions(['--no-container'])
    expect(options.noContainer).toBe(true)
  })

  it('does not affect other options', () => {
    const { options } = parseOptions(['--no-container'])
    expect(options.verbose).toBe(false)
    expect(options.dryRun).toBe(false)
    expect(options.full).toBe(false)
    expect(options.githubToken).toBeNull()
  })
})

describe('parseOptions — --verbose', () => {
  it('sets verbose to true', () => {
    const { options } = parseOptions(['--verbose'])
    expect(options.verbose).toBe(true)
  })

  it('does not affect other options', () => {
    const { options } = parseOptions(['--verbose'])
    expect(options.noContainer).toBe(false)
    expect(options.dryRun).toBe(false)
    expect(options.full).toBe(false)
    expect(options.githubToken).toBeNull()
  })
})

describe('parseOptions — --dry-run', () => {
  it('sets dryRun to true', () => {
    const { options } = parseOptions(['--dry-run'])
    expect(options.dryRun).toBe(true)
  })

  it('does not affect other options', () => {
    const { options } = parseOptions(['--dry-run'])
    expect(options.noContainer).toBe(false)
    expect(options.verbose).toBe(false)
    expect(options.full).toBe(false)
    expect(options.githubToken).toBeNull()
  })
})

describe('parseOptions — --full', () => {
  it('sets full to true', () => {
    const { options } = parseOptions(['--full'])
    expect(options.full).toBe(true)
  })

  it('does not affect other options', () => {
    const { options } = parseOptions(['--full'])
    expect(options.noContainer).toBe(false)
    expect(options.verbose).toBe(false)
    expect(options.dryRun).toBe(false)
    expect(options.githubToken).toBeNull()
  })
})

describe('parseOptions — --github-token', () => {
  it('captures the token value from the next argument', () => {
    const { options } = parseOptions(['--github-token', 'ghp_abc123'])
    expect(options.githubToken).toBe('ghp_abc123')
  })

  it('sets githubToken to null when no value follows the flag', () => {
    // args[++i] when i is the last index yields undefined, coerced to null
    const { options } = parseOptions(['--github-token'])
    expect(options.githubToken).toBeNull()
  })

  it('does not treat the token value as a task ID', () => {
    const { taskIds } = parseOptions(['--github-token', 'ghp_abc123'])
    expect(taskIds).toEqual([])
  })

  it('does not affect other options', () => {
    const { options } = parseOptions(['--github-token', 'tok'])
    expect(options.noContainer).toBe(false)
    expect(options.verbose).toBe(false)
    expect(options.dryRun).toBe(false)
    expect(options.full).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// parseOptions — task IDs
// ---------------------------------------------------------------------------

describe('parseOptions — task IDs', () => {
  it('collects a single non-flag argument as a task ID', () => {
    const { taskIds } = parseOptions(['task-42'])
    expect(taskIds).toEqual(['task-42'])
  })

  it('collects multiple non-flag arguments as task IDs', () => {
    const { taskIds } = parseOptions(['task-1', 'task-2', 'task-3'])
    expect(taskIds).toEqual(['task-1', 'task-2', 'task-3'])
  })

  it('ignores known flags when collecting task IDs', () => {
    const { taskIds } = parseOptions(['--verbose', 'task-99', '--dry-run'])
    expect(taskIds).toEqual(['task-99'])
  })
})

// ---------------------------------------------------------------------------
// parseOptions — flag combinations
// ---------------------------------------------------------------------------

describe('parseOptions — flag combinations', () => {
  it('handles multiple boolean flags together', () => {
    const { options } = parseOptions(['--no-container', '--verbose', '--dry-run', '--full'])
    expect(options.noContainer).toBe(true)
    expect(options.verbose).toBe(true)
    expect(options.dryRun).toBe(true)
    expect(options.full).toBe(true)
    expect(options.githubToken).toBeNull()
  })

  it('handles flags mixed with task IDs in any order', () => {
    const { taskIds, options } = parseOptions([
      'task-a',
      '--verbose',
      'task-b',
      '--github-token',
      'tok123',
      '--dry-run',
    ])
    expect(taskIds).toEqual(['task-a', 'task-b'])
    expect(options.verbose).toBe(true)
    expect(options.dryRun).toBe(true)
    expect(options.githubToken).toBe('tok123')
  })

  it('handles --github-token combined with boolean flags', () => {
    const { options } = parseOptions(['--full', '--github-token', 'my-token', '--no-container'])
    expect(options.full).toBe(true)
    expect(options.githubToken).toBe('my-token')
    expect(options.noContainer).toBe(true)
  })

  it('handles repeated task IDs with all flags set', () => {
    const { taskIds, options } = parseOptions([
      '--no-container',
      '--verbose',
      '--full',
      '--github-token',
      'tok',
      'id-1',
      'id-2',
    ])
    expect(taskIds).toEqual(['id-1', 'id-2'])
    expect(options.noContainer).toBe(true)
    expect(options.verbose).toBe(true)
    expect(options.full).toBe(true)
    expect(options.githubToken).toBe('tok')
  })
})

// ---------------------------------------------------------------------------
// runCommand — dry-run path (no network calls)
// ---------------------------------------------------------------------------

describe('runCommand — dry-run path', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns without throwing when dry-run is set and task IDs are provided', async () => {
    await expect(
      runCommand(['task-1', '--dry-run'])
    ).resolves.toBeUndefined()
  })

  it('logs each task ID during dry-run', async () => {
    await runCommand(['task-abc', 'task-def', '--dry-run'])
    const logCalls = (console.log as ReturnType<typeof vi.spyOn>).mock.calls
      .map((args) => args.join(' '))
    expect(logCalls.some((line) => line.includes('task-abc'))).toBe(true)
    expect(logCalls.some((line) => line.includes('task-def'))).toBe(true)
  })

  it('logs a dry-run indicator message', async () => {
    await runCommand(['task-1', '--dry-run'])
    const logCalls = (console.log as ReturnType<typeof vi.spyOn>).mock.calls
      .map((args) => args.join(' '))
    expect(logCalls.some((line) => line.includes('dry-run'))).toBe(true)
  })

  it('does not make network calls during dry-run', async () => {
    // If network calls were made, global fetch would be invoked.
    // We spy on global fetch to confirm it is never called.
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await runCommand(['task-xyz', '--dry-run'])
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
