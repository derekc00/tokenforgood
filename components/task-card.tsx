"use client"

import { formatDistanceToNow } from "date-fns"
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  PlayCircle,
  Cpu,
  Shield,
  Wrench,
  ShieldCheck,
} from "lucide-react"

import { type Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

// ---------------------------------------------------------------------------
// Status indicator
// ---------------------------------------------------------------------------

function StatusIndicator({ task }: { task: Task }) {
  const { status, pick_count, pr_url } = task

  if (status === "open") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-500">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-pulse rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        Open
      </span>
    )
  }

  if (status === "picked") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-500">
        <span className="relative flex size-2">
          <span className="relative inline-flex size-2 rounded-full bg-amber-400" />
        </span>
        {pick_count > 1
          ? `${pick_count} donors working on this`
          : "1 donor working on this"}
      </span>
    )
  }

  if (status === "in_progress") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-blue-500">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-pulse rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
        </span>
        In progress
      </span>
    )
  }

  if (status === "completed") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-emerald-500" />
        {pr_url ? (
          <a
            href={pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 hover:underline"
          >
            Resolved
            <ExternalLink className="size-2.5 opacity-60" />
          </a>
        ) : (
          <span>Completed</span>
        )}
      </span>
    )
  }

  if (status === "verified") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-emerald-600" />
        Verified by maintainer
      </span>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Lane indicator
// ---------------------------------------------------------------------------

function LaneIndicator({ task }: { task: Task }) {
  if (task.source_type === "pull-request") {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600">
        <Shield className="size-3" />
        Review
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-amber-600">
      <Wrench className="size-3" />
      Build
    </span>
  )
}

// ---------------------------------------------------------------------------
// Token estimate label
// ---------------------------------------------------------------------------

function tokenLabel(low: number, high: number): string {
  const avg = Math.round((low + high) / 2)
  if (avg >= 1000) {
    return `~${(avg / 1000).toFixed(0)}M tokens`
  }
  return `~${avg}k tokens`
}

// ---------------------------------------------------------------------------
// TaskCard
// ---------------------------------------------------------------------------

export interface TaskCardProps {
  task: Task
  onRunThis?: (task: Task) => void
  showCompletedBy?: boolean
  className?: string
}

export function TaskCard({
  task,
  onRunThis,
  showCompletedBy = true,
  className,
}: TaskCardProps) {
  const { template, repo_profile } = task

  const tags = task.tags.slice(0, 5)

  // Determine display title: PR # for PR tasks, Issue # for issue tasks
  const titleLine =
    task.source_type === "pull-request" && task.github_pr_number
      ? `PR #${task.github_pr_number}`
      : `Issue #${task.github_issue_number}: \u201c${task.github_issue_title}\u201d`

  return (
    <Card
      className={cn(
        "flex h-full flex-col transition-shadow hover:shadow-sm",
        className
      )}
    >
      {/* Tags row */}
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <LaneIndicator task={task} />
        </div>

        {/* Repo info */}
        <div className="mt-2 space-y-0.5">
          <p className="font-mono text-sm font-medium leading-tight text-foreground">
            {task.repo_full_name}
          </p>
          {repo_profile?.description && (
            <p className="text-xs italic text-muted-foreground line-clamp-1">
              {repo_profile.description}
            </p>
          )}
        </div>
      </CardHeader>

      {/* Issue/PR + template info */}
      <CardContent className="mt-3 flex-1 space-y-1">
        <p className="text-sm font-medium leading-snug text-foreground line-clamp-2">
          {titleLine}
        </p>
        {template && (
          <p className="text-xs text-muted-foreground">
            Template:{" "}
            <span className="font-medium text-foreground/80">{template.name}</span>
          </p>
        )}
      </CardContent>

      {/* Footer */}
      <div>
        <Separator />
        <CardFooter className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          {/* Left: token estimate + model */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Cpu className="size-3 shrink-0" />
              {template
                ? tokenLabel(
                    template.token_estimate_low,
                    template.token_estimate_high
                  )
                : "Est. unknown"}
              {template?.recommended_model && (
                <>
                  {" · "}
                  <span className="capitalize">
                    {template.recommended_model} recommended
                  </span>
                </>
              )}
            </span>
            {(showCompletedBy || task.status !== "completed") && (
              <StatusIndicator task={task} />
            )}
          </div>

          {/* Right: action button */}
          {(task.status === "open" || task.status === "picked") && (
            <Button
              size="sm"
              variant="default"
              className="shrink-0"
              onClick={() => onRunThis?.(task)}
            >
              <PlayCircle className="size-3.5" />
              Copy Prompt
            </Button>
          )}
        </CardFooter>
      </div>
    </Card>
  )
}
