import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { PlatformStats } from "@/lib/types"

export interface StatsStripProps {
  stats: PlatformStats | null
  isLoading?: boolean
  className?: string
}

// A single stat cell: large number on top, small muted label below.
function StatCell({
  value,
  label,
  className,
}: {
  value: React.ReactNode
  label: string
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-0.5 px-4 text-center", className)}>
      <span className="text-xl font-bold leading-tight tracking-tight tabular-nums">
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

// Vertical pipe divider between stat cells.
function Pipe() {
  return (
    <span
      aria-hidden
      className="h-8 w-px shrink-0 bg-border"
    />
  )
}

// Loading skeleton for a single stat cell.
function StatCellSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1 px-4">
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

export function StatsStrip({ stats, isLoading = false, className }: StatsStripProps) {
  if (isLoading || !stats) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading platform statistics"
        className={cn(
          "flex w-full flex-wrap items-center justify-center gap-y-3 rounded-xl border border-border bg-card px-2 py-3",
          className,
        )}
      >
        <StatCellSkeleton />
        <Pipe />
        <StatCellSkeleton />
        <Pipe />
        <StatCellSkeleton />
        <Pipe />
        {/* Languages cell skeleton */}
        <div className="flex flex-col items-center gap-1 px-4">
          <div className="flex gap-1">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-10 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    )
  }

  const mergePercent = Math.round(stats.merge_rate * 100)
  const donatedFormatted = stats.total_donated_usd.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center justify-center gap-y-3 rounded-xl border border-border bg-card px-2 py-3",
        className,
      )}
    >
      {/* Tasks completed this week */}
      <StatCell
        value={stats.completed_this_week.toLocaleString()}
        label="completed this week"
      />

      <Pipe />

      {/* Total donated */}
      <StatCell
        value={<>~${donatedFormatted}</>}
        label="in AI compute"
      />

      <Pipe />

      {/* Merge rate */}
      <StatCell
        value={`${mergePercent}%`}
        label="PR acceptance"
      />

      <Pipe />

      {/* Top languages */}
      <div className="flex min-w-0 flex-col items-center gap-1 px-4">
        <div className="flex flex-wrap justify-center gap-1">
          {stats.top_languages.length > 0 ? (
            stats.top_languages.slice(0, 4).map((lang) => (
              <Badge key={lang} variant="secondary" className="text-[11px]">
                {lang}
              </Badge>
            ))
          ) : (
            <span className="text-xl font-bold leading-tight">—</span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">top languages</span>
      </div>
    </div>
  )
}
