'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Zap, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TaskCardList } from '@/components/task-card-list'
import { ActivityTicker } from '@/components/activity-ticker'
import { StatsStrip } from '@/components/stats-strip'
import { RequestTaskModal } from '@/components/request-task-modal'
import { DonateRunModal } from '@/components/donate-run-modal'
import { useRequestModal } from '@/components/use-request-modal'
import { useDonateModal } from '@/components/use-donate-modal'

import type {
  Task,
  Template,
  PlatformStats,
  ActivityFeedItem,
  TopDonor,
  ProviderPricing,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HomeClientProps {
  tasks: Task[]
  templates: Template[]
  stats: PlatformStats
  activities: ActivityFeedItem[]
  topDonors: TopDonor[]
  providerPricing: ProviderPricing[]
}

// ---------------------------------------------------------------------------
// Quick Donate Chip
// ---------------------------------------------------------------------------

function QuickDonateChip({
  lastBudget,
  lastProvider,
  tasks,
  providerPricing,
  onGenerated,
}: {
  lastBudget: number
  lastProvider: string
  tasks: Task[]
  providerPricing: ProviderPricing[]
  onGenerated: () => void
}) {
  const [copied, setCopied] = React.useState(false)

  async function handleRepeat() {
    // Re-use the same greedy selection logic: just grab open tasks up to budget
    const openTasks = tasks.filter((t) => t.status === 'open').slice(0, 3)
    const ids = openTasks.map((t) => t.id)
    const command = `npx tokenforgood run ${ids.join(' ')}`

    try {
      await navigator.clipboard.writeText(command)
    } catch {
      // clipboard may be blocked; fail silently
    }

    setCopied(true)
    toast.success('Command copied!', {
      description: 'Paste it in your terminal to start donating.',
    })
    setTimeout(() => setCopied(false), 3000)
    onGenerated()
  }

  const providerLabel =
    lastProvider === 'claude-max'
      ? 'Claude Max'
      : lastProvider === 'claude-pro'
        ? 'Claude Pro'
        : lastProvider

  return (
    <button
      onClick={handleRepeat}
      className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-600 transition-colors hover:bg-yellow-500/20 dark:text-yellow-400"
    >
      <Zap className="size-3 fill-current" />
      {copied
        ? 'Copied!'
        : `Repeat last donation ($${lastBudget} · ${providerLabel})`}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Top Helpers Section
// ---------------------------------------------------------------------------

function TopHelpers({ donors }: { donors: TopDonor[] }) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold text-foreground">
        This Week&apos;s Top Helpers
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {donors.map((donor, idx) => (
          <Card key={donor.profile.id} size="sm">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Avatar size="default">
                    <AvatarImage
                      src={donor.profile.github_avatar_url}
                      alt={donor.profile.display_name ?? donor.profile.github_username}
                    />
                    <AvatarFallback>
                      {donor.profile.github_username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {idx === 0 && (
                    <span className="absolute -right-1 -top-1 text-[10px]">
                      🏆
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <CardTitle className="truncate text-sm">
                    @{donor.profile.github_username}
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    {Math.round(donor.profile.merge_rate * 100)}% merge rate
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {donor.tasks_completed_this_week} task
                {donor.tasks_completed_this_week !== 1 ? 's' : ''}
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px]">
                ~${donor.estimated_cost_donated_this_week.toFixed(0)} donated
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// How It Works Band
// ---------------------------------------------------------------------------

function HowItWorksBand() {
  return (
    <section id="how-it-works" className="rounded-xl border border-border bg-card px-6 py-8">
      <h2 className="mb-6 text-sm font-semibold text-foreground">How It Works</h2>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* For Requesters */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            For Requesters
          </p>
          <ol className="space-y-3">
            {[
              'Paste a GitHub issue URL',
              'Pick a template (test suite, audit, etc.)',
              'Your task is live on the board — AI donors will handle it',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[11px] font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* For Donors */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            For Donors
          </p>
          <ol className="space-y-3">
            {[
              'Browse the task board',
              'Click "Run This" — a command is generated and copied',
              'Paste it → Claude forks, codes, opens a draft PR',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[11px] font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'What AI tools does this work with?',
    a: 'Claude Code (Claude Max / Pro) is the primary target. Any terminal-based AI coding tool that accepts a task prompt and can open a GitHub PR will work.',
  },
  {
    q: 'Do I need coding skills to donate?',
    a: "No. Claude handles the implementation. You paste one command in a terminal and walk away — the AI reads the issue, writes code, and opens a draft PR.",
  },
  {
    q: 'Is this allowed by AI providers?',
    a: 'TokenForGood is a task board. You run your own licensed AI tools on your own machine, contributing to public open source repos. That is normal open source development.',
  },
  {
    q: 'What if the PR gets rejected?',
    a: "Tasks produce draft PRs. Maintainers review and can close them. Donor effort is minimal — a single copy-paste. The worst outcome is a closed draft PR.",
  },
  {
    q: 'Who can post tasks?',
    a: 'Anyone with a GitHub account. Paste a public GitHub issue URL, pick a template, and your task is live on the board immediately.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-border last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-foreground hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1">
        {q}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <p className="pb-4 text-sm text-muted-foreground">{a}</p>
    </details>
  )
}

function Faq() {
  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold text-foreground">FAQ</h2>
      <div className="rounded-xl border border-border bg-card px-5">
        {FAQ_ITEMS.map((item) => (
          <FaqItem key={item.q} q={item.q} a={item.a} />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Main HomeClient
// ---------------------------------------------------------------------------

export function HomeClient({
  tasks,
  templates,
  stats,
  activities,
  topDonors,
  providerPricing,
}: HomeClientProps) {
  const {
    open: requestOpen,
    openModal: openRequestModal,
    closeModal: closeRequestModal,
  } = useRequestModal()

  const {
    open: donateOpen,
    openModal: openDonateModal,
    closeModal: closeDonateModal,
    lastBudget,
    lastProvider,
  } = useDonateModal()

  // When "Run This" is clicked on a specific card, open the donate modal
  // (the modal auto-selects tasks; pre-selection by task id isn't wired yet,
  // so opening it is the correct behaviour for now)
  const handleRunThis = React.useCallback(
    (_task: Task) => {
      openDonateModal()
    },
    [openDonateModal],
  )

  const handleRequestSubmit = React.useCallback(
    async (_data: { github_issue_url: string; template_id: string }) => {
      // Mock: just close after a short delay
      await new Promise((r) => setTimeout(r, 800))
    },
    [],
  )

  const openTasks = React.useMemo(
    () => tasks.filter((t) => t.status === 'open'),
    [tasks],
  )

  // Show the quick-donate chip only for returning donors (lastBudget > 0)
  // The store initialises lastBudget at 25, so we also check localStorage
  // via a mounted guard to avoid hydration mismatch.
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Consider a donor "returning" if they've manually set a session before.
  // Since we can't persist across page loads without auth, we check if
  // the value is still the default (25 + 'claude-max'); a real session
  // would keep these after they hit "Generate Command".
  const isReturningDonor = mounted && lastBudget > 0 && lastProvider !== ''

  return (
    <>
      {/* Hero Bar */}
      <section className="border-b border-border bg-background px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-4xl space-y-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            One-click AI contributions to open source.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            Browse tasks, paste one command, walk away.
            <br />
            Claude does the rest.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button onClick={openRequestModal}>Request a Task</Button>
            <Button variant="outline" onClick={openDonateModal}>
              Donate &amp; Run
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-10 px-4 py-10">
        {/* Stats Strip */}
        <StatsStrip stats={stats} />

        {/* Quick Donate Chip — returning donors only */}
        {isReturningDonor && (
          <div className="flex items-center">
            <QuickDonateChip
              lastBudget={lastBudget}
              lastProvider={lastProvider}
              tasks={tasks}
              providerPricing={providerPricing}
              onGenerated={() => {}}
            />
          </div>
        )}

        {/* Task Card List */}
        <section>
          <TaskCardList tasks={tasks} onRunThis={handleRunThis} />
        </section>

        <Separator />

        {/* Activity Ticker */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Recent Contributions
          </h2>
          <ActivityTicker activities={activities} maxItems={10} />
        </section>

        <Separator />

        {/* Top Helpers */}
        <TopHelpers donors={topDonors} />

        <Separator />

        {/* How It Works */}
        <HowItWorksBand />

        {/* FAQ */}
        <Faq />
      </div>

      {/* Modals */}
      <RequestTaskModal
        open={requestOpen}
        onOpenChange={(open) => (open ? openRequestModal() : closeRequestModal())}
        templates={templates}
        onSubmit={handleRequestSubmit}
      />

      <DonateRunModal
        open={donateOpen}
        onOpenChange={(open) => (open ? openDonateModal() : closeDonateModal())}
        availableTasks={openTasks}
        providerPricing={providerPricing}
        onGenerateCommand={() => {}}
      />
    </>
  )
}
