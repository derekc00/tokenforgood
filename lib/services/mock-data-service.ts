import type {
  Task,
  Profile,
  Template,
  TaskCompletion,
  ActivityFeedItem,
  PlatformStats,
  GeneratedPrompt,
  ProviderPricing,
  AIProvider,
  TaskType,
  RepoProfile,
} from '@/lib/types'
import type { CompleteTaskInput, TaskFilterInput } from '@/lib/schemas'
import {
  AIProviderSchema,
  AIModelSchema,
  TaskTypeSchema,
  TaskStatusSchema,
} from '@/lib/schemas'
import { parseGitHubIssueUrl } from '@/lib/github/repo-profile'
import type {
  DataService,
  PaginatedResult,
  PaginationParams,
  ClaimResult,
  CompleteResult,
} from './data-service'

// JSON imports — Next.js supports these via resolveJsonModule
import rawTasks from '@/lib/mock-data/tasks.json'
import rawProfiles from '@/lib/mock-data/profiles.json'
import rawTemplates from '@/lib/mock-data/templates.json'
import rawActivity from '@/lib/mock-data/activity.json'
import rawStats from '@/lib/mock-data/stats.json'
import rawPricing from '@/lib/mock-data/provider-pricing.json'

// ---------------------------------------------------------------------------
// Internal raw JSON types (match the shape stored in the JSON files)
// ---------------------------------------------------------------------------

interface RawProfile {
  id: string
  github_username: string
  github_avatar_url: string
  github_id: number
  display_name: string | null
  bio: string | null
  created_at: string
  updated_at: string
  tasks_completed: number
  estimated_cost_donated_usd: number
  merge_rate: number
  preferred_provider: string | null
  preferred_model: string | null
  email_notifications: boolean
}

interface RawTask {
  id: string
  github_issue_url: string
  github_issue_number: number
  github_issue_title: string
  github_issue_body_sanitized: string
  repo_owner: string
  repo_name: string
  repo_full_name: string
  task_type: string
  template_id: string
  requester_id: string
  status: string
  claimed_by: string | null
  claimed_at: string | null
  last_heartbeat_at: string | null
  completed_at: string | null
  pr_url: string | null
  pr_number: number | null
  pr_merged: boolean
  pr_closed: boolean
  created_at: string
  updated_at: string
  tags: string[]
}

interface RawActivityDonor {
  id: string
  github_username: string
  github_avatar_url: string
  display_name: string
  merge_rate: number
  tasks_completed: number
}

interface RawActivityTask {
  id: string
  github_issue_title: string
  repo_full_name: string
  task_type: string
}

interface RawActivityItem {
  id: string
  donor: RawActivityDonor
  task: RawActivityTask
  action: string
  pr_url: string | null
  created_at: string
}

interface RawModel {
  id: string
  name: string
  display_name: string
  description?: string
  input_cost_per_mtok?: number
  output_cost_per_mtok?: number
  flat_rate_estimate_per_task_usd?: Record<string, number>
  context_window_k?: number
  monthly_usage_limit_note?: string
  recommended_for?: string[]
}

interface RawProvider {
  id: string
  name: string
  description: string
  billing_model: string
  models: RawModel[]
  flat_rate_note?: string
}

interface RawPricing {
  providers: RawProvider[]
  task_size_definitions: Record<string, string>
}

interface RawTopDonorProfile {
  id: string
  github_username: string
  github_avatar_url: string
  display_name: string
  merge_rate: number
  tasks_completed: number
}

interface RawTopDonor {
  profile: RawTopDonorProfile
  tasks_completed_this_week: number
  estimated_cost_donated_this_week: number
}

interface RawStats {
  completed_this_week: number
  completed_this_hour: number
  completed_all_time: number
  total_donated_usd: number
  merge_rate: number
  top_languages: string[]
  active_tasks: number
  top_donors_this_week: RawTopDonor[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Type-safe membership check for string union types. Uses `some` to avoid type assertions. */
function includes<T extends string>(arr: readonly T[], value: string): value is T {
  return arr.some((item) => item === value)
}

/**
 * Re-parses an imported JSON value as a typed shape.
 * JSON.parse returns `any`, so TypeScript accepts the assignment to T
 * without a type assertion.
 */
function fromJson<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value))
}

const KNOWN_TASK_TYPES: readonly TaskType[] = [
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
]

const KNOWN_ACTIVITY_ACTIONS: readonly ActivityFeedItem['action'][] = ['completed', 'claimed']

/** Normalises provider strings from JSON (underscores) to the AIProvider union (hyphens). */
function normaliseProvider(raw: string | null): AIProvider | null {
  if (!raw) return null
  return AIProviderSchema.parse(raw.replace(/_/g, '-'))
}

/** Coerces a raw profile from JSON to the typed Profile shape. */
function coerceProfile(raw: RawProfile): Profile {
  const preferredModel = raw.preferred_model
  return {
    ...raw,
    display_name: raw.display_name,
    bio: raw.bio,
    preferred_provider: normaliseProvider(raw.preferred_provider),
    preferred_model: (() => {
      const r = AIModelSchema.safeParse(preferredModel)
      return r.success ? r.data : null
    })(),
  }
}

/** Coerces a raw task from JSON to the typed Task shape (without relations). */
function coerceTask(raw: RawTask): Task {
  return {
    id: raw.id,
    github_issue_url: raw.github_issue_url,
    github_issue_number: raw.github_issue_number,
    github_issue_title: raw.github_issue_title,
    github_issue_body_sanitized: raw.github_issue_body_sanitized,
    repo_owner: raw.repo_owner,
    repo_name: raw.repo_name,
    repo_full_name: raw.repo_full_name,
    repo_profile: null,
    template_id: raw.template_id,
    template: null,
    task_type: TaskTypeSchema.parse(raw.task_type),
    requester_id: raw.requester_id,
    requester: null,
    status: TaskStatusSchema.parse(raw.status),
    claimed_by: raw.claimed_by,
    claimed_at: raw.claimed_at,
    last_heartbeat_at: raw.last_heartbeat_at,
    completed_at: raw.completed_at,
    pr_url: raw.pr_url,
    pr_number: raw.pr_number,
    pr_merged: raw.pr_merged,
    pr_closed: raw.pr_closed,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    tags: raw.tags,
  }
}

/** Builds a synthetic RepoProfile from Task fields (no GitHub API in mock). */
function buildRepoProfile(task: Task): RepoProfile {
  return {
    id: `repo-${task.repo_owner}-${task.repo_name}`,
    owner: task.repo_owner,
    repo: task.repo_name,
    full_name: task.repo_full_name,
    description: null,
    language: 'TypeScript',
    languages: { TypeScript: 1 },
    topics: task.tags,
    default_branch: 'main',
    stars: 0,
    size_kb: 0,
    test_runner: null,
    linter: null,
    formatter: null,
    framework: null,
    package_manager: 'npm',
    has_contributing: false,
    has_code_of_conduct: false,
    fetched_at: new Date().toISOString(),
    github_url: `https://github.com/${task.repo_full_name}`,
  }
}

/** Generates a cryptographically-adequate random hex string for claim tokens. */
function generateToken(): string {
  const bytes = new Uint8Array(16)
  // Works in both Node 20+ and browser environments
  if (typeof globalThis.crypto !== 'undefined') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    // Fallback for older Node without globalThis.crypto
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Generates a UUID v4 string. */
function generateUuid(): string {
  const bytes = new Uint8Array(16)
  if (typeof globalThis.crypto !== 'undefined') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  // Set version bits (v4)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

/**
 * Token-estimate bucket boundaries (in thousands of tokens).
 * 'small'  = high estimate < 20k
 * 'medium' = high estimate 20k–50k (inclusive)
 * 'large'  = high estimate > 50k
 */
function matchesTokenFilter(
  template: Template | null | undefined,
  bucket: string,
): boolean {
  if (!template) return true
  const high = template.token_estimate_high
  switch (bucket) {
    case 'small':
      return high < 20
    case 'medium':
      return high >= 20 && high <= 50
    case 'large':
      return high > 50
    default:
      return true
  }
}

/** Flattens the nested provider-pricing JSON into a ProviderPricing[] array. */
function flattenPricing(raw: RawPricing): ProviderPricing[] {
  const result: ProviderPricing[] = []
  for (const provider of raw.providers) {
    // Throws on unknown provider: mock JSON is controlled data, so an
    // unrecognised provider is a programmer error, not a runtime condition.
    const providerKey = AIProviderSchema.parse(provider.id.replace(/_/g, '-'))
    const isFlat = provider.billing_model === 'flat_rate_estimate'

    for (const model of provider.models) {
      const modelParsed = AIModelSchema.safeParse(model.id)
      if (!modelParsed.success) continue
      const flatRates: Partial<Record<TaskType, number>> | null = isFlat
        ? buildFlatRatesFromTaskTypes(model)
        : null

      result.push({
        provider: providerKey,
        model: modelParsed.data,
        display_name: model.display_name,
        input_cost_per_mtok: model.input_cost_per_mtok ?? 0,
        output_cost_per_mtok: model.output_cost_per_mtok ?? 0,
        is_flat_rate: isFlat,
        flat_rate_estimate_per_task: flatRates,
        notes: model.description ?? provider.description,
      })
    }
  }
  return result
}

/**
 * For flat-rate providers the JSON stores estimates keyed by 'light/medium/heavy'.
 * The domain type uses TaskType keys, so we map each recommended task type to
 * the appropriate tier estimate.
 */
function buildFlatRatesFromTaskTypes(
  model: RawModel,
): Partial<Record<TaskType, number>> | null {
  if (!model.flat_rate_estimate_per_task_usd || !model.recommended_for?.length) {
    return null
  }
  const rates = model.flat_rate_estimate_per_task_usd
  const perTask: Partial<Record<TaskType, number>> = {}

  // Task-type → cost tier mapping based on typical token usage
  const tierMap: Record<string, 'light' | 'medium' | 'heavy'> = {
    'add-documentation': 'light',
    'dependency-audit': 'light',
    'setup-cicd': 'light',
    'write-tests': 'medium',
    'implement-feature': 'medium',
    'add-types': 'medium',
    'code-quality-review': 'medium',
    'accessibility-audit': 'medium',
    'migrate-framework': 'medium',
    'security-audit': 'heavy',
    'architecture-review': 'heavy',
    'performance-analysis': 'heavy',
  }

  for (const taskTypeStr of model.recommended_for) {
    if (!includes(KNOWN_TASK_TYPES, taskTypeStr)) continue
    const tier = tierMap[taskTypeStr] ?? 'medium'
    const cost = rates[tier]
    if (cost !== undefined) {
      perTask[taskTypeStr] = cost
    }
  }

  return Object.keys(perTask).length > 0 ? perTask : null
}

// ---------------------------------------------------------------------------
// Store — internal mutable state for the mock service
// ---------------------------------------------------------------------------

interface ClaimRecord {
  token: string
  userId: string
}

interface MockStore {
  tasks: Map<string, Task>
  profiles: Map<string, Profile>           // keyed by id
  profilesByUsername: Map<string, Profile> // keyed by github_username
  templates: Map<string, Template>         // keyed by id
  completions: Map<string, TaskCompletion> // keyed by completion id
  activity: ActivityFeedItem[]
  stats: PlatformStats
  pricing: ProviderPricing[]
  claims: Map<string, ClaimRecord>         // taskId → { token, userId }
}

// ---------------------------------------------------------------------------
// MockDataService implementation
// ---------------------------------------------------------------------------

export class MockDataService implements DataService {
  private readonly store: MockStore

  constructor() {
    this.store = MockDataService.buildStore()
  }

  // ---------- Store initialisation ----------

  private static buildStore(): MockStore {
    // Profiles
    const profiles = new Map<string, Profile>()
    const profilesByUsername = new Map<string, Profile>()
    for (const raw of fromJson<RawProfile[]>(rawProfiles)) {
      const profile = coerceProfile(raw)
      profiles.set(profile.id, profile)
      profilesByUsername.set(profile.github_username, profile)
    }

    // Templates
    const templates = new Map<string, Template>()
    for (const raw of fromJson<Template[]>(rawTemplates)) {
      templates.set(raw.id, raw)
    }

    // Tasks — enrich with relations after both maps are built
    const tasks = new Map<string, Task>()
    for (const raw of fromJson<RawTask[]>(rawTasks)) {
      const task = coerceTask(raw)
      task.template = templates.get(task.template_id) ?? null
      task.requester = profiles.get(task.requester_id) ?? null
      task.repo_profile = buildRepoProfile(task)
      tasks.set(task.id, task)
    }

    // Activity — enrich partial objects using the in-memory maps
    const activity: ActivityFeedItem[] = fromJson<RawActivityItem[]>(rawActivity).map(
      (item) => {
        const donorProfile = profiles.get(item.donor.id)
        const fullTask = tasks.get(item.task.id)

        // Construct a minimal Profile if the full one is not in the map
        const donor: Profile = donorProfile ?? {
          id: item.donor.id,
          github_username: item.donor.github_username,
          github_avatar_url: item.donor.github_avatar_url,
          github_id: 0,
          display_name: item.donor.display_name,
          bio: null,
          created_at: '',
          updated_at: '',
          tasks_completed: item.donor.tasks_completed,
          estimated_cost_donated_usd: 0,
          merge_rate: item.donor.merge_rate,
          preferred_provider: null,
          preferred_model: null,
          email_notifications: false,
        }

        // Construct a minimal Task if the full one is not in the map
        const task: Task = fullTask ?? {
          id: item.task.id,
          github_issue_url: '',
          github_issue_number: 0,
          github_issue_title: item.task.github_issue_title,
          github_issue_body_sanitized: '',
          repo_owner: item.task.repo_full_name.split('/')[0] ?? '',
          repo_name: item.task.repo_full_name.split('/')[1] ?? '',
          repo_full_name: item.task.repo_full_name,
          repo_profile: null,
          template_id: '',
          template: null,
          // Soft fallback: unknown task types default to 'write-tests' rather than
          // throwing, so new task types in JSON don't crash the mock store.
          task_type: includes(KNOWN_TASK_TYPES, item.task.task_type) ? item.task.task_type : 'write-tests',
          requester_id: '',
          requester: null,
          status: 'open',
          claimed_by: null,
          claimed_at: null,
          last_heartbeat_at: null,
          completed_at: null,
          pr_url: null,
          pr_number: null,
          pr_merged: false,
          pr_closed: false,
          created_at: '',
          updated_at: '',
          tags: [],
        }

        return {
          id: item.id,
          donor,
          task,
          // Soft fallback: unknown activity actions default to 'completed' rather than
          // throwing, so new action types in JSON don't crash the mock store.
          action: includes(KNOWN_ACTIVITY_ACTIONS, item.action) ? item.action : 'completed',
          pr_url: item.pr_url,
          created_at: item.created_at,
        }
      },
    )

    // Stats — enrich top-donor profiles from in-memory map
    const rawS = fromJson<RawStats>(rawStats)
    const stats: PlatformStats = {
      ...rawS,
      top_donors_this_week: rawS.top_donors_this_week.map((d) => {
        const enriched =
          profiles.get(d.profile.id) ??
          ({
            id: d.profile.id,
            github_username: d.profile.github_username,
            github_avatar_url: d.profile.github_avatar_url,
            github_id: 0,
            display_name: d.profile.display_name,
            bio: null,
            created_at: '',
            updated_at: '',
            tasks_completed: d.profile.tasks_completed,
            estimated_cost_donated_usd: 0,
            merge_rate: d.profile.merge_rate,
            preferred_provider: null,
            preferred_model: null,
            email_notifications: false,
          } satisfies Profile)
        return {
          profile: enriched,
          tasks_completed_this_week: d.tasks_completed_this_week,
          estimated_cost_donated_this_week: d.estimated_cost_donated_this_week,
        }
      }),
    }

    // Pricing
    const pricing = flattenPricing(fromJson<RawPricing>(rawPricing))

    return {
      tasks,
      profiles,
      profilesByUsername,
      templates,
      completions: new Map(),
      activity,
      stats,
      pricing,
      claims: new Map(),
    }
  }

  // ---------- Tasks ----------

  async getTasks(filters?: TaskFilterInput): Promise<PaginatedResult<Task>> {
    const page = filters?.page ?? 1
    const perPage = filters?.per_page ?? 20

    let results = Array.from(this.store.tasks.values())

    // Filter by status
    if (filters?.status) {
      results = results.filter((t) => t.status === filters.status)
    }

    // Filter by task_type
    if (filters?.task_type) {
      results = results.filter((t) => t.task_type === filters.task_type)
    }

    // Filter by token_estimate bucket
    if (filters?.token_estimate && filters.token_estimate !== 'any') {
      results = results.filter((t) =>
        matchesTokenFilter(t.template, filters.token_estimate ?? 'any'),
      )
    }

    // Sort newest first
    results.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )

    const total = results.length
    const offset = (page - 1) * perPage
    const data = results.slice(offset, offset + perPage)

    return {
      data,
      total,
      page,
      per_page: perPage,
      has_more: offset + data.length < total,
    }
  }

  async getTask(id: string): Promise<Task | null> {
    return this.store.tasks.get(id) ?? null
  }

  async getTasksByDonor(
    userId: string,
    params?: PaginationParams,
  ): Promise<PaginatedResult<Task>> {
    const page = params?.page ?? 1
    const perPage = params?.per_page ?? 20

    const results = Array.from(this.store.tasks.values()).filter(
      (t) => t.claimed_by === userId && t.status === 'completed',
    )

    // Sort newest completion first
    results.sort(
      (a, b) =>
        new Date(b.completed_at ?? b.updated_at).getTime() -
        new Date(a.completed_at ?? a.updated_at).getTime(),
    )

    const total = results.length
    const offset = (page - 1) * perPage
    const data = results.slice(offset, offset + perPage)

    return { data, total, page, per_page: perPage, has_more: offset + data.length < total }
  }

  async getTasksByRequester(
    userId: string,
    params?: PaginationParams,
  ): Promise<PaginatedResult<Task>> {
    const page = params?.page ?? 1
    const perPage = params?.per_page ?? 20

    const results = Array.from(this.store.tasks.values()).filter(
      (t) => t.requester_id === userId,
    )

    // Sort newest first
    results.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )

    const total = results.length
    const offset = (page - 1) * perPage
    const data = results.slice(offset, offset + perPage)

    return { data, total, page, per_page: perPage, has_more: offset + data.length < total }
  }

  async createTask(
    data: { github_issue_url: string; template_id: string },
    userId: string,
  ): Promise<Task> {
    const template = this.store.templates.get(data.template_id) ?? null
    const requester = this.store.profiles.get(userId) ?? null

    // Parse owner/repo/issue number from the GitHub URL
    const parsed = parseGitHubIssueUrl(data.github_issue_url)
    const repoOwner = parsed?.owner ?? 'unknown'
    const repoName = parsed?.repo ?? 'unknown'
    const issueNumber = parsed?.issueNumber ?? 0

    const now = new Date().toISOString()
    const id = generateUuid()

    const task: Task = {
      id,
      github_issue_url: data.github_issue_url,
      github_issue_number: issueNumber,
      github_issue_title: `Issue #${issueNumber} from ${repoOwner}/${repoName}`,
      github_issue_body_sanitized: '',
      repo_owner: repoOwner,
      repo_name: repoName,
      repo_full_name: `${repoOwner}/${repoName}`,
      repo_profile: null,
      template_id: data.template_id,
      template,
      task_type: ((): TaskType => {
        const slug = template?.slug ?? ''
        return includes(KNOWN_TASK_TYPES, slug) ? slug : 'write-tests'
      })(),
      requester_id: userId,
      requester,
      status: 'open',
      claimed_by: null,
      claimed_at: null,
      last_heartbeat_at: null,
      completed_at: null,
      pr_url: null,
      pr_number: null,
      pr_merged: false,
      pr_closed: false,
      created_at: now,
      updated_at: now,
      tags: [],
    }

    task.repo_profile = buildRepoProfile(task)
    this.store.tasks.set(id, task)
    return task
  }

  async claimTask(taskId: string, userId: string): Promise<ClaimResult> {
    const task = this.store.tasks.get(taskId)
    if (!task) {
      return { success: false, error: 'Task not found' }
    }
    if (task.status !== 'open') {
      return { success: false, error: `Task is not open (current status: ${task.status})` }
    }

    const claimToken = generateToken()
    const now = new Date().toISOString()

    const updated: Task = {
      ...task,
      status: 'claimed',
      claimed_by: userId,
      claimed_at: now,
      updated_at: now,
    }
    this.store.tasks.set(taskId, updated)
    this.store.claims.set(taskId, { token: claimToken, userId })

    return { success: true, task: updated, claim_token: claimToken }
  }

  async unclaimTask(
    taskId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const task = this.store.tasks.get(taskId)
    if (!task) {
      return { success: false, error: 'Task not found' }
    }
    if (task.claimed_by !== userId) {
      return { success: false, error: 'You do not hold this claim' }
    }
    if (task.status !== 'claimed' && task.status !== 'in_progress') {
      return { success: false, error: 'Task is not in a claimable state' }
    }

    const now = new Date().toISOString()
    this.store.tasks.set(taskId, {
      ...task,
      status: 'open',
      claimed_by: null,
      claimed_at: null,
      last_heartbeat_at: null,
      updated_at: now,
    })
    this.store.claims.delete(taskId)

    return { success: true }
  }

  async completeTask(
    taskId: string,
    userId: string,
    data: CompleteTaskInput,
  ): Promise<CompleteResult> {
    const task = this.store.tasks.get(taskId)
    if (!task) {
      return { success: false, error: 'Task not found' }
    }
    if (task.claimed_by !== userId) {
      return { success: false, error: 'You do not hold this claim' }
    }
    if (task.status !== 'claimed' && task.status !== 'in_progress') {
      return { success: false, error: 'Task must be claimed or in_progress to complete' }
    }

    const now = new Date().toISOString()
    const prNumber = data.pr_url
      ? parseInt(data.pr_url.split('/').pop() ?? '0', 10) || null
      : null

    // Estimate cost from token counts if provided
    let estimatedCost: number | null = null
    if (data.input_tokens !== undefined && data.output_tokens !== undefined) {
      // Simple estimate: assume Sonnet pricing as a fallback
      const inputMtok = data.input_tokens / 1_000_000
      const outputMtok = data.output_tokens / 1_000_000
      estimatedCost = inputMtok * 3.0 + outputMtok * 15.0
    }

    const completion: TaskCompletion = {
      id: generateUuid(),
      task_id: taskId,
      task: null,
      donor_id: userId,
      donor: this.store.profiles.get(userId) ?? null,
      pr_url: data.pr_url ?? null,
      pr_number: prNumber,
      pr_merged: false,
      input_tokens: data.input_tokens ?? null,
      output_tokens: data.output_tokens ?? null,
      estimated_cost_usd: estimatedCost,
      ai_provider: data.ai_provider ?? null,
      ai_model: data.ai_model ?? null,
      issue_comment_url: data.issue_comment_url ?? null,
      completed_at: now,
      requester_rating: null,
      requester_note: null,
    }

    this.store.completions.set(completion.id, completion)

    const updatedTask: Task = {
      ...task,
      status: 'completed',
      completed_at: now,
      pr_url: data.pr_url ?? task.pr_url,
      pr_number: prNumber ?? task.pr_number,
      updated_at: now,
    }
    this.store.tasks.set(taskId, updatedTask)
    this.store.claims.delete(taskId)

    return { success: true, completion: { ...completion, task: updatedTask } }
  }

  async heartbeat(
    taskId: string,
    claimToken: string,
  ): Promise<{ success: boolean; error?: string }> {
    const task = this.store.tasks.get(taskId)
    if (!task) {
      return { success: false, error: 'Task not found' }
    }

    const claim = this.store.claims.get(taskId)
    if (!claim || claim.token !== claimToken) {
      return { success: false, error: 'Invalid claim token' }
    }

    const now = new Date().toISOString()
    // Transition claimed → in_progress on the first heartbeat
    const newStatus = task.status === 'claimed' ? 'in_progress' : task.status

    this.store.tasks.set(taskId, {
      ...task,
      status: newStatus,
      last_heartbeat_at: now,
      updated_at: now,
    })

    return { success: true }
  }

  // ---------- Templates ----------

  async getTemplates(): Promise<Template[]> {
    return Array.from(this.store.templates.values())
  }

  // ---------- Profiles ----------

  async getProfile(username: string): Promise<Profile | null> {
    return this.store.profilesByUsername.get(username) ?? null
  }

  // ---------- Stats & Feed ----------

  async getPlatformStats(): Promise<PlatformStats> {
    return this.store.stats
  }

  async getActivityFeed(limit = 20): Promise<ActivityFeedItem[]> {
    return this.store.activity.slice(0, limit)
  }

  // ---------- Pricing ----------

  async getProviderPricing(): Promise<ProviderPricing[]> {
    return this.store.pricing
  }

  // ---------- Prompt ----------

  async getGeneratedPrompt(taskId: string): Promise<GeneratedPrompt | null> {
    const task = this.store.tasks.get(taskId)
    if (!task) return null

    const template = task.template
    const repoCtx = `Repository: ${task.repo_full_name}
GitHub issue: ${task.github_issue_url}
Issue title: ${task.github_issue_title}
Issue body:
${task.github_issue_body_sanitized || '(No body provided)'}

Tags: ${task.tags.join(', ')}`

    const issueCtx = `You are working on GitHub issue #${task.github_issue_number} in ${task.repo_full_name}.
The issue is titled: "${task.github_issue_title}"`

    const taskInstructions = template
      ? `Task type: ${template.name}
${template.description}

Execution mode: ${template.recommended_mode}
Output type: ${template.output_type === 'draft-pr' ? 'Open a draft pull request with your changes' : 'Post an issue comment with your findings'}
${template.file_restrictions ? `\nFile restrictions (only modify files matching these globs):\n${template.file_restrictions.map((g) => `  - ${g}`).join('\n')}` : ''}`
      : `Task type: ${task.task_type}
Complete the work described in the issue and open a draft pull request with your changes.`

    const fullPrompt = `${repoCtx}

---

${issueCtx}

${taskInstructions}

When finished, follow the repository's contribution guidelines and open a draft PR targeting the default branch.`

    return {
      task_id: taskId,
      full_prompt: fullPrompt,
      repo_context: repoCtx,
      issue_context: issueCtx,
      task_instructions: taskInstructions,
      execution_mode: template?.recommended_mode ?? 'safe',
      generated_at: new Date().toISOString(),
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let instance: MockDataService | null = null

export function createMockDataService(): MockDataService {
  if (!instance) {
    instance = new MockDataService()
  }
  return instance
}
