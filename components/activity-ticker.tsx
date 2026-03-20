"use client"

import * as React from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { ActivityFeedItem } from "@/lib/types"

export interface ActivityTickerProps {
  activities: ActivityFeedItem[]
  isLoading?: boolean
  maxItems?: number
  className?: string
}

const MAX_TITLE_CHARS = 40

function truncate(str: string, max: number): string {
  return str.length <= max ? str : `${str.slice(0, max).trimEnd()}…`
}

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase()
}

function ActivityItem({ item }: { item: ActivityFeedItem }) {
  const { donor, task, action, created_at } = item

  const truncatedTitle = truncate(task.github_issue_title, MAX_TITLE_CHARS)
  const timeAgo = formatDistanceToNow(new Date(created_at), { addSuffix: true })
  const repoUrl = `https://github.com/${task.repo_full_name}`

  return (
    <div className="flex items-center gap-2 px-1 py-2">
      {/* Avatar */}
      <Link
        href={`/profile/@${donor.github_username}`}
        className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-full"
        tabIndex={0}
      >
        <Avatar size="sm" aria-label={`@${donor.github_username}`}>
          <AvatarImage
            src={donor.github_avatar_url}
            alt={donor.display_name ?? donor.github_username}
          />
          <AvatarFallback>{getInitials(donor.github_username)}</AvatarFallback>
        </Avatar>
      </Link>

      {/* Feed text */}
      <p className="min-w-0 flex-1 text-xs leading-snug">
        <Link
          href={`/profile/@${donor.github_username}`}
          className="font-medium text-foreground hover:underline focus-visible:outline-none"
        >
          @{donor.github_username}
        </Link>{" "}
        <span className="text-muted-foreground">{action}</span>{" "}
        <span
          className="font-medium text-foreground"
          title={task.github_issue_title}
        >
          &ldquo;{truncatedTitle}&rdquo;
        </span>{" "}
        <span className="text-muted-foreground">for</span>{" "}
        <a
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] text-foreground hover:underline focus-visible:outline-none"
        >
          {task.repo_full_name}
        </a>
        <span className="mx-1 text-muted-foreground">·</span>
        <span className="text-muted-foreground">{timeAgo}</span>
      </p>
    </div>
  )
}

function ActivityItemSkeleton() {
  return (
    <div className="flex items-center gap-2 px-1 py-2">
      <Skeleton className="size-6 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-1">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

export function ActivityTicker({
  activities,
  isLoading = false,
  maxItems = 10,
  className,
}: ActivityTickerProps) {
  const visible = activities.slice(0, maxItems)

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading activity feed"
        className={cn("flex flex-col", className)}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <React.Fragment key={i}>
            <ActivityItemSkeleton />
            {i < 4 && <Separator />}
          </React.Fragment>
        ))}
      </div>
    )
  }

  if (visible.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center py-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        No activity yet. Be the first to complete a task!
      </div>
    )
  }

  return (
    <ScrollArea className={cn("flex flex-col", className)}>
      {visible.map((item, idx) => (
        <React.Fragment key={item.id}>
          <ActivityItem item={item} />
          {idx < visible.length - 1 && <Separator />}
        </React.Fragment>
      ))}
    </ScrollArea>
  )
}
