import { describe, it, expect } from 'vitest'
import { generateCLICommand, generateSingleTaskCommand } from '@/lib/prompt/cli-command'

// ---------------------------------------------------------------------------
// generateCLICommand
// ---------------------------------------------------------------------------

describe('generateCLICommand', () => {
  it('generates correct command for a single task ID', () => {
    expect(generateCLICommand(['abc123'])).toBe('npx tokenforgood run abc123')
  })

  it('generates correct command for multiple task IDs', () => {
    expect(generateCLICommand(['abc123', 'def456', 'ghi789'])).toBe(
      'npx tokenforgood run abc123 def456 ghi789'
    )
  })

  it('generates command for two task IDs', () => {
    expect(generateCLICommand(['id-one', 'id-two'])).toBe(
      'npx tokenforgood run id-one id-two'
    )
  })

  it('handles empty array by returning base command with trailing space', () => {
    // join('') on [] produces '' so output is 'npx tokenforgood run '
    const result = generateCLICommand([])
    expect(result).toBe('npx tokenforgood run ')
  })

  it('always starts with the expected base command', () => {
    const result = generateCLICommand(['some-id'])
    expect(result.startsWith('npx tokenforgood run ')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// generateSingleTaskCommand
// ---------------------------------------------------------------------------

describe('generateSingleTaskCommand', () => {
  it('returns the correct command for a given task ID', () => {
    expect(generateSingleTaskCommand('abc123')).toBe('npx tokenforgood run abc123')
  })

  it('works with any string task ID', () => {
    expect(generateSingleTaskCommand('task-42')).toBe('npx tokenforgood run task-42')
  })

  it('always starts with the expected base command', () => {
    const result = generateSingleTaskCommand('xyz')
    expect(result.startsWith('npx tokenforgood run ')).toBe(true)
  })

  it('produces the same result as generateCLICommand with a single-element array', () => {
    const id = 'some-task-id'
    expect(generateSingleTaskCommand(id)).toBe(generateCLICommand([id]))
  })
})
