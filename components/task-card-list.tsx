"use client"

import * as React from "react"
import { ChevronsUpDown, CheckIcon, ListTodo } from "lucide-react"

import { type Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { TaskCard } from "@/components/task-card"
import { EmptyState } from "@/components/empty-state"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskCardListProps {
  tasks: Task[]
  onRunThis?: (task: Task) => void
  isLoading?: boolean
}

type TokenBucket = "any" | "small" | "medium" | "large"
type StatusFilter = "open" | "in_progress" | "completed"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTokenBucket(task: Task): TokenBucket {
  const template = task.template
  if (!template) return "any"
  const avg = (template.token_estimate_low + template.token_estimate_high) / 2
  if (avg < 20) return "small"
  if (avg <= 50) return "medium"
  return "large"
}

function passesStatusFilter(task: Task, filter: StatusFilter | null): boolean {
  if (!filter) return true
  if (filter === "open") return task.status === "open"
  if (filter === "in_progress")
    return task.status === "claimed" || task.status === "in_progress"
  if (filter === "completed") return task.status === "completed"
  return true
}

/**
 * Base UI ToggleGroup always uses `value: readonly string[]`.
 * These helpers make it behave as a single-select by returning an array
 * of at most one item and extracting the single selected value.
 */
function toSingleValueArray(val: string | null): readonly string[] {
  return val ? [val] : []
}

function fromSingleValueArray(
  incoming: string[],
  current: string | null
): string | null {
  // Base UI fires the new full selection array; toggle off if same item clicked
  if (incoming.length === 0) return null
  // If the incoming array contains the current value plus a new one, pick the new one
  const next = incoming.find((v) => v !== current) ?? incoming[0]
  return next ?? null
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
      {/* Tags */}
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-10 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      {/* Repo name */}
      <Skeleton className="h-4 w-40" />
      {/* Description */}
      <Skeleton className="h-3 w-56" />
      {/* Issue title */}
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      {/* Template */}
      <Skeleton className="h-3 w-32" />
      {/* Footer */}
      <div className="mt-1 flex items-center justify-between pt-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TaskCardList
// ---------------------------------------------------------------------------

export function TaskCardList({ tasks, onRunThis, isLoading }: TaskCardListProps) {
  // Derive unique template names for the type filter
  const templateOptions = React.useMemo(() => {
    const seen = new Map<string, string>()
    for (const t of tasks) {
      if (t.template && !seen.has(t.template.slug)) {
        seen.set(t.template.slug, t.template.name)
      }
    }
    return Array.from(seen.entries()).map(([slug, name]) => ({ slug, name }))
  }, [tasks])

  // Filter state — null means "no filter / show all"
  const [typeOpen, setTypeOpen] = React.useState(false)
  const [typeValue, setTypeValue] = React.useState<string | null>(null)
  const [tokenFilter, setTokenFilter] = React.useState<TokenBucket | null>("any")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter | null>(
    "open"
  )

  const selectedTypeName =
    typeValue === null
      ? "All types"
      : (templateOptions.find((o) => o.slug === typeValue)?.name ?? "All types")

  // Filtered tasks
  const filtered = React.useMemo(() => {
    return tasks.filter((task) => {
      // Type filter
      if (typeValue !== null && task.task_type !== typeValue) return false

      // Token filter — "any" or null both mean no constraint
      if (tokenFilter !== null && tokenFilter !== "any") {
        const bucket = getTokenBucket(task)
        if (bucket !== tokenFilter) return false
      }

      // Status filter
      if (!passesStatusFilter(task, statusFilter)) return false

      return true
    })
  }, [tasks, typeValue, tokenFilter, statusFilter])

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <FilterBarSkeleton />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Task type combobox */}
        <Popover open={typeOpen} onOpenChange={setTypeOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-sm"
                aria-expanded={typeOpen}
              />
            }
          >
            <span>{selectedTypeName}</span>
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search types..." />
              <CommandList>
                <CommandEmpty>No types found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      setTypeValue(null)
                      setTypeOpen(false)
                    }}
                    data-checked={typeValue === null}
                  >
                    All types
                    <CheckIcon
                      className={cn(
                        "ml-auto size-4",
                        typeValue === null ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                  {templateOptions.map((opt) => (
                    <CommandItem
                      key={opt.slug}
                      value={opt.slug}
                      onSelect={(val) => {
                        setTypeValue(val === typeValue ? null : val)
                        setTypeOpen(false)
                      }}
                      data-checked={typeValue === opt.slug}
                    >
                      {opt.name}
                      <CheckIcon
                        className={cn(
                          "ml-auto size-4",
                          typeValue === opt.slug ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Token size filter — single-select simulated on Base UI ToggleGroup */}
        <ToggleGroup
          variant="outline"
          size="sm"
          value={toSingleValueArray(tokenFilter)}
          onValueChange={(incoming) => {
            const next = fromSingleValueArray(
              incoming,
              tokenFilter
            ) as TokenBucket | null
            setTokenFilter(next ?? "any")
          }}
        >
          <ToggleGroupItem value="any">Any</ToggleGroupItem>
          <ToggleGroupItem value="small">{"Small (<20k)"}</ToggleGroupItem>
          <ToggleGroupItem value="medium">Medium (20–50k)</ToggleGroupItem>
          <ToggleGroupItem value="large">{"Large (>50k)"}</ToggleGroupItem>
        </ToggleGroup>

        {/* Status filter */}
        <ToggleGroup
          variant="outline"
          size="sm"
          value={toSingleValueArray(statusFilter)}
          onValueChange={(incoming) => {
            const next = fromSingleValueArray(
              incoming,
              statusFilter
            ) as StatusFilter | null
            setStatusFilter(next)
          }}
        >
          <ToggleGroupItem value="open">Open</ToggleGroupItem>
          <ToggleGroupItem value="in_progress">In Progress</ToggleGroupItem>
          <ToggleGroupItem value="completed">Completed</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length === tasks.length
          ? `${tasks.length} task${tasks.length === 1 ? "" : "s"}`
          : `${filtered.length} of ${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
      </p>

      {/* Grid or empty state */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="size-6 text-muted-foreground" />}
          title="No tasks found."
          description="Be the first to request one!"
          action={<Button size="sm" variant="outline">Request a Task</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((task) => (
            <TaskCard key={task.id} task={task} onRunThis={onRunThis} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterBarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2 opacity-50">
      <Skeleton className="h-8 w-28 rounded-lg" />
      <Skeleton className="h-8 w-60 rounded-lg" />
      <Skeleton className="h-8 w-52 rounded-lg" />
    </div>
  )
}

