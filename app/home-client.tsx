'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { ChevronDown, Shield, Wrench } from 'lucide-react'

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
import { CopyPromptModal } from '@/components/copy-prompt-modal'
import { useRequestModal } from '@/components/use-request-modal'
import { useCopyPromptModal } from '@/components/use-copy-prompt-modal'

import type {
  Task,
  Template,
  PlatformStats,
  ActivityFeedItem,
  TopDonor,
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
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
        {/* Review a PR (safe) */}
        <div>
          <div className="mb-3 flex items-center gap-1.5">
            <Shield className="size-4 text-emerald-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Review a PR (safe)
            </p>
          </div>
          <ol className="space-y-3">
            {[
              'Browse the task board for review tasks',
              'Click "Copy Prompt" — the AI-ready prompt is copied',
              'Paste into your AI tool — it reviews the diff and posts findings',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 font-mono text-[11px] font-semibold text-emerald-600">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Build from Issue (advanced) */}
        <div>
          <div className="mb-3 flex items-center gap-1.5">
            <Wrench className="size-4 text-amber-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Build from Issue (advanced)
            </p>
          </div>
          <ol className="space-y-3">
            {[
              'Browse the task board for build tasks',
              'Click "Copy Prompt" — review the prompt and advanced options',
              'Paste into your AI tool — it clones, codes, and opens a draft PR',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 font-mono text-[11px] font-semibold text-amber-600">
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
    a: 'Any AI coding tool that accepts a prompt — Claude Code, Codex CLI, Gemini, ChatGPT, etc. Copy the prompt, paste it into your tool, and let it work.',
  },
  {
    q: 'Do I need coding skills to help?',
    a: 'No. The AI handles the implementation. You copy a prompt, paste it into your tool, and walk away. For PR reviews, the AI reads the diff and writes findings.',
  },
  {
    q: 'Is this safe? What if the AI runs something dangerous?',
    a: 'PR review tasks instruct a read-only clone — no install, no execution. Build tasks may instruct the AI to run commands. Your AI tool has its own permission model — review the prompt before executing.',
  },
  {
    q: 'What if I never finish or the PR gets rejected?',
    a: 'Tasks are non-exclusive — multiple people can work the same task. If you walk away, the task stays on the board. Draft PRs can be closed with no harm done.',
  },
  {
    q: 'Who can post tasks?',
    a: 'Anyone with a GitHub account. Paste a public GitHub issue or PR URL, pick a template, and your task is live on the board immediately.',
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
}: HomeClientProps) {
  const {
    open: requestOpen,
    openModal: openRequestModal,
    closeModal: closeRequestModal,
  } = useRequestModal()

  const {
    open: copyPromptOpen,
    currentTask,
    openModal: openCopyPromptModal,
    closeModal: closeCopyPromptModal,
  } = useCopyPromptModal()

  const handleCopyPrompt = React.useCallback(
    (task: Task) => {
      openCopyPromptModal(task)
    },
    [openCopyPromptModal],
  )

  const handleRequestSubmit = React.useCallback(
    async (data: {
      github_issue_url?: string
      github_pr_url?: string
      template_id: string
    }) => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }))
        toast.error(body.error ?? 'Failed to create task')
        throw new Error(body.error)
      }

      toast.success('Task posted!')
    },
    [],
  )

  return (
    <>
      {/* Hero Bar */}
      <section className="border-b border-border bg-background px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-4xl space-y-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Help open source maintainers clear their backlog.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            Browse tasks, copy a prompt, paste into your AI tool.
            <br />
            Review PRs or build features — your tokens, their project.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button onClick={openRequestModal}>Request a Task</Button>
            <Button variant="outline" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
              How It Works
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-10 px-4 py-10">
        {/* Stats Strip */}
        <StatsStrip stats={stats} />

        {/* Task Card List */}
        <section>
          <TaskCardList tasks={tasks} onRunThis={handleCopyPrompt} />
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

      <CopyPromptModal
        open={copyPromptOpen}
        onOpenChange={(open) => (open ? undefined : closeCopyPromptModal())}
        task={currentTask}
      />
    </>
  )
}
