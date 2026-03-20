import { notFound } from 'next/navigation'
import Image from 'next/image'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ExternalLink,
  GitMerge,
  GitPullRequest,
  XCircle,
  Calendar,
  CheckCircle2,
  DollarSign,
  BarChart3,
  Layers,
  Lock,
  Cpu,
  Bell,
} from 'lucide-react'

import { getDataService } from '@/lib/services'
import type { Task, TaskCompletion } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { BadgePreview } from '@/components/badge-preview'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TASK_TYPE_LABELS: Record<string, string> = {
  'write-tests': 'Write Tests',
  'implement-feature': 'Feature',
  'security-audit': 'Security Audit',
  'architecture-review': 'Arch Review',
  'add-documentation': 'Docs',
  'setup-cicd': 'CI/CD',
  'migrate-framework': 'Migration',
  'add-types': 'Add Types',
  'dependency-audit': 'Dep Audit',
  'code-quality-review': 'Code Quality',
  'performance-analysis': 'Performance',
  'accessibility-audit': 'A11y Audit',
}

const PROVIDER_LABELS: Record<string, string> = {
  'claude-max': 'Claude Max',
  'claude-pro': 'Claude Pro',
  'chatgpt-pro': 'ChatGPT Pro',
  'github-copilot': 'GitHub Copilot',
  'gemini-advanced': 'Gemini Advanced',
}

/** Derive synthetic TaskCompletion objects from a profile's completed tasks. */
function buildMockCompletions(
  profileId: string,
  completedTasks: Task[],
): TaskCompletion[] {
  return completedTasks.map((task, i) => ({
    id: `mock-completion-${task.id}`,
    task_id: task.id,
    task,
    donor_id: profileId,
    donor: null,
    pr_url: task.pr_url,
    pr_number: task.pr_number,
    pr_merged: task.pr_merged,
    input_tokens: 18000 + i * 3200,
    output_tokens: 4200 + i * 800,
    estimated_cost_usd: parseFloat((3.5 + i * 1.2).toFixed(2)),
    ai_provider: 'claude-max',
    ai_model: 'sonnet',
    issue_comment_url: null,
    completed_at: task.completed_at ?? task.updated_at,
    requester_rating: null,
    requester_note: null,
  }))
}

/** Derive unique repo count from a list of completions. */
function countUniqueRepos(completions: TaskCompletion[]): number {
  const repos = new Set(completions.map((c) => c.task?.repo_full_name).filter(Boolean))
  return repos.size
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PRStatusBadge({
  pr_url,
  pr_merged,
  pr_closed,
}: {
  pr_url: string | null
  pr_merged: boolean
  pr_closed: boolean
}) {
  if (!pr_url) return null

  if (pr_merged) {
    return (
      <a
        href={pr_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
      >
        <GitMerge className="size-3" />
        Merged
      </a>
    )
  }

  if (pr_closed) {
    return (
      <a
        href={pr_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline"
      >
        <XCircle className="size-3" />
        Closed
      </a>
    )
  }

  return (
    <a
      href={pr_url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline"
    >
      <GitPullRequest className="size-3" />
      Open PR
    </a>
  )
}

function ContributionRow({ completion }: { completion: TaskCompletion }) {
  const task = completion.task
  if (!task) return null

  const taskTypeLabel = TASK_TYPE_LABELS[task.task_type] ?? task.task_type
  const completedDate = completion.completed_at
    ? format(new Date(completion.completed_at), 'MMM d, yyyy')
    : null

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {task.repo_full_name}
          </span>
          <Badge variant="secondary" className="shrink-0">
            {taskTypeLabel}
          </Badge>
        </div>
        <span className="truncate text-sm font-medium text-foreground">
          {task.github_issue_title}
        </span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {completedDate && (
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {completedDate}
            </span>
          )}
          <PRStatusBadge
            pr_url={completion.pr_url}
            pr_merged={completion.pr_merged}
            pr_closed={task.pr_closed}
          />
        </div>
      </div>
      {task.github_issue_url && (
        <a
          href={task.github_issue_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="View issue"
        >
          <ExternalLink className="size-4" />
        </a>
      )}
    </div>
  )
}

function RequestedTaskRow({ task }: { task: Task }) {
  const taskTypeLabel = TASK_TYPE_LABELS[task.task_type] ?? task.task_type

  const statusColors: Record<string, string> = {
    open: 'text-blue-600 dark:text-blue-400',
    claimed: 'text-yellow-600 dark:text-yellow-400',
    in_progress: 'text-orange-600 dark:text-orange-400',
    completed: 'text-green-600 dark:text-green-400',
    failed: 'text-red-600 dark:text-red-400',
    stalled: 'text-muted-foreground',
    expired: 'text-muted-foreground',
    stale: 'text-muted-foreground',
  }

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {task.repo_full_name}
          </span>
          <Badge variant="secondary" className="shrink-0">
            {taskTypeLabel}
          </Badge>
        </div>
        <span className="truncate text-sm font-medium text-foreground">
          {task.github_issue_title}
        </span>
        <span
          className={`text-xs font-medium capitalize ${statusColors[task.status] ?? 'text-muted-foreground'}`}
        >
          {task.status.replace(/_/g, ' ')}
        </span>
      </div>
      {task.github_issue_url && (
        <a
          href={task.github_issue_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="View issue"
        >
          <ExternalLink className="size-4" />
        </a>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | number
}) {
  return (
    <Card size="sm" className="flex-1">
      <CardContent className="flex flex-col gap-1 pt-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="size-3.5" />
          <span className="text-xs">{label}</span>
        </div>
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {value}
        </span>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Mock dashboard data
// ---------------------------------------------------------------------------

const MOCK_ACTIVE_CLAIMS = [
  {
    id: 'mock-claim-1',
    issue_title: 'Write tests for new App Router middleware pipeline',
    repo: 'vercel/next.js',
    status: 'in_progress' as const,
    claimed_at: '2026-03-19T06:00:00.000Z',
  },
  {
    id: 'mock-claim-2',
    issue_title: 'Generate API docs for all public router procedures',
    repo: 'trpc/trpc',
    status: 'claimed' as const,
    claimed_at: '2026-03-18T08:00:00.000Z',
  },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ user: string }>
}) {
  const { user } = await params
  const service = getDataService()

  const profile = await service.getProfile(user)
  if (!profile) notFound()

  // Fetch only the tasks relevant to this user — avoids a full table scan
  const [donorResult, requesterResult] = await Promise.all([
    service.getTasksByDonor(profile.id),
    service.getTasksByRequester(profile.id),
  ])

  const completedTasks = donorResult.data
  const requestedTasks = requesterResult.data

  // Build synthetic completions to fill up to profile.tasks_completed count
  const completions = buildMockCompletions(profile.id, completedTasks)
  const uniqueRepos = countUniqueRepos(completions)

  const memberSince = format(new Date(profile.created_at), 'MMMM yyyy')

  // Determine if this is "own profile" (no auth yet — always show for demo if
  // the username matches "sarah-chen", the first mock user)
  const isOwnProfile = profile.github_username === 'sarah-chen'

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* ------------------------------------------------------------------ */}
      {/* Profile Header                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-full ring-2 ring-foreground/10">
          <Image
            src={profile.github_avatar_url}
            alt={`${profile.github_username} avatar`}
            fill
            className="object-cover"
            unoptimized
          />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              {profile.display_name ?? profile.github_username}
            </h1>
            <span className="font-mono text-base text-muted-foreground">
              @{profile.github_username}
            </span>
          </div>

          {profile.bio && (
            <p className="max-w-xl text-sm text-muted-foreground">{profile.bio}</p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <a
              href={`https://github.com/${profile.github_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <ExternalLink className="size-3" />
              github.com/{profile.github_username}
            </a>
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              Member since {memberSince}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Stats Row                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-8 flex flex-wrap gap-3">
        <StatCard
          icon={CheckCircle2}
          label="Tasks completed"
          value={profile.tasks_completed}
        />
        <StatCard
          icon={DollarSign}
          label="Compute donated"
          value={`~$${profile.estimated_cost_donated_usd.toFixed(0)}`}
        />
        <StatCard
          icon={BarChart3}
          label="Merge rate"
          value={`${(profile.merge_rate * 100).toFixed(0)}%`}
        />
        <StatCard
          icon={Layers}
          label="Projects helped"
          value={uniqueRepos > 0 ? uniqueRepos : profile.tasks_completed > 0 ? '—' : 0}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tabs                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Tabs defaultValue="contributions" className="mb-10">
        <TabsList variant="line" className="mb-6 w-full justify-start">
          <TabsTrigger value="contributions">
            Contributions
            {completions.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {profile.tasks_completed}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="requested">
            Requested
            {requestedTasks.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {requestedTasks.length}
              </span>
            )}
          </TabsTrigger>
          {isOwnProfile && (
            <TabsTrigger value="dashboard">
              My Dashboard
              <Lock className="ml-1 size-3 text-muted-foreground" />
            </TabsTrigger>
          )}
        </TabsList>

        {/* -------- Contributions -------- */}
        <TabsContent value="contributions">
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm text-muted-foreground">
                {completions.length > 0
                  ? `${profile.tasks_completed} completed contribution${profile.tasks_completed !== 1 ? 's' : ''}`
                  : 'Completed contributions'}
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border px-4">
              {completions.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No contributions yet
                </div>
              ) : (
                completions.map((c) => (
                  <ContributionRow key={c.id} completion={c} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- Requested -------- */}
        <TabsContent value="requested">
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm text-muted-foreground">
                {requestedTasks.length > 0
                  ? `${requestedTasks.length} task${requestedTasks.length !== 1 ? 's' : ''} requested`
                  : 'Tasks requested'}
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border px-4">
              {requestedTasks.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No tasks requested yet
                </div>
              ) : (
                requestedTasks.map((t) => (
                  <RequestedTaskRow key={t.id} task={t} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- My Dashboard (own profile only) -------- */}
        {isOwnProfile && (
          <TabsContent value="dashboard">
            <div className="space-y-6">
              {/* Auth notice */}
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <Lock className="mb-1 inline size-4 align-text-bottom" />
                {' '}You need to be logged in to view your live dashboard. The preview
                below uses mock data.
              </div>

              {/* Active Claims */}
              <Card>
                <CardHeader className="border-b pb-3">
                  <CardTitle>Active Claims</CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border px-4">
                  {MOCK_ACTIVE_CLAIMS.map((claim) => (
                    <div
                      key={claim.id}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs text-muted-foreground">
                          {claim.repo}
                        </span>
                        <span className="text-sm font-medium">{claim.issue_title}</span>
                        <span className="text-xs text-muted-foreground">
                          Claimed{' '}
                          {formatDistanceToNow(new Date(claim.claimed_at), {
                            addSuffix: true,
                          })}
                          {' · '}
                          <span
                            className={
                              claim.status === 'in_progress'
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-yellow-600 dark:text-yellow-400'
                            }
                          >
                            {claim.status.replace(/_/g, ' ')}
                          </span>
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <input
                          type="url"
                          placeholder="PR URL"
                          className="h-7 w-48 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80">
                          <CheckCircle2 className="size-3" />
                          Mark Complete
                        </button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Preferences */}
              <Card>
                <CardHeader className="border-b pb-3">
                  <CardTitle>Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Cpu className="size-4 text-muted-foreground" />
                      <span>Preferred provider</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {profile.preferred_provider
                        ? PROVIDER_LABELS[profile.preferred_provider] ??
                          profile.preferred_provider
                        : 'Not set'}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Cpu className="size-4 text-muted-foreground" />
                      <span>Preferred model</span>
                    </div>
                    <span className="text-sm text-muted-foreground capitalize">
                      {profile.preferred_model ?? 'Not set'}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Bell className="size-4 text-muted-foreground" />
                      <span>Email notifications</span>
                    </div>
                    <span
                      className={`text-sm ${profile.email_notifications ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
                    >
                      {profile.email_notifications ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* ------------------------------------------------------------------ */}
      {/* GitHub Badge                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Separator className="mb-8" />

      <BadgePreview
        username={profile.github_username}
        tasksCompleted={profile.tasks_completed}
      />
    </div>
  )
}
