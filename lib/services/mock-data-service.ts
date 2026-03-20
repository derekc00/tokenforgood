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
  AIModel,
  TaskType,
  RepoProfile,
} from '@/lib/types'
import type { CompleteTaskInput, TaskFilterInput } from '@/lib/schemas'
import type {
  DataService,
  PaginatedResult,
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
  source_type?: string
  github_issue_url: string
  github_issue_number: number
  github_issue_title: string
  github_issue_body_sanitized: string
  github_pr_url?: string | null
  github_pr_number?: number | null
  repo_owner: string
  repo_name: string
  repo_full_name: string
  task_type: string
  template_id: string
  requester_id: string
  status: string
  pick_count?: number
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

/** Normalises provider strings from JSON (underscores) to the AIProvider union (hyphens). */
function normaliseProvider(raw: string | null): AIProvider | null {
  if (!raw) return null
  return raw.replace(/_/g, '-') as AIProvider
}

/** Coerces a raw profile from JSON to the typed Profile shape. */
function coerceProfile(raw: RawProfile): Profile {
  return {
    ...raw,
    display_name: raw.display_name,
    bio: raw.bio,
    preferred_provider: normaliseProvider(raw.preferred_provider),
    preferred_model: (raw.preferred_model as AIModel | null) ?? null,
  }
}

/** Coerces a raw task from JSON to the typed Task shape (without relations). */
function coerceTask(raw: RawTask): Task {
  return {
    id: raw.id,
    source_type: (raw.source_type as Task['source_type']) ?? 'issue',
    github_issue_url: raw.github_issue_url,
    github_issue_number: raw.github_issue_number,
    github_issue_title: raw.github_issue_title,
    github_issue_body_sanitized: raw.github_issue_body_sanitized,
    github_pr_url: raw.github_pr_url ?? null,
    github_pr_number: raw.github_pr_number ?? null,
    repo_owner: raw.repo_owner,
    repo_name: raw.repo_name,
    repo_full_name: raw.repo_full_name,
    repo_profile: null,
    template_id: raw.template_id,
    template: null,
    task_type: raw.task_type as TaskType,
    requester_id: raw.requester_id,
    requester: null,
    status: raw.status as Task['status'],
    pick_count: raw.pick_count ?? 0,
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
    const providerKey = normaliseProvider(provider.id) as AIProvider
    const isFlat = provider.billing_model === 'flat_rate_estimate'

    for (const model of provider.models) {
      const flatRates: Partial<Record<TaskType, number>> | null = isFlat
        ? buildFlatRatesFromTaskTypes(model)
        : null

      result.push({
        provider: providerKey,
        model: model.id as AIModel,
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
    const taskType = taskTypeStr as TaskType
    const tier = tierMap[taskType] ?? 'medium'
    const cost = rates[tier]
    if (cost !== undefined) {
      perTask[taskType] = cost
    }
  }

  return Object.keys(perTask).length > 0 ? perTask : null
}

// ---------------------------------------------------------------------------
// Store — internal mutable state for the mock service
// ---------------------------------------------------------------------------

interface MockStore {
  tasks: Map<string, Task>
  profiles: Map<string, Profile>           // keyed by id
  profilesByUsername: Map<string, Profile> // keyed by github_username
  templates: Map<string, Template>         // keyed by id
  templatesBySlug: Map<string, Template>   // keyed by slug
  completions: Map<string, TaskCompletion> // keyed by completion id
  activity: ActivityFeedItem[]
  stats: PlatformStats
  pricing: ProviderPricing[]
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
    for (const raw of rawProfiles as RawProfile[]) {
      const profile = coerceProfile(raw)
      profiles.set(profile.id, profile)
      profilesByUsername.set(profile.github_username, profile)
    }

    // Templates
    const templates = new Map<string, Template>()
    const templatesBySlug = new Map<string, Template>()
    for (const raw of rawTemplates as Template[]) {
      templates.set(raw.id, raw)
      templatesBySlug.set(raw.slug, raw)
    }

    // Tasks — enrich with relations after both maps are built
    const tasks = new Map<string, Task>()
    for (const raw of rawTasks as RawTask[]) {
      const task = coerceTask(raw)
      task.template = templates.get(task.template_id) ?? null
      task.requester = profiles.get(task.requester_id) ?? null
      task.repo_profile = buildRepoProfile(task)
      tasks.set(task.id, task)
    }

    // Activity — enrich partial objects using the in-memory maps
    const activity: ActivityFeedItem[] = (rawActivity as RawActivityItem[]).map(
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
        const [repoOwner = '', repoName = ''] = item.task.repo_full_name.split('/')
        const task: Task = fullTask ?? {
          id: item.task.id,
          source_type: 'issue',
          github_issue_url: '',
          github_issue_number: 0,
          github_issue_title: item.task.github_issue_title,
          github_issue_body_sanitized: '',
          github_pr_url: null,
          github_pr_number: null,
          repo_owner: repoOwner,
          repo_name: repoName,
          repo_full_name: item.task.repo_full_name,
          repo_profile: null,
          template_id: '',
          template: null,
          task_type: item.task.task_type as TaskType,
          requester_id: '',
          requester: null,
          status: 'open',
          pick_count: 0,
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
          action: item.action as ActivityFeedItem['action'],
          pr_url: item.pr_url,
          created_at: item.created_at,
        }
      },
    )

    // Stats — enrich top-donor profiles from in-memory map
    const rawS = rawStats as RawStats
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
    const pricing = flattenPricing(rawPricing as RawPricing)

    return {
      tasks,
      profiles,
      profilesByUsername,
      templates,
      templatesBySlug,
      completions: new Map(),
      activity,
      stats,
      pricing,
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

    // Filter by source_type
    if (filters?.source_type) {
      results = results.filter((t) => t.source_type === filters.source_type)
    }

    // Filter by token_estimate bucket
    if (filters?.token_estimate && filters.token_estimate !== 'any') {
      results = results.filter((t) =>
        matchesTokenFilter(t.template, filters.token_estimate as string),
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

  async createTask(
    data: { github_issue_url?: string; github_pr_url?: string; template_id: string },
    userId: string,
  ): Promise<Task> {
    const template = this.store.templates.get(data.template_id) ?? null
    const requester = this.store.profiles.get(userId) ?? null

    const isPR = !!data.github_pr_url
    const url = data.github_pr_url ?? data.github_issue_url ?? ''

    // Parse owner/repo/number from the GitHub URL
    const urlMatch = isPR
      ? url.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/)
      : url.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)/)
    const repoOwner = urlMatch?.[1] ?? 'unknown'
    const repoName = urlMatch?.[2] ?? 'unknown'
    const number = urlMatch?.[3] ? parseInt(urlMatch[3], 10) : 0

    const now = new Date().toISOString()
    const id = generateUuid()

    const task: Task = {
      id,
      source_type: isPR ? 'pull-request' : 'issue',
      github_issue_url: data.github_issue_url ?? '',
      github_issue_number: isPR ? 0 : number,
      github_issue_title: isPR
        ? `PR #${number} from ${repoOwner}/${repoName}`
        : `Issue #${number} from ${repoOwner}/${repoName}`,
      github_issue_body_sanitized: '',
      github_pr_url: data.github_pr_url ?? null,
      github_pr_number: isPR ? number : null,
      repo_owner: repoOwner,
      repo_name: repoName,
      repo_full_name: `${repoOwner}/${repoName}`,
      repo_profile: null,
      template_id: data.template_id,
      template,
      task_type: (template?.slug ?? 'write-tests') as TaskType,
      requester_id: userId,
      requester,
      status: 'open',
      pick_count: 0,
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

  async pickTask(
    taskId: string,
    _donorId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const task = this.store.tasks.get(taskId)
    if (!task) {
      return { success: false, error: 'Task not found' }
    }

    const now = new Date().toISOString()
    const newStatus: Task['status'] =
      task.status === 'open' ? 'picked' : task.status

    this.store.tasks.set(taskId, {
      ...task,
      status: newStatus,
      pick_count: task.pick_count + 1,
      updated_at: now,
    })

    return { success: true }
  }

  async expirePickedTasks(maxAgeHours = 24): Promise<number> {
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000
    let expired = 0

    const now = new Date().toISOString()

    for (const [id, task] of this.store.tasks) {
      if (
        task.status === 'picked' &&
        new Date(task.updated_at).getTime() < cutoff
      ) {
        this.store.tasks.set(id, {
          ...task,
          status: 'open',
          updated_at: now,
        })
        expired++
      }
    }

    return expired
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
    if (task.status !== 'picked' && task.status !== 'in_progress') {
      return { success: false, error: 'Task must be picked or in_progress to complete' }
    }

    const now = new Date().toISOString()
    const prNumber = data.pr_url
      ? parseInt(data.pr_url.split('/').pop() ?? '0', 10) || null
      : null

    // Estimate cost from token counts if provided
    let estimatedCost: number | null = null
    if (data.input_tokens !== undefined && data.output_tokens !== undefined) {
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

    return { success: true, completion: { ...completion, task: updatedTask } }
  }

  // ---------- Templates ----------

  async getTemplates(): Promise<Template[]> {
    return Array.from(this.store.templates.values())
  }

  async getTemplate(id: string): Promise<Template | null> {
    return this.store.templates.get(id) ?? null
  }

  async getTemplateBySlug(slug: string): Promise<Template | null> {
    return this.store.templatesBySlug.get(slug) ?? null
  }

  // ---------- Profiles ----------

  async getProfile(username: string): Promise<Profile | null> {
    return this.store.profilesByUsername.get(username) ?? null
  }

  async getProfileById(id: string): Promise<Profile | null> {
    return this.store.profiles.get(id) ?? null
  }

  async updateProfile(id: string, data: Partial<Profile>): Promise<Profile> {
    const existing = this.store.profiles.get(id)
    if (!existing) {
      throw new Error(`Profile not found: ${id}`)
    }
    const updated: Profile = {
      ...existing,
      ...data,
      id, // never overwrite id
      updated_at: new Date().toISOString(),
    }
    this.store.profiles.set(id, updated)
    this.store.profilesByUsername.set(updated.github_username, updated)
    return updated
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
