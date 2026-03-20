"use client"

import { formatDistanceToNow } from "date-fns"
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
} from "lucide-react"

import { type Task } from "@/lib/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatusIndicatorProps {
  status: Task["status"]
  /** 'sm' uses size-2 dot and text-xs (task card). 'md' uses size-2.5 dot and text-sm (detail page). */
  size?: "sm" | "md"
  /** Claimed-by GitHub username (without @). Used in claimed / in_progress / completed labels. */
  claimedBy?: string | null
  /** ISO timestamp used for the "X ago" label when in_progress. Falls back to claimedAt. */
  lastHeartbeatAt?: string | null
  /** ISO timestamp used as fallback for the "X ago" label when in_progress. */
  claimedAt?: string | null
  /** When provided and status is completed, renders a PR link instead of plain text. */
  prUrl?: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tailwind classes that vary by size. */
function sizeClasses(size: "sm" | "md") {
  return {
    text: size === "sm" ? "text-xs" : "text-sm",
    dot: size === "sm" ? "size-2" : "size-2.5",
    icon: size === "sm" ? "size-3.5" : "size-4",
  }
}

// ---------------------------------------------------------------------------
// StatusIndicator
// ---------------------------------------------------------------------------

export function StatusIndicator({
  status,
  size = "sm",
  claimedBy,
  lastHeartbeatAt,
  claimedAt,
  prUrl,
}: StatusIndicatorProps) {
  const cls = sizeClasses(size)

  if (status === "open") {
    return (
      <span className={`flex items-center gap-1.5 ${cls.text} text-emerald-500`}>
        <span className={`relative flex ${cls.dot}`}>
          <span className="absolute inline-flex size-full animate-pulse rounded-full bg-emerald-400 opacity-75" />
          <span className={`relative inline-flex ${cls.dot} rounded-full bg-emerald-500`} />
        </span>
        Open
      </span>
    )
  }

  if (status === "claimed") {
    return (
      <span className={`flex items-center gap-1.5 ${cls.text} text-amber-500`}>
        <span className={`relative inline-flex ${cls.dot} rounded-full bg-amber-400`} />
        {claimedBy ? `Claimed by @${claimedBy}` : "Claimed"}
      </span>
    )
  }

  if (status === "in_progress") {
    const since = lastHeartbeatAt ?? claimedAt
    const ago = since
      ? formatDistanceToNow(new Date(since), { addSuffix: false })
      : null

    return (
      <span className={`flex items-center gap-1.5 ${cls.text} text-blue-500`}>
        <span className={`relative flex ${cls.dot}`}>
          <span className="absolute inline-flex size-full animate-pulse rounded-full bg-blue-400 opacity-75" />
          <span className={`relative inline-flex ${cls.dot} rounded-full bg-blue-500`} />
        </span>
        {claimedBy ? `@${claimedBy}` : "In progress"}
        {ago ? ` · ${ago} ago` : ""}
      </span>
    )
  }

  if (status === "completed") {
    return (
      <span className={`flex items-center gap-1.5 ${cls.text} text-muted-foreground`}>
        <CheckCircle2 className={`${cls.icon} text-emerald-500`} />
        {prUrl ? (
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 hover:underline"
          >
            Resolved
            {claimedBy ? ` by @${claimedBy}` : ""}
            <ExternalLink className="size-2.5 opacity-60" />
          </a>
        ) : (
          <span>
            Completed{claimedBy ? ` by @${claimedBy}` : ""}
          </span>
        )}
      </span>
    )
  }

  if (status === "stalled") {
    return (
      <span className={`flex items-center gap-1.5 ${cls.text} text-orange-500`}>
        <AlertTriangle className={cls.icon} />
        Stalled
      </span>
    )
  }

  if (status === "failed") {
    return (
      <span className={`flex items-center gap-1.5 ${cls.text} text-destructive`}>
        <Circle className={cls.icon} />
        Failed
      </span>
    )
  }

  if (status === "expired" || status === "stale") {
    return (
      <span className={`flex items-center gap-1.5 ${cls.text} text-muted-foreground`}>
        <Clock className={cls.icon} />
        {status === "expired" ? "Expired" : "Stale"}
      </span>
    )
  }

  return null
}
