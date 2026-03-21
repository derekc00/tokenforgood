import { z } from 'zod'
import {
  GitHubRepoSchema,
  GitHubIssueRawSchema,
  GitHubFileContentSchema,
  GitHubPRSchema,
  GitHubRootTreeSchema,
  GitHubLanguagesSchema,
} from './schemas'

const GITHUB_API = 'https://api.github.com'

// ---------------------------------------------------------------------------
// Types — derived from schemas to avoid duplication
// ---------------------------------------------------------------------------

export type GitHubRepo = z.infer<typeof GitHubRepoSchema>
export type GitHubIssueRaw = z.infer<typeof GitHubIssueRawSchema>
export type GitHubFileContent = z.infer<typeof GitHubFileContentSchema>
export type GitHubPR = z.infer<typeof GitHubPRSchema>

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
// Core fetch helpers
// ---------------------------------------------------------------------------

async function githubFetch(path: string): Promise<Response> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: getGitHubHeaders() })
  return res
}

/**
 * Fetch JSON from the GitHub API and validate the response shape with a Zod
 * schema.  Throws if the request fails or if the response does not conform to
 * the schema.
 */
async function githubFetchJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await githubFetch(path)

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `GitHub API error ${res.status} for ${path}${body ? `: ${body}` : ''}`
    )
  }

  // JSON.parse returns `any`; schema.parse validates and narrows to T.
  return schema.parse(JSON.parse(await res.text()))
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/**
 * Fetch repository metadata.
 */
export async function fetchRepo(owner: string, repo: string): Promise<GitHubRepo> {
  return githubFetchJson(`/repos/${owner}/${repo}`, GitHubRepoSchema)
}

/**
 * Fetch a single issue by number.
 */
export async function fetchIssue(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<GitHubIssueRaw> {
  return githubFetchJson(
    `/repos/${owner}/${repo}/issues/${issueNumber}`,
    GitHubIssueRawSchema
  )
}

/**
 * Fetch the language breakdown for a repository (language name → byte count).
 */
export async function fetchLanguages(
  owner: string,
  repo: string
): Promise<Record<string, number>> {
  return githubFetchJson(`/repos/${owner}/${repo}/languages`, GitHubLanguagesSchema)
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

  return GitHubFileContentSchema.parse(JSON.parse(await res.text()))
}

/**
 * Fetch filenames present at the root of the default branch.
 * Returns only the entry names (not full paths).
 */
export async function fetchRootTree(owner: string, repo: string): Promise<string[]> {
  const data = await githubFetchJson(
    `/repos/${owner}/${repo}/git/trees/HEAD?recursive=0`,
    GitHubRootTreeSchema
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

  return GitHubPRSchema.parse(JSON.parse(await res.text()))
}
