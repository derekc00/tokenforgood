import type { RepoProfile } from '@/lib/types'
import {
  fetchRepo,
  fetchLanguages,
  fetchRootTree,
  fetchFileContent,
} from './client'
import { detectStack } from './stack-detection'

// ---------------------------------------------------------------------------
// buildRepoProfile
// ---------------------------------------------------------------------------

/**
 * Assemble a complete `RepoProfile` for the given owner/repo by querying the
 * GitHub REST API.  Parallel fetches are made where possible; missing
 * optional files (package.json, CONTRIBUTING.md, CODE_OF_CONDUCT.md) are
 * handled gracefully — they never cause the whole call to reject.
 */
export async function buildRepoProfile(owner: string, repo: string): Promise<RepoProfile> {
  // Required fetches — fail fast if the repo itself is not accessible.
  const [repoData, languages, rootFiles] = await Promise.all([
    fetchRepo(owner, repo),
    fetchLanguages(owner, repo),
    fetchRootTree(owner, repo),
  ])

  // Optional file fetches — run in parallel, ignore individual failures.
  const [packageJsonResult, contributingResult, cocResult] = await Promise.allSettled([
    fetchFileContent(owner, repo, 'package.json'),
    fetchFileContent(owner, repo, 'CONTRIBUTING.md'),
    fetchFileContent(owner, repo, 'CODE_OF_CONDUCT.md'),
  ])

  // Parse package.json when present and valid.
  let packageJson: Record<string, unknown> | null = null
  if (packageJsonResult.status === 'fulfilled' && packageJsonResult.value !== null) {
    try {
      const raw = Buffer.from(packageJsonResult.value.content, 'base64').toString('utf-8')
      // JSON.parse returns `any`, which satisfies PackageJsonLike without an assertion.
      packageJson = JSON.parse(raw)
    } catch {
      // Malformed package.json — continue with null.
    }
  }

  const stack = detectStack(rootFiles, packageJson)

  const hasContributing =
    contributingResult.status === 'fulfilled' && contributingResult.value !== null
  const hasCodeOfConduct =
    cocResult.status === 'fulfilled' && cocResult.value !== null

  return {
    // RepoProfile does not carry a database id — callers that persist the
    // result will assign one; we use an empty string as the zero value.
    id: '',
    owner,
    repo,
    full_name: repoData.full_name,
    description: repoData.description,
    language: repoData.language,
    languages,
    topics: repoData.topics ?? [],
    default_branch: repoData.default_branch,
    stars: repoData.stargazers_count,
    size_kb: repoData.size,
    // Stack
    test_runner: stack.test_runner,
    linter: stack.linter,
    formatter: stack.formatter,
    framework: stack.framework,
    package_manager: stack.package_manager,
    // Contribution guidelines
    has_contributing: hasContributing,
    has_code_of_conduct: hasCodeOfConduct,
    // Cache metadata
    fetched_at: new Date().toISOString(),
    github_url: repoData.html_url,
  }
}

// ---------------------------------------------------------------------------
// parseGitHubIssueUrl
// ---------------------------------------------------------------------------

/**
 * Parse a GitHub issue URL and return the owner, repo name, and issue number.
 * Returns `null` when the URL does not match the expected format.
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
