import type {
  Task,
  Profile,
  Template,
  TaskCompletion,
  ActivityFeedItem,
  PlatformStats,
  GeneratedPrompt,
  ProviderPricing,
} from '@/lib/types'
import type { CompleteTaskInput, TaskFilterInput } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// Shared param / result shapes
// ---------------------------------------------------------------------------

/** Subset of TaskFilterInput used when a query is already scoped by user. */
export interface PaginationParams {
  page?: number
  per_page?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  has_more: boolean
}

export interface ClaimResult {
  success: boolean
  task?: Task
  claim_token?: string
  error?: string
}

export interface CompleteResult {
  success: boolean
  completion?: TaskCompletion
  error?: string
}

// ---------------------------------------------------------------------------
// DataService interface
// ---------------------------------------------------------------------------

export interface DataService {
  // Tasks
  getTasks(filters?: TaskFilterInput): Promise<PaginatedResult<Task>>
  getTask(id: string): Promise<Task | null>
  /** Returns tasks where `claimed_by === userId` and `status === 'completed'`. */
  getTasksByDonor(userId: string, params?: PaginationParams): Promise<PaginatedResult<Task>>
  /** Returns tasks where `requester_id === userId`. */
  getTasksByRequester(userId: string, params?: PaginationParams): Promise<PaginatedResult<Task>>
  createTask(
    data: { github_issue_url: string; template_id: string },
    userId: string,
  ): Promise<Task>
  claimTask(taskId: string, userId: string): Promise<ClaimResult>
  unclaimTask(taskId: string, userId: string): Promise<{ success: boolean; error?: string }>
  completeTask(
    taskId: string,
    userId: string,
    data: CompleteTaskInput,
  ): Promise<CompleteResult>
  heartbeat(
    taskId: string,
    claimToken: string,
  ): Promise<{ success: boolean; error?: string }>

  // Templates
  getTemplates(): Promise<Template[]>

  // Profiles
  getProfile(username: string): Promise<Profile | null>

  // Stats & Feed
  getPlatformStats(): Promise<PlatformStats>
  getActivityFeed(limit?: number): Promise<ActivityFeedItem[]>

  // Pricing
  getProviderPricing(): Promise<ProviderPricing[]>

  // Prompt
  getGeneratedPrompt(taskId: string): Promise<GeneratedPrompt | null>
}
