// ---------------------------------------------------------------------------
// parseGitHubIssueUrl
// ---------------------------------------------------------------------------

/**
 * Parse a GitHub issue URL and return the owner, repo name, and issue number.
 * Returns `null` when the URL does not match the expected format.
 *
 * This module is intentionally dependency-free so it can be safely imported
 * from client components without crossing the server/client boundary.
 *
 * @example
 * parseGitHubIssueUrl('https://github.com/vercel/next.js/issues/12345')
 * // => { owner: 'vercel', repo: 'next.js', issueNumber: 12345 }
 */
export function parseGitHubIssueUrl(url: string): {
  owner: string
  repo: string
  issueNumber: number
} | null {
  const match = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)/)
  if (!match) return null
  return {
    owner: match[1],
    repo: match[2],
    issueNumber: parseInt(match[3], 10),
  }
}
