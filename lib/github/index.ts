// GitHub API utilities — public surface area
// Re-exports everything consumers need without requiring direct imports
// from individual files.

export type {
  GitHubRepo,
  GitHubIssueRaw,
  GitHubFileContent,
  GitHubPR,
  GitHubPRChangedFile,
} from './client'

export {
  fetchRepo,
  fetchIssue,
  fetchLanguages,
  fetchFileContent,
  fetchRootTree,
  fetchPR,
  fetchPRDiff,
  fetchPRChangedFiles,
} from './client'

export { sanitizeIssueBody, wrapAsUntrusted } from './issue-sanitizer'

export type { StackInfo } from './stack-detection'
export { detectStack, stackInfoFromProfile } from './stack-detection'

export { buildRepoProfile, parseGitHubIssueUrl, parseGitHubPRUrl } from './repo-profile'
