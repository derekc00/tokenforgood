import { z } from 'zod'

// ---------------------------------------------------------------------------
// GitHub API response schemas
// ---------------------------------------------------------------------------
// These schemas mirror the TypeScript interfaces in client.ts and provide
// runtime validation of GitHub REST API responses.
// ---------------------------------------------------------------------------

export const GitHubRepoSchema = z.object({
  full_name: z.string(),
  name: z.string(),
  owner: z.object({ login: z.string() }),
  description: z.string().nullable(),
  language: z.string().nullable(),
  default_branch: z.string(),
  stargazers_count: z.number(),
  size: z.number(),
  topics: z.array(z.string()).default([]),
  open_issues_count: z.number(),
  html_url: z.string(),
})

export const GitHubIssueRawSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.string(),
  labels: z.array(z.object({ name: z.string() })),
  created_at: z.string(),
  updated_at: z.string(),
  html_url: z.string(),
})

export const GitHubFileContentSchema = z.object({
  content: z.string(),
  encoding: z.string(),
  size: z.number(),
})

export const GitHubPRSchema = z.object({
  number: z.number(),
  html_url: z.string(),
  draft: z.boolean(),
  state: z.string(),
  user: z.object({ login: z.string() }),
  body: z.string().nullable(),
  head: z.object({ repo: z.object({ full_name: z.string() }) }),
})

export const GitHubRootTreeSchema = z.object({
  tree: z.array(z.object({ path: z.string(), type: z.string() })),
})

export const GitHubLanguagesSchema = z.record(z.string(), z.number())
