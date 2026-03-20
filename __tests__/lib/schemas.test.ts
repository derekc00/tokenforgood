import { describe, it, expect } from 'vitest'
import {
  CompleteTaskSchema,
  GitHubIssueUrlSchema,
  GitHubPRUrlSchema,
} from '@/lib/schemas'

// ---------------------------------------------------------------------------
// GitHubIssueUrlSchema
// ---------------------------------------------------------------------------

describe('GitHubIssueUrlSchema — valid URLs', () => {
  it('accepts a standard GitHub issue URL', () => {
    expect(() =>
      GitHubIssueUrlSchema.parse('https://github.com/owner/repo/issues/1')
    ).not.toThrow()
  })

  it('accepts an issue URL with hyphens in owner and repo', () => {
    expect(() =>
      GitHubIssueUrlSchema.parse('https://github.com/my-org/my-repo/issues/42')
    ).not.toThrow()
  })

  it('accepts an issue URL with dots in the repo name', () => {
    expect(() =>
      GitHubIssueUrlSchema.parse('https://github.com/vercel/next.js/issues/99')
    ).not.toThrow()
  })

  it('accepts an issue URL with a large issue number', () => {
    expect(() =>
      GitHubIssueUrlSchema.parse('https://github.com/microsoft/vscode/issues/123456')
    ).not.toThrow()
  })

  it('returns the original URL string when valid', () => {
    const url = 'https://github.com/owner/repo/issues/5'
    expect(GitHubIssueUrlSchema.parse(url)).toBe(url)
  })
})

describe('GitHubIssueUrlSchema — invalid URLs', () => {
  it('rejects a PR URL', () => {
    expect(() =>
      GitHubIssueUrlSchema.parse('https://github.com/owner/repo/pull/1')
    ).toThrow()
  })

  it('rejects a non-GitHub URL', () => {
    expect(() =>
      GitHubIssueUrlSchema.parse('https://gitlab.com/owner/repo/issues/1')
    ).toThrow()
  })

  it('rejects a GitHub issue URL with a trailing slash', () => {
    expect(() =>
      GitHubIssueUrlSchema.parse('https://github.com/owner/repo/issues/1/')
    ).toThrow()
  })

  it('rejects a URL missing the issue number', () => {
    expect(() =>
      GitHubIssueUrlSchema.parse('https://github.com/owner/repo/issues')
    ).toThrow()
  })

  it('rejects a plain string (not a URL)', () => {
    expect(() => GitHubIssueUrlSchema.parse('not-a-url')).toThrow()
  })

  it('rejects an empty string', () => {
    expect(() => GitHubIssueUrlSchema.parse('')).toThrow()
  })

  it('provides a helpful error message on failure', () => {
    const result = GitHubIssueUrlSchema.safeParse('https://example.com/issues/1')
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ')
      expect(messages).toMatch(/github/i)
    }
  })
})

// ---------------------------------------------------------------------------
// GitHubPRUrlSchema
// ---------------------------------------------------------------------------

describe('GitHubPRUrlSchema — valid URLs', () => {
  it('accepts a standard GitHub PR URL', () => {
    expect(() =>
      GitHubPRUrlSchema.parse('https://github.com/owner/repo/pull/1')
    ).not.toThrow()
  })

  it('accepts a PR URL with hyphens and dots in names', () => {
    expect(() =>
      GitHubPRUrlSchema.parse('https://github.com/my-org/next.js/pull/42')
    ).not.toThrow()
  })

  it('accepts a PR URL with a large PR number', () => {
    expect(() =>
      GitHubPRUrlSchema.parse('https://github.com/microsoft/vscode/pull/99999')
    ).not.toThrow()
  })

  it('returns the original URL string when valid', () => {
    const url = 'https://github.com/owner/repo/pull/7'
    expect(GitHubPRUrlSchema.parse(url)).toBe(url)
  })
})

describe('GitHubPRUrlSchema — invalid URLs', () => {
  it('rejects a GitHub issue URL (issues not pull)', () => {
    expect(() =>
      GitHubPRUrlSchema.parse('https://github.com/owner/repo/issues/1')
    ).toThrow()
  })

  it('rejects a non-GitHub URL', () => {
    expect(() =>
      GitHubPRUrlSchema.parse('https://gitlab.com/owner/repo/pull/1')
    ).toThrow()
  })

  it('rejects a PR URL with a trailing slash', () => {
    expect(() =>
      GitHubPRUrlSchema.parse('https://github.com/owner/repo/pull/1/')
    ).toThrow()
  })

  it('rejects a plain string', () => {
    expect(() => GitHubPRUrlSchema.parse('not-a-url')).toThrow()
  })

  it('rejects an empty string', () => {
    expect(() => GitHubPRUrlSchema.parse('')).toThrow()
  })

  it('provides a helpful error message on failure', () => {
    const result = GitHubPRUrlSchema.safeParse('https://example.com/pull/1')
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ')
      expect(messages).toMatch(/github/i)
    }
  })
})

// ---------------------------------------------------------------------------
// CompleteTaskSchema — .refine() cross-field validation
// ---------------------------------------------------------------------------

describe('CompleteTaskSchema — accepts valid objects', () => {
  it('accepts an object with only pr_url present', () => {
    const result = CompleteTaskSchema.safeParse({
      pr_url: 'https://github.com/owner/repo/pull/1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an object with only issue_comment_url present', () => {
    const result = CompleteTaskSchema.safeParse({
      issue_comment_url: 'https://github.com/owner/repo/issues/1#issuecomment-123456',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an object with both pr_url and issue_comment_url present', () => {
    const result = CompleteTaskSchema.safeParse({
      pr_url: 'https://github.com/owner/repo/pull/1',
      issue_comment_url: 'https://github.com/owner/repo/issues/1#issuecomment-123456',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a fully populated valid object', () => {
    const result = CompleteTaskSchema.safeParse({
      pr_url: 'https://github.com/owner/repo/pull/5',
      issue_comment_url: 'https://github.com/owner/repo/issues/1#issuecomment-789',
      input_tokens: 500,
      output_tokens: 1200,
      ai_provider: 'claude-pro',
      ai_model: 'sonnet',
    })
    expect(result.success).toBe(true)
  })

  // issue_comment_url accepts any valid URL (not restricted to GitHub)
  it('accepts a non-GitHub issue_comment_url', () => {
    const result = CompleteTaskSchema.safeParse({
      issue_comment_url: 'https://example.com/comment/1',
    })
    expect(result.success).toBe(true)
  })
})

describe('CompleteTaskSchema — rejects invalid objects', () => {
  it('rejects an object with neither pr_url nor issue_comment_url', () => {
    const result = CompleteTaskSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('provides the expected error message when neither URL field is present', () => {
    const result = CompleteTaskSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ')
      expect(messages).toMatch(/pr url|issue comment url/i)
    }
  })

  it('rejects an object with an invalid pr_url format (issue URL in pr_url field)', () => {
    const result = CompleteTaskSchema.safeParse({
      pr_url: 'https://github.com/owner/repo/issues/1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an object with a non-URL issue_comment_url', () => {
    const result = CompleteTaskSchema.safeParse({
      issue_comment_url: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative input_tokens', () => {
    const result = CompleteTaskSchema.safeParse({
      pr_url: 'https://github.com/owner/repo/pull/1',
      input_tokens: -5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero input_tokens (must be positive, not just non-negative)', () => {
    const result = CompleteTaskSchema.safeParse({
      pr_url: 'https://github.com/owner/repo/pull/1',
      input_tokens: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unrecognised ai_provider value', () => {
    const result = CompleteTaskSchema.safeParse({
      pr_url: 'https://github.com/owner/repo/pull/1',
      ai_provider: 'unknown-provider',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unrecognised ai_model value', () => {
    const result = CompleteTaskSchema.safeParse({
      pr_url: 'https://github.com/owner/repo/pull/1',
      ai_model: 'gpt-999',
    })
    expect(result.success).toBe(false)
  })
})
