import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import {
  AIProviderSchema,
  TaskTypeSchema,
  TaskStatusSchema,
} from '@/lib/schemas'
import { createMockDataService } from '@/lib/services/mock-data-service'

// ---------------------------------------------------------------------------
// AIProviderSchema
// ---------------------------------------------------------------------------

describe('AIProviderSchema', () => {
  it('returns the correct AIProvider for a valid provider string', () => {
    expect(AIProviderSchema.parse('claude-max')).toBe('claude-max')
    expect(AIProviderSchema.parse('claude-pro')).toBe('claude-pro')
    expect(AIProviderSchema.parse('chatgpt-pro')).toBe('chatgpt-pro')
    expect(AIProviderSchema.parse('github-copilot')).toBe('github-copilot')
    expect(AIProviderSchema.parse('gemini-advanced')).toBe('gemini-advanced')
  })

  it('throws ZodError when an invalid provider string is passed', () => {
    expect(() => AIProviderSchema.parse('unknown-provider')).toThrow(ZodError)
  })

  it('throws ZodError for an empty string provider', () => {
    expect(() => AIProviderSchema.parse('')).toThrow(ZodError)
  })

  it('throws ZodError for a provider string using underscores (pre-normalisation form)', () => {
    // normaliseProvider converts underscores to hyphens before calling .parse()
    // but the schema itself should reject the raw underscore form
    expect(() => AIProviderSchema.parse('claude_max')).toThrow(ZodError)
  })
})

// ---------------------------------------------------------------------------
// TaskTypeSchema
// ---------------------------------------------------------------------------

describe('TaskTypeSchema', () => {
  it('returns the correct TaskType for a valid task_type string', () => {
    expect(TaskTypeSchema.parse('write-tests')).toBe('write-tests')
    expect(TaskTypeSchema.parse('security-audit')).toBe('security-audit')
    expect(TaskTypeSchema.parse('implement-feature')).toBe('implement-feature')
  })

  it('throws ZodError when an invalid task_type string is passed', () => {
    expect(() => TaskTypeSchema.parse('invalid-task-type')).toThrow(ZodError)
  })

  it('throws ZodError for an empty string task_type', () => {
    expect(() => TaskTypeSchema.parse('')).toThrow(ZodError)
  })
})

// ---------------------------------------------------------------------------
// TaskStatusSchema
// ---------------------------------------------------------------------------

describe('TaskStatusSchema', () => {
  it('returns the correct status for a valid status string', () => {
    expect(TaskStatusSchema.parse('open')).toBe('open')
    expect(TaskStatusSchema.parse('in_progress')).toBe('in_progress')
    expect(TaskStatusSchema.parse('completed')).toBe('completed')
  })

  it('throws ZodError when an invalid status string is passed', () => {
    expect(() => TaskStatusSchema.parse('unknown-status')).toThrow(ZodError)
  })

  it('throws ZodError for an empty string status', () => {
    expect(() => TaskStatusSchema.parse('')).toThrow(ZodError)
  })
})

// ---------------------------------------------------------------------------
// MockDataService — integration: service initialises successfully with valid JSON
// ---------------------------------------------------------------------------

describe('createMockDataService', () => {
  it('initialises without throwing — all mock JSON tasks/profiles pass Zod validation', () => {
    expect(() => createMockDataService()).not.toThrow()
  })

  it('returns tasks with valid typed task_type values', async () => {
    const service = createMockDataService()
    const { data } = await service.getTasks()
    for (const task of data) {
      expect(TaskTypeSchema.options).toContain(task.task_type)
    }
  })

  it('returns tasks with valid typed status values', async () => {
    const service = createMockDataService()
    const { data } = await service.getTasks()
    for (const task of data) {
      expect(TaskStatusSchema.options).toContain(task.status)
    }
  })
})
