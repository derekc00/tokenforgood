// ---------------------------------------------------------------------------
// Core domain enums
// ---------------------------------------------------------------------------

export type TaskStatus =
  | 'open'
  | 'picked'
  | 'in_progress'
  | 'completed'
  | 'verified'

export type TaskType =
  | 'write-tests'
  | 'implement-feature'
  | 'security-audit'
  | 'architecture-review'
  | 'add-documentation'
  | 'setup-cicd'
  | 'migrate-framework'
  | 'add-types'
  | 'dependency-audit'
  | 'code-quality-review'
  | 'performance-analysis'
  | 'accessibility-audit'
  | 'review-pr'
  | 'review-pr-security'
  | 'review-pr-tests'

export type SourceType = 'issue' | 'pull-request'

export type TemplateCategory = 'code-generation' | 'review-analysis'

export type ExecutionMode = 'safe' | 'full'

export type OutputType = 'draft-pr' | 'issue-comment' | 'pr-review-comment'

export type AIProvider =
  | 'claude-max'
  | 'claude-pro'
  | 'chatgpt-pro'
  | 'github-copilot'
  | 'gemini-advanced'

export type AIModel = 'haiku' | 'sonnet' | 'opus' | 'gpt-4o' | 'o3' | 'copilot'

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Profile {
  id: string
  github_username: string
  github_avatar_url: string
  github_id: number
  display_name: string | null
  bio: string | null
  created_at: string
  updated_at: string
  // Stats (computed)
  tasks_completed: number
  estimated_cost_donated_usd: number
  merge_rate: number
  // Preferences
  preferred_provider: AIProvider | null
  preferred_model: AIModel | null
  email_notifications: boolean
}

export interface RepoProfile {
  id: string
  owner: string
  repo: string
  /** Formatted as "owner/repo" */
  full_name: string
  description: string | null
  language: string | null
  /** Map of language name to byte count */
  languages: Record<string, number>
  topics: string[]
  default_branch: string
  stars: number
  size_kb: number
  // Stack detection
  test_runner: string | null
  linter: string | null
  formatter: string | null
  framework: string | null
  package_manager: 'npm' | 'pnpm' | 'yarn' | 'bun' | null
  // Contribution guidelines
  has_contributing: boolean
  has_code_of_conduct: boolean
  // Cache metadata
  fetched_at: string
  github_url: string
}

export interface GitHubIssue {
  number: number
  title: string
  body: string
  state: 'open' | 'closed'
  labels: string[]
  created_at: string
  updated_at: string
  html_url: string
  repo_full_name: string
}

export interface GitHubPR {
  number: number
  title: string
  body: string
  head_sha: string
  base_sha: string
  changed_files_count: number
  diff_url: string
  html_url: string
  repo_full_name: string
}

export interface Template {
  id: string
  slug: TaskType
  name: string
  description: string
  category: TemplateCategory
  source_type: SourceType
  output_type: OutputType
  recommended_mode: ExecutionMode
  /** Lower bound of estimated token usage, in thousands */
  token_estimate_low: number
  /** Upper bound of estimated token usage, in thousands */
  token_estimate_high: number
  recommended_model: AIModel
  /** Glob patterns restricting which files the agent may touch; null means no restrictions */
  file_restrictions: string[] | null
  created_at: string
}

export interface Task {
  id: string
  // Source
  source_type: SourceType
  // Issue source (populated when source_type === 'issue')
  github_issue_url: string
  github_issue_number: number
  github_issue_title: string
  github_issue_body_sanitized: string
  // PR source (populated when source_type === 'pull-request')
  github_pr_url: string | null
  github_pr_number: number | null
  // Repository
  repo_owner: string
  repo_name: string
  repo_full_name: string
  repo_profile: RepoProfile | null
  // Template
  template_id: string
  template: Template | null
  task_type: TaskType
  // Requester
  requester_id: string
  requester: Profile | null
  // Status
  status: TaskStatus
  /** Number of donors who have copied the prompt (telemetry, non-exclusive) */
  pick_count: number
  completed_at: string | null
  // Completion
  pr_url: string | null
  pr_number: number | null
  pr_merged: boolean
  pr_closed: boolean
  // Metadata
  created_at: string
  updated_at: string
  /** Union of GitHub issue labels and repo topics */
  tags: string[]
}

export interface TaskCompletion {
  id: string
  task_id: string
  task: Task | null
  donor_id: string
  donor: Profile | null
  pr_url: string | null
  pr_number: number | null
  pr_merged: boolean
  // Optional self-reported token usage
  input_tokens: number | null
  output_tokens: number | null
  estimated_cost_usd: number | null
  ai_provider: AIProvider | null
  ai_model: AIModel | null
  /** Populated for analysis tasks that produce an issue comment rather than a PR */
  issue_comment_url: string | null
  completed_at: string
  // Requester feedback
  requester_rating: 1 | 2 | 3 | 4 | 5 | null
  requester_note: string | null
}

export interface TaskAttempt {
  id: string
  task_id: string
  donor_id: string
  claimed_at: string
  released_at: string | null
  completed: boolean
  prompt_snapshot: string
  claim_token: string
}

export interface Notification {
  id: string
  user_id: string
  type:
    | 'task_claimed'
    | 'task_completed'
    | 'pr_merged'
    | 'pr_closed'
    | 'thank_you'
    | 'claim_expiring'
  message: string
  read: boolean
  task_id: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Aggregates and computed views
// ---------------------------------------------------------------------------

export interface PlatformStats {
  completed_this_week: number
  completed_this_hour: number
  completed_all_time: number
  total_donated_usd: number
  merge_rate: number
  top_languages: string[]
  active_tasks: number
  top_donors_this_week: TopDonor[]
}

export interface TopDonor {
  profile: Profile
  tasks_completed_this_week: number
  estimated_cost_donated_this_week: number
}

export interface ActivityFeedItem {
  id: string
  donor: Profile
  task: Task
  action: 'completed' | 'claimed'
  pr_url: string | null
  created_at: string
}

export interface ProviderPricing {
  provider: AIProvider
  model: AIModel
  display_name: string
  input_cost_per_mtok: number
  output_cost_per_mtok: number
  is_flat_rate: boolean
  /** Per-task flat-rate estimate keyed by TaskType; null when is_flat_rate is false */
  flat_rate_estimate_per_task: Partial<Record<TaskType, number>> | null
  notes: string
}

// ---------------------------------------------------------------------------
// Budget calculator
// ---------------------------------------------------------------------------

export interface BudgetAllocation {
  provider: AIProvider
  model: AIModel
  budget_usd: number
  selected_tasks: Task[]
  total_estimated_cost_usd: number
  generated_command: string
}

// ---------------------------------------------------------------------------
// Prompt generation
// ---------------------------------------------------------------------------

export interface GeneratedPrompt {
  task_id: string
  full_prompt: string
  repo_context: string
  issue_context: string
  task_instructions: string
  execution_mode: ExecutionMode
  generated_at: string
}
