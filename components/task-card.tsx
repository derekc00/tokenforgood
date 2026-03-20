"use client"

import {
  PlayCircle,
  Cpu,
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
import { StatusIndicator } from "@/components/status-indicator"

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
  onClaim?: (task: Task) => void
  showCompletedBy?: boolean
  className?: string
}

export function TaskCard({
  task,
  onRunThis,
  onClaim,
  showCompletedBy = true,
  className,
}: TaskCardProps) {
  const { template, repo_profile } = task

  const tags = task.tags.slice(0, 5)

  return (
    <Card
      className={cn(
        "flex h-full flex-col transition-shadow hover:shadow-sm",
        className
      )}
    >
      {/* Tags row */}
      <CardHeader className="pb-0">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

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

      {/* Issue + template info */}
      <CardContent className="mt-3 flex-1 space-y-1">
        <p className="text-sm font-medium leading-snug text-foreground line-clamp-2">
          Issue #{task.github_issue_number}: &ldquo;{task.github_issue_title}&rdquo;
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
              <StatusIndicator
                status={task.status}
                size="sm"
                claimedBy={task.claimed_by}
                lastHeartbeatAt={task.last_heartbeat_at}
                claimedAt={task.claimed_at}
                prUrl={task.pr_url}
              />
            )}
          </div>

          {/* Right: action button */}
          {task.status === "open" && (
            <Button
              size="sm"
              variant="default"
              className="shrink-0"
              onClick={() => onRunThis?.(task)}
            >
              <PlayCircle className="size-3.5" />
              Run This
            </Button>
          )}

          {task.status === "claimed" && onClaim && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => onClaim(task)}
            >
              View
            </Button>
          )}
        </CardFooter>
      </div>
    </Card>
  )
}
