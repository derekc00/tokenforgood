import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createLogger, exportLog, LogCapExceededError } from '../../../../packages/cli/src/sandbox/execution-log.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDirs: string[] = []

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfg-exec-log-test-'))
  tmpDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tmpDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  }
  tmpDirs = []
})

// ---------------------------------------------------------------------------
// createLogger — directory and file creation
// ---------------------------------------------------------------------------

describe('createLogger — directory and file creation', () => {
  it('creates the log directory when it does not exist', () => {
    const base = makeTmpDir()
    const logDir = path.join(base, 'nested', 'logs')

    expect(fs.existsSync(logDir)).toBe(false)
    createLogger(logDir)
    expect(fs.existsSync(logDir)).toBe(true)
  })

  it('creates the log file in the specified directory', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)
    logger.close()

    expect(fs.existsSync(logger.path)).toBe(true)
  })

  it('uses execution.jsonl as the default filename', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)
    logger.close()

    expect(path.basename(logger.path)).toBe('execution.jsonl')
  })

  it('respects a custom filename', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir, 'custom.jsonl')
    logger.close()

    expect(path.basename(logger.path)).toBe('custom.jsonl')
  })

  it('returns the correct absolute path', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)
    logger.close()

    expect(logger.path).toBe(path.join(logDir, 'execution.jsonl'))
  })
})

// ---------------------------------------------------------------------------
// append — valid JSONL entries
// ---------------------------------------------------------------------------

describe('append — valid JSONL entries', () => {
  it('writes a valid JSON line to the file', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)

    logger.append({ type: 'info', data: { message: 'hello' } })
    logger.close()

    const contents = fs.readFileSync(logger.path, 'utf8')
    const parsed = JSON.parse(contents.trim())
    expect(parsed.type).toBe('info')
    expect(parsed.data.message).toBe('hello')
  })

  it('adds a timestamp field to every entry', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)

    logger.append({ type: 'info', data: {} })
    logger.close()

    const contents = fs.readFileSync(logger.path, 'utf8')
    const parsed = JSON.parse(contents.trim())
    expect(typeof parsed.timestamp).toBe('string')
    // Should be a valid ISO date
    expect(isNaN(Date.parse(parsed.timestamp))).toBe(false)
  })

  it('writes multiple entries as separate lines', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)

    logger.append({ type: 'info', data: { n: 1 } })
    logger.append({ type: 'info', data: { n: 2 } })
    logger.append({ type: 'info', data: { n: 3 } })
    logger.close()

    const lines = fs.readFileSync(logger.path, 'utf8').trim().split('\n')
    expect(lines).toHaveLength(3)
    expect(JSON.parse(lines[0]).data.n).toBe(1)
    expect(JSON.parse(lines[1]).data.n).toBe(2)
    expect(JSON.parse(lines[2]).data.n).toBe(3)
  })

  it('writes entries for all supported types without throwing', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)
    const types = [
      'tool_call',
      'tool_result',
      'stdout',
      'stderr',
      'classifier_decision',
      'file_diff',
      'error',
      'info',
    ] as const

    for (const type of types) {
      expect(() => logger.append({ type, data: {} })).not.toThrow()
    }
    logger.close()
  })
})

// ---------------------------------------------------------------------------
// append — stdout / stderr truncation
// ---------------------------------------------------------------------------

describe('append — stdout truncation', () => {
  it('does not truncate content that is exactly 10KB', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)
    const content = 'a'.repeat(10 * 1024)

    logger.append({ type: 'stdout', data: { content } })
    logger.close()

    const parsed = JSON.parse(fs.readFileSync(logger.path, 'utf8').trim())
    expect(parsed.data.content).toBe(content)
  })

  it('truncates stdout content that exceeds 10KB', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)
    const content = 'b'.repeat(20 * 1024) // 20KB

    logger.append({ type: 'stdout', data: { content } })
    logger.close()

    const parsed = JSON.parse(fs.readFileSync(logger.path, 'utf8').trim())
    expect(parsed.data.content.length).toBeLessThan(content.length)
    expect(parsed.data.content.endsWith('... [truncated to 10KB]')).toBe(true)
  })

  it('appends the truncation marker to oversized stdout', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)
    const content = 'x'.repeat(50 * 1024)

    logger.append({ type: 'stdout', data: { content } })
    logger.close()

    const parsed = JSON.parse(fs.readFileSync(logger.path, 'utf8').trim())
    expect(parsed.data.content).toContain('... [truncated to 10KB]')
  })

  it('truncates stderr content that exceeds 10KB', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)
    const content = 'e'.repeat(20 * 1024)

    logger.append({ type: 'stderr', data: { content } })
    logger.close()

    const parsed = JSON.parse(fs.readFileSync(logger.path, 'utf8').trim())
    expect(parsed.data.content.endsWith('... [truncated to 10KB]')).toBe(true)
  })

  it('does not truncate non-stdout/stderr entries even with large content', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)
    const content = 'z'.repeat(20 * 1024)

    logger.append({ type: 'info', data: { content } })
    logger.close()

    const parsed = JSON.parse(fs.readFileSync(logger.path, 'utf8').trim())
    expect(parsed.data.content).toBe(content)
  })
})

// ---------------------------------------------------------------------------
// append — 50MB cap
// ---------------------------------------------------------------------------

describe('append — 50MB log cap', () => {
  it('throws LogCapExceededError when writing would exceed the 50MB cap', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)

    // Write a large chunk just under the cap by exploiting the internal size
    // counter. We seed the file directly so we do not have to allocate 50MB
    // in the test process itself.
    logger.close()

    // Pre-fill the file to exactly (50MB - 5) bytes so that any append entry
    // (which will be at least a few dozen bytes) will exceed the 50MB cap.
    const targetSize = 50 * 1024 * 1024 - 5
    const almostFull = Buffer.alloc(targetSize, 0x78) // 'x'
    fs.writeFileSync(logger.path, almostFull)

    // Open a fresh logger that will stat the existing file size.
    const seededLogger = createLogger(logDir)

    expect(() =>
      seededLogger.append({ type: 'info', data: { msg: 'cap' } }),
    ).toThrow(LogCapExceededError)

    seededLogger.close()
  })

  it('LogCapExceededError has the correct name', () => {
    const err = new LogCapExceededError(50 * 1024 * 1024)
    expect(err.name).toBe('LogCapExceededError')
  })

  it('LogCapExceededError exposes currentSizeBytes', () => {
    const bytes = 52_428_800
    const err = new LogCapExceededError(bytes)
    expect(err.currentSizeBytes).toBe(bytes)
  })
})

// ---------------------------------------------------------------------------
// size()
// ---------------------------------------------------------------------------

describe('size()', () => {
  it('starts at 0 for a new empty log', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)
    expect(logger.size()).toBe(0)
    logger.close()
  })

  it('increases after each append', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)

    const before = logger.size()
    logger.append({ type: 'info', data: { x: 1 } })
    const after = logger.size()

    expect(after).toBeGreaterThan(before)
    logger.close()
  })

  it('tracks bytes accurately across multiple appends', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)

    logger.append({ type: 'info', data: { a: 1 } })
    logger.append({ type: 'info', data: { b: 2 } })
    logger.close()

    const fileSize = fs.statSync(logger.path).size
    expect(logger.size()).toBe(fileSize)
  })
})

// ---------------------------------------------------------------------------
// close()
// ---------------------------------------------------------------------------

describe('close()', () => {
  it('does not throw on first close', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)
    expect(() => logger.close()).not.toThrow()
  })

  it('does not throw on double close', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)
    logger.close()
    expect(() => logger.close()).not.toThrow()
  })

  it('does not throw on triple close', () => {
    const logDir = makeTmpDir()
    const logger = createLogger(logDir)
    logger.close()
    logger.close()
    expect(() => logger.close()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// exportLog
// ---------------------------------------------------------------------------

describe('exportLog — copies the log file', () => {
  it('copies the log file to the destination directory', () => {
    const logDir = makeTmpDir()
    const destDir = makeTmpDir()
    const logger = createLogger(logDir)
    logger.append({ type: 'info', data: { msg: 'test entry' } })
    logger.close()

    const destPath = exportLog(logger.path, destDir)
    expect(fs.existsSync(destPath)).toBe(true)
  })

  it('returns the absolute path in the destination directory', () => {
    const logDir = makeTmpDir()
    const destDir = makeTmpDir()
    const logger = createLogger(logDir)
    logger.close()

    const destPath = exportLog(logger.path, destDir)
    expect(destPath).toBe(path.join(destDir, path.basename(logger.path)))
  })

  it('destination file contains the same content as the source', () => {
    const logDir = makeTmpDir()
    const destDir = makeTmpDir()
    const logger = createLogger(logDir)
    logger.append({ type: 'info', data: { msg: 'copied content' } })
    logger.close()

    const destPath = exportLog(logger.path, destDir)
    const srcContent = fs.readFileSync(logger.path, 'utf8')
    const dstContent = fs.readFileSync(destPath, 'utf8')
    expect(dstContent).toBe(srcContent)
  })

  it('creates destination directory if it does not exist', () => {
    const logDir = makeTmpDir()
    const base = makeTmpDir()
    const destDir = path.join(base, 'new', 'nested', 'dir')
    const logger = createLogger(logDir)
    logger.close()

    expect(fs.existsSync(destDir)).toBe(false)
    exportLog(logger.path, destDir)
    expect(fs.existsSync(destDir)).toBe(true)
  })
})

describe('exportLog — fallback when source does not exist', () => {
  it('creates a fallback JSONL file when the source path does not exist', () => {
    const base = makeTmpDir()
    const destDir = makeTmpDir()
    const nonExistentPath = path.join(base, 'ghost.jsonl')

    const destPath = exportLog(nonExistentPath, destDir)
    expect(fs.existsSync(destPath)).toBe(true)
  })

  it('fallback file contains a valid JSON error entry', () => {
    const base = makeTmpDir()
    const destDir = makeTmpDir()
    const nonExistentPath = path.join(base, 'ghost.jsonl')

    const destPath = exportLog(nonExistentPath, destDir)
    const contents = fs.readFileSync(destPath, 'utf8')
    const parsed = JSON.parse(contents.trim())
    expect(parsed.type).toBe('error')
    expect(typeof parsed.timestamp).toBe('string')
    expect(parsed.data.containerLogPath).toBe(nonExistentPath)
  })

  it('fallback entry message mentions that the log file was not found', () => {
    const base = makeTmpDir()
    const destDir = makeTmpDir()
    const nonExistentPath = path.join(base, 'missing.jsonl')

    const destPath = exportLog(nonExistentPath, destDir)
    const parsed = JSON.parse(fs.readFileSync(destPath, 'utf8').trim())
    expect(parsed.data.message).toMatch(/not found/i)
  })

  it('uses the source basename for the destination filename', () => {
    const base = makeTmpDir()
    const destDir = makeTmpDir()
    const nonExistentPath = path.join(base, 'special-name.jsonl')

    const destPath = exportLog(nonExistentPath, destDir)
    expect(path.basename(destPath)).toBe('special-name.jsonl')
  })
})
