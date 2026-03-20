const GITHUB_API = 'https://api.github.com'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitHubRepo {
  full_name: string
  name: string
  owner: { login: string }
  description: string | null
  language: string | null
  default_branch: string
  stargazers_count: number
  size: number
  topics: string[]
  open_issues_count: number
  html_url: string
}

export interface GitHubIssueRaw {
  number: number
  title: string
  body: string | null
  state: string
  labels: Array<{ name: string }>
  created_at: string
  updated_at: string
  html_url: string
}

export interface GitHubFileContent {
  content: string // base64 encoded
  encoding: string
  size: number
}

export interface GitHubPR {
  number: number
  title: string
  html_url: string
  draft: boolean
  state: string
  user: { login: string }
  body: string | null
  head: { sha: string; repo: { full_name: string } }
  base: { sha: string }
  changed_files: number
  diff_url: string
}

export interface GitHubPRChangedFile {
  filename: string
  status: string
  additions: number
  deletions: number
}

// ---------------------------------------------------------------------------
// Auth / headers
// ---------------------------------------------------------------------------

function getGitHubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  return headers
}

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

async function githubFetch(path: string): Promise<Response> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: getGitHubHeaders() })
  return res
}

async function githubFetchJson<T>(path: string): Promise<T> {
  const res = await githubFetch(path)

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `GitHub API error ${res.status} for ${path}${body ? `: ${body}` : ''}`
    )
  }

  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/**
 * Fetch repository metadata.
 */
export async function fetchRepo(owner: string, repo: string): Promise<GitHubRepo> {
  return githubFetchJson<GitHubRepo>(`/repos/${owner}/${repo}`)
}

/**
 * Fetch a single issue by number.
 */
export async function fetchIssue(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<GitHubIssueRaw> {
  return githubFetchJson<GitHubIssueRaw>(`/repos/${owner}/${repo}/issues/${issueNumber}`)
}

/**
 * Fetch the language breakdown for a repository (language name → byte count).
 */
export async function fetchLanguages(
  owner: string,
  repo: string
): Promise<Record<string, number>> {
  return githubFetchJson<Record<string, number>>(`/repos/${owner}/${repo}/languages`)
}

/**
 * Fetch the raw content of a file. Returns null when the file does not exist (404).
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string
): Promise<GitHubFileContent | null> {
  const res = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`)

  if (res.status === 404) return null

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `GitHub API error ${res.status} fetching ${path}${body ? `: ${body}` : ''}`
    )
  }

  return res.json() as Promise<GitHubFileContent>
}

/**
 * Fetch filenames present at the root of the default branch.
 * Returns only the entry names (not full paths).
 */
export async function fetchRootTree(owner: string, repo: string): Promise<string[]> {
  const data = await githubFetchJson<{ tree: Array<{ path: string; type: string }> }>(
    `/repos/${owner}/${repo}/git/trees/HEAD?recursive=0`
  )
  return data.tree
    .filter((entry) => entry.type === 'blob' || entry.type === 'tree')
    .map((entry) => entry.path)
}

/**
 * Fetch a pull request by number. Returns null when the PR does not exist (404).
 */
export async function fetchPR(
  owner: string,
  repo: string,
  prNumber: number
): Promise<GitHubPR | null> {
  const res = await githubFetch(`/repos/${owner}/${repo}/pulls/${prNumber}`)

  if (res.status === 404) return null

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `GitHub API error ${res.status} fetching PR #${prNumber}${body ? `: ${body}` : ''}`
    )
  }

  return res.json() as Promise<GitHubPR>
}

/**
 * Fetch a PR diff as a unified diff string.
 * For large diffs (>250KB), returns a truncated version with a warning.
 */
export async function fetchPRDiff(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ diff: string; truncated: boolean }> {
  const headers = { ...getGitHubHeaders(), Accept: 'application/vnd.github.diff' }

  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`,
    { headers },
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `GitHub API error ${res.status} fetching diff for PR #${prNumber}${body ? `: ${body.slice(0, 200)}` : ''}`,
    )
  }

  const diff = await res.text()
  const MAX_DIFF_SIZE = 250_000 // ~250KB
  if (diff.length > MAX_DIFF_SIZE) {
    return {
      diff: diff.slice(0, MAX_DIFF_SIZE) + '\n\n... [DIFF TRUNCATED — too large to include in full]',
      truncated: true,
    }
  }
  return { diff, truncated: false }
}

/**
 * Fetch the list of files changed in a PR.
 * Returns up to 100 files and a flag indicating if the list was truncated.
 */
export async function fetchPRChangedFiles(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ files: GitHubPRChangedFile[]; truncated: boolean }> {
  const files = await githubFetchJson<GitHubPRChangedFile[]>(
    `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`,
  )
  return { files, truncated: files.length >= 100 }
}
