import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_LOG_SIZE_BYTES = 50 * 1024 * 1024 // 50MB
const MAX_STDOUT_CHUNK_BYTES = 10 * 1024 // 10KB
const TRUNCATION_MARKER = '... [truncated to 10KB]'

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/** A single entry written to the JSONL execution log. */
export interface LogEntry {
  /** ISO 8601 timestamp added automatically on append. */
  timestamp: string
  type:
    | 'tool_call'
    | 'tool_result'
    | 'stdout'
    | 'stderr'
    | 'classifier_decision'
    | 'file_diff'
    | 'error'
    | 'info'
  data: Record<string, unknown>
}

/** Append-only JSONL execution logger. */
export interface ExecutionLogger {
  /**
   * Append a log entry.
   * Throws {@link LogCapExceededError} if writing would exceed the 50 MB cap.
   */
  append(entry: Omit<LogEntry, 'timestamp'>): void
  /** Current tracked log size in bytes. */
  size(): number
  /** Close the underlying file descriptor. */
  close(): void
  /** Absolute path to the log file. */
  readonly path: string
}

/** Thrown when the execution log would exceed the 50 MB hard cap. */
export class LogCapExceededError extends Error {
  constructor(public readonly currentSizeBytes: number) {
    super(
      `Execution log exceeded 50MB cap (${(currentSizeBytes / 1024 / 1024).toFixed(1)}MB). Task terminated.`,
    )
    this.name = 'LogCapExceededError'
  }
}

// ---------------------------------------------------------------------------
// createLogger
// ---------------------------------------------------------------------------

/**
 * Create an append-only JSONL execution logger.
 *
 * @param logDir   Directory in which to create the log file (created recursively if absent).
 * @param filename Name of the log file (defaults to `execution.jsonl`).
 * @returns        An {@link ExecutionLogger} instance.
 */
export function createLogger(
  logDir: string,
  filename: string = 'execution.jsonl',
): ExecutionLogger {
  fs.mkdirSync(logDir, { recursive: true })

  const logPath = path.join(logDir, filename)

  // Open in append mode; if file already exists, track its current size.
  const fd = fs.openSync(logPath, 'a')
  let currentSize = 0
  try {
    currentSize = fs.statSync(logPath).size
  } catch {
    // File did not exist yet; size stays 0.
  }

  return {
    path: logPath,

    size(): number {
      return currentSize
    },

    append(entry: Omit<LogEntry, 'timestamp'>): void {
      const fullEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        ...entry,
      }

      // Truncate stdout / stderr content if it exceeds 10 KB.
      if (
        (fullEntry.type === 'stdout' || fullEntry.type === 'stderr') &&
        typeof fullEntry.data['content'] === 'string'
      ) {
        const content = fullEntry.data['content'] as string
        const contentBytes = Buffer.byteLength(content, 'utf8')
        if (contentBytes > MAX_STDOUT_CHUNK_BYTES) {
          // Slice to MAX_STDOUT_CHUNK_BYTES bytes, then append marker.
          const truncated = Buffer.from(content, 'utf8')
            .subarray(0, MAX_STDOUT_CHUNK_BYTES)
            .toString('utf8')
          fullEntry.data = { ...fullEntry.data, content: truncated + TRUNCATION_MARKER }
        }
      }

      const line = JSON.stringify(fullEntry) + '\n'
      const lineBytes = Buffer.byteLength(line, 'utf8')

      // Hard cap check — throw BEFORE writing.
      if (currentSize + lineBytes > MAX_LOG_SIZE_BYTES) {
        throw new LogCapExceededError(currentSize)
      }

      fs.writeSync(fd, line)
      currentSize += lineBytes
    },

    close(): void {
      try {
        fs.closeSync(fd)
      } catch {
        // Ignore double-close errors.
      }
    },
  }
}

// ---------------------------------------------------------------------------
// exportLog
// ---------------------------------------------------------------------------

/**
 * Copy a container execution log to a host destination directory.
 *
 * If the source file does not exist (e.g. the agent crashed before writing
 * any entries), a minimal JSONL file is created at the destination with a
 * single error entry describing the absence.
 *
 * @param containerLogPath Absolute path to the log file inside the container.
 * @param hostDestDir      Host directory that will receive the copied log.
 * @returns                Absolute path to the copied file in `hostDestDir`.
 */
export function exportLog(containerLogPath: string, hostDestDir: string): string {
  fs.mkdirSync(hostDestDir, { recursive: true })

  const destPath = path.join(hostDestDir, path.basename(containerLogPath))

  if (fs.existsSync(containerLogPath)) {
    fs.copyFileSync(containerLogPath, destPath)
  } else {
    // Agent may have crashed before producing any output — write a sentinel entry.
    const fallbackEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'error',
      data: {
        message:
          'Log file not found (agent may have crashed before any tool calls)',
        containerLogPath,
      },
    }
    fs.writeFileSync(destPath, JSON.stringify(fallbackEntry) + '\n', 'utf8')
  }

  return destPath
}
