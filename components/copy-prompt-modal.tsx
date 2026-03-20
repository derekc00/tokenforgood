'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Copy, CheckIcon, Shield, Wrench, AlertTriangle } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard'

import type { Task } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CopyPromptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
}

interface PromptResponse {
  prompt: string
  task_id: string
  lane: 'review' | 'build'
  head_sha?: string
  available_sections: string[]
  active_sections: string[]
  generated_at: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CopyPromptModal({ open, onOpenChange, task }: CopyPromptModalProps) {
  const [promptData, setPromptData] = useState<PromptResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { copy, copied } = useCopyToClipboard()

  // Progressive trust sections (build lane only)
  const [installDeps, setInstallDeps] = useState(false)
  const [build, setBuild] = useState(false)
  const [runTests, setRunTests] = useState(false)

  const isReview = task?.source_type === 'pull-request'

  // Only include section state in the query for build tasks (review tasks ignore sections)
  const sectionsQuery = (() => {
    if (isReview) return ''
    const parts: string[] = []
    if (installDeps) parts.push('install_deps')
    if (build) parts.push('build')
    if (runTests) parts.push('run_tests')
    return parts.length > 0 ? `?sections=${parts.join(',')}` : ''
  })()

  const fetchPrompt = useCallback(async () => {
    if (!task) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/tasks/${task.id}/prompt${sectionsQuery}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }))
        setError(body.error ?? `Error ${res.status}`)
        return
      }
      const data: PromptResponse = await res.json()
      setPromptData(data)
    } catch {
      setError('Failed to fetch prompt. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [task, sectionsQuery])

  // Fetch prompt when modal opens or sections change
  useEffect(() => {
    if (open && task) {
      fetchPrompt()
    }
  }, [open, task, fetchPrompt])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setPromptData(null)
      setError(null)
      setInstallDeps(false)
      setBuild(false)
      setRunTests(false)
    }
  }, [open])

  async function handleCopy() {
    if (!promptData?.prompt || !task) return
    await copy(promptData.prompt, 'Prompt copied!')

    // Increment pick_count (non-exclusive, telemetry only)
    try {
      await fetch(`/api/tasks/${task.id}/pick`, { method: 'POST' })
    } catch {
      // Non-critical — don't block the user
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-2 w-[calc(100vw-1rem)] max-w-lg gap-0 p-0 sm:mx-auto sm:w-full sm:max-w-lg">
        {/* Header */}
        <DialogHeader className="border-b px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            Copy Prompt
            {task && (
              <Badge variant="outline" className="gap-1 font-normal">
                {isReview ? (
                  <>
                    <Shield className="size-3 text-emerald-500" />
                    Review
                  </>
                ) : (
                  <>
                    <Wrench className="size-3 text-amber-500" />
                    Build
                  </>
                )}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-5" style={{ maxHeight: 'min(60vh, 480px)' }}>
          {/* Task info */}
          {task && (
            <div className="space-y-1">
              <p className="font-mono text-sm font-medium text-foreground">
                {task.repo_full_name}
              </p>
              <p className="text-sm text-muted-foreground">
                {isReview && task.github_pr_number
                  ? `PR #${task.github_pr_number}`
                  : `Issue #${task.github_issue_number}: \u201c${task.github_issue_title}\u201d`}
              </p>
            </div>
          )}

          <Separator />

          {/* Prompt display */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Generating prompt...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {promptData && !loading && (
            <>
              <div className="max-h-60 overflow-y-auto rounded-md border bg-muted/30 p-3">
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/80">
                  {promptData.prompt}
                </pre>
              </div>

              {/* Freshness note */}
              {promptData.head_sha && (
                <p className="text-xs text-muted-foreground">
                  Generated for commit{' '}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                    {promptData.head_sha.slice(0, 7)}
                  </code>
                  . Re-copy if the PR has been updated.
                </p>
              )}
            </>
          )}

          {/* Safety note */}
          {isReview ? (
            <p className="text-xs text-muted-foreground">
              Prompts instruct read-only clone. Your AI tool may still run commands depending on
              its configuration — review before executing.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Build tasks may instruct the AI to write files and run commands. Review the prompt
              before pasting into your AI tool.
            </p>
          )}

          {/* Advanced options — build lane only */}
          {!isReview && promptData && (
            <>
              <Separator />
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                  Advanced options
                </summary>
                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={installDeps}
                      onCheckedChange={(c) => setInstallDeps(c === true)}
                    />
                    Install dependencies
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={build}
                      onCheckedChange={(c) => setBuild(c === true)}
                    />
                    Run build
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={runTests}
                      onCheckedChange={(c) => setRunTests(c === true)}
                    />
                    Run tests
                  </label>
                </div>
              </details>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/50 px-5 py-4">
          <Button
            className="w-full gap-2"
            onClick={handleCopy}
            disabled={!promptData || loading}
          >
            {copied ? (
              <>
                <CheckIcon className="size-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copy Prompt
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
