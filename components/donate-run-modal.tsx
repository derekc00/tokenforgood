'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckIcon } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Separator } from '@/components/ui/separator'

import type { Task, ProviderPricing, AIProvider, AIModel } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DonateRunModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableTasks: Task[]
  providerPricing: ProviderPricing[]
  onGenerateCommand: (taskIds: string[]) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESET_AMOUNTS = [5, 10, 25, 50, 100] as const
const BUDGET_MIN = 1
const BUDGET_MAX = 200

const PROVIDER_OPTIONS: { value: AIProvider; label: string }[] = [
  { value: 'claude-max', label: 'Claude Max' },
  { value: 'claude-pro', label: 'Claude Pro' },
  { value: 'chatgpt-pro', label: 'ChatGPT Pro' },
  { value: 'github-copilot', label: 'GitHub Copilot' },
  { value: 'gemini-advanced', label: 'Gemini Advanced' },
]

const MODEL_OPTIONS: { value: AIModel | 'auto'; label: string; short: string }[] = [
  { value: 'auto', label: 'Auto — Sonnet for most tasks', short: 'Auto' },
  { value: 'haiku', label: 'Haiku (fastest, cheapest)', short: 'Hku' },
  { value: 'sonnet', label: 'Sonnet (balanced)', short: 'Son' },
  { value: 'opus', label: 'Opus (most capable)', short: 'Opus' },
  { value: 'gpt-4o', label: 'GPT-4o', short: '4o' },
  { value: 'o3', label: 'o3', short: 'o3' },
  { value: 'copilot', label: 'Copilot', short: 'Cop' },
]

// ---------------------------------------------------------------------------
// Cost estimation helpers
// ---------------------------------------------------------------------------

/**
 * Estimate the USD cost for a task given provider pricing.
 * Uses the formula: (token_high / 1000) * output_cost * 0.6 + (token_high / 1000) * input_cost * 0.4
 */
function estimateTaskCost(task: Task, pricing: ProviderPricing): number {
  // Flat-rate providers use a fixed estimate per task type when available.
  if (pricing.is_flat_rate && pricing.flat_rate_estimate_per_task) {
    const flatRate = pricing.flat_rate_estimate_per_task[task.task_type]
    if (flatRate != null) return flatRate
    // Fall back to a generic flat-rate estimate if the task type isn't keyed.
    return 5
  }

  const tokenHigh = task.template?.token_estimate_high ?? 50 // 50k default
  const tokensK = tokenHigh / 1000
  return (
    tokensK * pricing.output_cost_per_mtok * 0.6 +
    tokensK * pricing.input_cost_per_mtok * 0.4
  )
}

/**
 * Determine which model badge to display for a task, given the global model
 * selection.  When "auto" is selected we fall back to the template's
 * recommended_model.
 */
function resolveTaskModelLabel(
  task: Task,
  selectedModel: AIModel | 'auto',
): string {
  if (selectedModel !== 'auto') {
    return MODEL_OPTIONS.find((m) => m.value === selectedModel)?.short ?? selectedModel
  }
  const rec = task.template?.recommended_model
  if (!rec) return 'Son'
  return MODEL_OPTIONS.find((m) => m.value === rec)?.short ?? rec
}

/**
 * Greedy task auto-selection algorithm.
 *
 * 1. Filter to open tasks only.
 * 2. Estimate cost per task using the active pricing row.
 * 3. Sort by created_at ascending (oldest = highest priority).
 * 4. Fill up the budget greedily, allowing a 10 % overage.
 */
function autoSelectTasks(
  tasks: Task[],
  budget: number,
  pricing: ProviderPricing | undefined,
): { selected: Task[]; totalCost: number } {
  if (!pricing) return { selected: [], totalCost: 0 }

  const openTasks = tasks.filter((t) => t.status === 'open')
  const withCost = openTasks
    .map((t) => ({ task: t, cost: estimateTaskCost(t, pricing) }))
    .sort(
      (a, b) =>
        new Date(a.task.created_at).getTime() -
        new Date(b.task.created_at).getTime(),
    )

  const budgetWithBuffer = budget * 1.1
  const selected: Task[] = []
  let running = 0

  for (const { task, cost } of withCost) {
    if (running + cost <= budgetWithBuffer) {
      selected.push(task)
      running += cost
    }
  }

  return { selected, totalCost: running }
}

// ---------------------------------------------------------------------------
// Task row sub-component
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: Task
  cost: number
  modelLabel: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function TaskRow({ task, cost, modelLabel, checked, onCheckedChange }: TaskRowProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        className="mt-0.5 shrink-0"
      />
      <span className="min-w-0 flex-1 text-sm leading-snug text-foreground">
        <span className="font-medium">{task.repo_full_name}</span>
        <span className="text-muted-foreground"> #{task.github_issue_number}</span>
        {' — '}
        <span className="text-muted-foreground line-clamp-1">
          {task.github_issue_title}
        </span>
      </span>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        ~${cost < 1 ? cost.toFixed(2) : cost.toFixed(0)}
      </span>
      <span className="w-9 shrink-0 rounded bg-muted px-1 py-0.5 text-center font-mono text-[10px] text-muted-foreground">
        {modelLabel}
      </span>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Main modal component
// ---------------------------------------------------------------------------

export function DonateRunModal({
  open,
  onOpenChange,
  availableTasks,
  providerPricing,
  onGenerateCommand,
}: DonateRunModalProps) {
  const [budget, setBudget] = useState(25)
  const [provider, setProvider] = useState<AIProvider>('claude-max')
  const [model, setModel] = useState<AIModel | 'auto'>('auto')
  const [manualOverrides, setManualOverrides] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)

  // Resolve the active pricing row for the selected provider + model combo.
  const activePricing = providerPricing.find(
    (p) =>
      p.provider === provider &&
      (model === 'auto' ? p.model === 'sonnet' : p.model === model),
  ) ?? providerPricing.find((p) => p.provider === provider)

  // Derive auto-selection whenever budget or provider changes.
  const { selected: autoSelected, totalCost: autoTotal } = autoSelectTasks(
    availableTasks,
    budget,
    activePricing,
  )

  const autoSelectedIds = new Set(autoSelected.map((t) => t.id))

  // Merge auto-selection with manual overrides.
  const effectiveSelectedIds = new Set(
    availableTasks
      .filter((t) => {
        if (t.id in manualOverrides) return manualOverrides[t.id]
        return autoSelectedIds.has(t.id)
      })
      .map((t) => t.id),
  )

  // Compute display tasks and totals.
  const displayTasks = availableTasks
    .filter((t) => t.status === 'open')
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )

  const selectedTaskObjects = displayTasks.filter((t) =>
    effectiveSelectedIds.has(t.id),
  )

  const totalEstimated = activePricing
    ? selectedTaskObjects.reduce(
        (sum, t) => sum + estimateTaskCost(t, activePricing),
        0,
      )
    : 0

  // Reset manual overrides when budget or provider changes so auto-selection
  // takes full effect again.
  const resetOverrides = useCallback(() => {
    setManualOverrides({})
  }, [])

  useEffect(() => {
    resetOverrides()
  }, [budget, provider, resetOverrides])

  function handleBudgetChange(value: number | readonly number[]) {
    const next = Array.isArray(value) ? (value as readonly number[])[0] : (value as number)
    if (next != null) setBudget(next)
  }

  function handlePresetSelect(values: string[]) {
    // ToggleGroup with multiple=false; the new value is the last pressed item.
    const raw = values[0]
    if (!raw) return
    const num = parseInt(raw, 10)
    if (!isNaN(num)) setBudget(num)
  }

  function handleTaskChecked(taskId: string, checked: boolean) {
    setManualOverrides((prev) => ({ ...prev, [taskId]: checked }))
  }

  async function handleGenerateCommand() {
    const ids = Array.from(effectiveSelectedIds)
    const command = `npx tokenforgood run ${ids.join(' ')}`

    try {
      await navigator.clipboard.writeText(command)
    } catch {
      // Clipboard access may be blocked in some environments; fail gracefully.
    }

    onGenerateCommand(ids)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  // Find the preset value closest to the current budget for highlight purposes.
  const activePreset = PRESET_AMOUNTS.find((p) => p === budget)?.toString()

  const SHOW_ALL_THRESHOLD = 4
  const visibleTasks = displayTasks.slice(0, SHOW_ALL_THRESHOLD)
  const hiddenCount = Math.max(
    0,
    selectedTaskObjects.length - visibleTasks.filter((t) => effectiveSelectedIds.has(t.id)).length,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-2 w-[calc(100vw-1rem)] max-w-lg gap-0 p-0 sm:mx-auto sm:w-full sm:max-w-lg">
        {/* Header */}
        <DialogHeader className="border-b px-5 pb-4 pt-5">
          <DialogTitle className="text-base font-semibold">
            Donate &amp; Run
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-5" style={{ maxHeight: 'min(60vh, 480px)' }}>
          {/* Budget section */}
          <section className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">How much?</p>

            {/* Preset buttons */}
            <ToggleGroup
              value={activePreset ? [activePreset] : []}
              onValueChange={handlePresetSelect}
              variant="outline"
              size="sm"
              className="flex-wrap"
            >
              {PRESET_AMOUNTS.map((amount) => (
                <ToggleGroupItem
                  key={amount}
                  value={amount.toString()}
                  aria-label={`$${amount}`}
                >
                  ${amount}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            {/* Slider — full width, touch-friendly height */}
            <Slider
              value={[budget]}
              onValueChange={handleBudgetChange}
              min={BUDGET_MIN}
              max={BUDGET_MAX}
              step={1}
              className="py-2"
              aria-label="Budget"
            />

            <p className="text-right font-mono text-sm font-semibold text-foreground">
              ${budget}
            </p>
          </section>

          {/* Provider + model selects */}
          <section className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
            <span className="text-muted-foreground">Provider / Plan:</span>
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v as AIProvider)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground">Model:</span>
            <Select
              value={model}
              onValueChange={(v) => {
                setModel(v as AIModel | 'auto')
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {MODEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <Separator />

          {/* Task list */}
          <section className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">
              Auto-selected tasks{' '}
              <span className="font-normal text-muted-foreground">
                ({selectedTaskObjects.length} task
                {selectedTaskObjects.length !== 1 ? 's' : ''} · ~$
                {totalEstimated < 1
                  ? totalEstimated.toFixed(2)
                  : totalEstimated.toFixed(0)}{' '}
                estimated)
              </span>
            </p>

            {displayTasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No open tasks available.
              </p>
            ) : (
              <div className="-mx-2 flex flex-col">
                {visibleTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    cost={
                      activePricing ? estimateTaskCost(task, activePricing) : 0
                    }
                    modelLabel={resolveTaskModelLabel(task, model)}
                    checked={effectiveSelectedIds.has(task.id)}
                    onCheckedChange={(checked) =>
                      handleTaskChecked(task.id, checked)
                    }
                  />
                ))}
                {hiddenCount > 0 && (
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    +{hiddenCount} more selected (scroll to see all)
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Footer / CTA */}
        <div className="-mx-0 border-t bg-muted/50 px-5 py-4">
          <Button
            className="w-full gap-2"
            onClick={handleGenerateCommand}
            disabled={effectiveSelectedIds.size === 0}
          >
            {copied ? (
              <>
                <CheckIcon className="size-4" />
                Copied to clipboard!
              </>
            ) : (
              'Generate Command — copies to clipboard'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
