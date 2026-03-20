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
// Shared result shapes
// ---------------------------------------------------------------------------

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
  getTemplate(id: string): Promise<Template | null>
  getTemplateBySlug(slug: string): Promise<Template | null>

  // Profiles
  getProfile(username: string): Promise<Profile | null>
  getProfileById(id: string): Promise<Profile | null>
  updateProfile(id: string, data: Partial<Profile>): Promise<Profile>

  // Stats & Feed
  getPlatformStats(): Promise<PlatformStats>
  getActivityFeed(limit?: number): Promise<ActivityFeedItem[]>

  // Pricing
  getProviderPricing(): Promise<ProviderPricing[]>

  // Prompt
  getGeneratedPrompt(taskId: string): Promise<GeneratedPrompt | null>
}
