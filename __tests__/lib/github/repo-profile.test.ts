import { describe, it, expect } from 'vitest'
import { parseGitHubIssueUrl } from '@/lib/github/url'

// ---------------------------------------------------------------------------
// parseGitHubIssueUrl — valid URLs
// ---------------------------------------------------------------------------

describe('parseGitHubIssueUrl — valid URLs', () => {
  it('parses a standard GitHub issue URL', () => {
    const result = parseGitHubIssueUrl('https://github.com/vercel/next.js/issues/12345')
    expect(result).toEqual({ owner: 'vercel', repo: 'next.js', issueNumber: 12345 })
  })

  it('parses an issue URL with a simple owner and repo', () => {
    const result = parseGitHubIssueUrl('https://github.com/owner/repo/issues/1')
    expect(result).toEqual({ owner: 'owner', repo: 'repo', issueNumber: 1 })
  })

  it('parses an issue URL with hyphens in owner and repo names', () => {
    const result = parseGitHubIssueUrl('https://github.com/my-org/my-repo/issues/99')
    expect(result).toEqual({ owner: 'my-org', repo: 'my-repo', issueNumber: 99 })
  })

  it('parses an issue URL with numbers in owner and repo names', () => {
    const result = parseGitHubIssueUrl('https://github.com/org123/repo456/issues/7')
    expect(result).toEqual({ owner: 'org123', repo: 'repo456', issueNumber: 7 })
  })

  it('parses a URL that has a trailing slash after the issue number', () => {
    const result = parseGitHubIssueUrl('https://github.com/owner/repo/issues/10/')
    expect(result).toEqual({ owner: 'owner', repo: 'repo', issueNumber: 10 })
  })

  it('returns issueNumber as a number, not a string', () => {
    const result = parseGitHubIssueUrl('https://github.com/owner/repo/issues/9999')
    expect(result?.issueNumber).toBe(9999)
  })

  it('parses a large issue number correctly', () => {
    const result = parseGitHubIssueUrl('https://github.com/microsoft/vscode/issues/123456')
    expect(result).toEqual({ owner: 'microsoft', repo: 'vscode', issueNumber: 123456 })
  })

  it('parses when the URL appears mid-string (non-anchored regex)', () => {
    const result = parseGitHubIssueUrl(
      'See https://github.com/owner/repo/issues/5 for more details.'
    )
    expect(result).toEqual({ owner: 'owner', repo: 'repo', issueNumber: 5 })
  })
})

// ---------------------------------------------------------------------------
// parseGitHubIssueUrl — invalid URLs (should return null)
// ---------------------------------------------------------------------------

describe('parseGitHubIssueUrl — invalid URLs return null', () => {
  it('returns null for an empty string', () => {
    expect(parseGitHubIssueUrl('')).toBeNull()
  })

  it('returns null for a PR URL (pull not issues)', () => {
    expect(parseGitHubIssueUrl('https://github.com/owner/repo/pull/42')).toBeNull()
  })

  it('returns null for a non-GitHub URL', () => {
    expect(parseGitHubIssueUrl('https://gitlab.com/owner/repo/issues/1')).toBeNull()
  })

  it('returns null for a GitHub repo URL without a path', () => {
    expect(parseGitHubIssueUrl('https://github.com/owner/repo')).toBeNull()
  })

  it('returns null for a GitHub issues list URL (no number)', () => {
    expect(parseGitHubIssueUrl('https://github.com/owner/repo/issues')).toBeNull()
  })

  it('returns null for a completely unrelated URL', () => {
    expect(parseGitHubIssueUrl('https://example.com/foo/bar')).toBeNull()
  })

  it('returns null for a malformed URL missing the repo segment', () => {
    expect(parseGitHubIssueUrl('https://github.com/owner/issues/1')).toBeNull()
  })

  it('returns null for a URL with a non-numeric issue segment', () => {
    expect(parseGitHubIssueUrl('https://github.com/owner/repo/issues/abc')).toBeNull()
  })

  it('returns null for a plain string with no URL', () => {
    expect(parseGitHubIssueUrl('not a url at all')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseGitHubIssueUrl — return value structure
// ---------------------------------------------------------------------------

describe('parseGitHubIssueUrl — return value structure', () => {
  it('returns an object with exactly the owner, repo, and issueNumber keys', () => {
    const result = parseGitHubIssueUrl('https://github.com/acme/widget/issues/3')
    expect(result).not.toBeNull()
    expect(Object.keys(result!)).toEqual(
      expect.arrayContaining(['owner', 'repo', 'issueNumber'])
    )
    expect(Object.keys(result!)).toHaveLength(3)
  })
})
