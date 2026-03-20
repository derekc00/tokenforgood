import { z } from 'zod'
import type { AIProvider, AIModel, TaskStatus, TaskType, SourceType } from '@/lib/types'

// ---------------------------------------------------------------------------
// Reusable primitive schemas
// ---------------------------------------------------------------------------

/** Valid GitHub issue URL: https://github.com/owner/repo/issues/123 */
export const GitHubIssueUrlSchema = z
  .string()
  .url()
  .regex(
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+$/,
    'Must be a valid GitHub issue URL (e.g., https://github.com/owner/repo/issues/123)',
  )

/** Valid GitHub pull request URL: https://github.com/owner/repo/pull/123 */
export const GitHubPRUrlSchema = z
  .string()
  .url()
  .regex(
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/,
    'Must be a valid GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
  )

export const AIProviderSchema = z.enum([
  'claude-max',
  'claude-pro',
  'chatgpt-pro',
  'github-copilot',
  'gemini-advanced',
] as const satisfies readonly AIProvider[])

export const AIModelSchema = z.enum([
  'haiku',
  'sonnet',
  'opus',
  'gpt-4o',
  'o3',
  'copilot',
] as const satisfies readonly AIModel[])

export const TaskStatusSchema = z.enum([
  'open',
  'picked',
  'in_progress',
  'completed',
  'verified',
] as const satisfies readonly TaskStatus[])

export const TaskTypeSchema = z.enum([
  'write-tests',
  'implement-feature',
  'security-audit',
  'architecture-review',
  'add-documentation',
  'setup-cicd',
  'migrate-framework',
  'add-types',
  'dependency-audit',
  'code-quality-review',
  'performance-analysis',
  'accessibility-audit',
  'review-pr',
  'review-pr-security',
  'review-pr-tests',
] as const satisfies readonly TaskType[])

export const SourceTypeSchema = z.enum([
  'issue',
  'pull-request',
] as const satisfies readonly SourceType[])

// ---------------------------------------------------------------------------
// Request / mutation schemas
// ---------------------------------------------------------------------------

/** PR review task types that require a PR URL */
const PR_TASK_TYPES = new Set<string>(['review-pr', 'review-pr-security', 'review-pr-tests'])

export const CreateTaskSchema = z
  .object({
    github_issue_url: GitHubIssueUrlSchema.optional(),
    github_pr_url: GitHubPRUrlSchema.optional(),
    template_id: z.string().min(1),
    custom_instructions: z.string().max(500).optional(),
  })
  .refine(
    (data) =>
      (data.github_issue_url !== undefined) !== (data.github_pr_url !== undefined),
    { message: 'Exactly one of github_issue_url or github_pr_url is required' },
  )

export const CompleteTaskSchema = z
  .object({
    pr_url: GitHubPRUrlSchema.optional(),
    issue_comment_url: z.string().url().optional(),
    input_tokens: z.number().int().positive().optional(),
    output_tokens: z.number().int().positive().optional(),
    ai_provider: AIProviderSchema.optional(),
    ai_model: AIModelSchema.optional(),
  })
  .refine((data) => data.pr_url !== undefined || data.issue_comment_url !== undefined, {
    message: 'Either a PR URL or issue comment URL is required',
  })

export const ClaimTaskSchema = z.object({
  task_id: z.string().uuid(),
})

export const HeartbeatSchema = z.object({
  claim_token: z.string().min(1),
})

// ---------------------------------------------------------------------------
// Query / filter schemas
// ---------------------------------------------------------------------------

export const TaskFilterSchema = z.object({
  task_type: TaskTypeSchema.optional(),
  token_estimate: z.enum(['small', 'medium', 'large', 'any']).optional(),
  status: z
    .enum(['open', 'picked', 'in_progress', 'completed', 'verified'] as const)
    .optional(),
  source_type: SourceTypeSchema.optional(),
  page: z.number().int().positive().default(1),
  per_page: z.number().int().min(1).max(100).default(20),
})

// ---------------------------------------------------------------------------
// Budget calculator schema
// ---------------------------------------------------------------------------

export const BudgetSchema = z.object({
  budget_usd: z.number().min(1).max(1000),
  provider: AIProviderSchema,
  model_allocation: z
    .enum(['auto', 'haiku', 'sonnet', 'opus', 'gpt-4o', 'o3'] as const)
    .default('auto'),
  task_types: z.array(TaskTypeSchema).optional(),
})

// ---------------------------------------------------------------------------
// Profile update schema
// ---------------------------------------------------------------------------

export const ProfileUpdateSchema = z.object({
  preferred_provider: AIProviderSchema.nullable(),
  preferred_model: AIModelSchema.nullable(),
  email_notifications: z.boolean(),
})

// ---------------------------------------------------------------------------
// Inferred TypeScript types from schemas
// ---------------------------------------------------------------------------

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>
export type CompleteTaskInput = z.infer<typeof CompleteTaskSchema>
export type ClaimTaskInput = z.infer<typeof ClaimTaskSchema>
export type HeartbeatInput = z.infer<typeof HeartbeatSchema>
export type TaskFilterInput = z.infer<typeof TaskFilterSchema>
export type BudgetInput = z.infer<typeof BudgetSchema>
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>
