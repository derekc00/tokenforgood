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
import type { CompleteTaskInput, CreateTaskInput, TaskFilterInput } from '@/lib/schemas'

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
    data: Pick<CreateTaskInput, 'github_issue_url' | 'github_pr_url' | 'template_id'>,
    userId: string,
  ): Promise<Task>
  pickTask(taskId: string, donorId?: string): Promise<{ success: boolean; error?: string }>
  expirePickedTasks(maxAgeHours?: number): Promise<number>
  completeTask(
    taskId: string,
    userId: string,
    data: CompleteTaskInput,
  ): Promise<CompleteResult>

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
