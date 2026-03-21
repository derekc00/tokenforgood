"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CheckCircle2Icon, Loader2Icon } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GitHubIssueUrlSchema } from "@/lib/schemas"
import { parseGitHubIssueUrl } from "@/lib/github/url"
import type { Template, TemplateCategory } from "@/lib/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: Template[]
  onSubmit: (data: { github_issue_url: string; template_id: string }) => Promise<void>
}

interface ParsedIssue {
  owner: string
  repo: string
  issueNumber: number
}

// ---------------------------------------------------------------------------
// Form schema — only the two fields the modal controls
// ---------------------------------------------------------------------------

const FormSchema = z.object({
  github_issue_url: GitHubIssueUrlSchema,
  template_id: z.string().min(1, "Please select a template"),
})

type FormValues = z.infer<typeof FormSchema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Suggest the most relevant template slug based on keywords in the issue URL
 * (owner/repo) or a title string. Returns a template id when a match is found.
 */
function suggestTemplateId(
  issueUrl: string,
  templates: Template[],
): string | null {
  const lower = issueUrl.toLowerCase()

  const rules: Array<{ keywords: string[]; slug: string }> = [
    { keywords: ["test", "spec", "coverage"], slug: "write-tests" },
    { keywords: ["security", "vulnerability", "cve", "auth"], slug: "security-audit" },
    { keywords: ["doc", "readme", "changelog"], slug: "add-documentation" },
    { keywords: ["ci", "github-action", "workflow", "pipeline"], slug: "setup-cicd" },
    { keywords: ["type", "typescript", "typings"], slug: "add-types" },
    { keywords: ["implement", "feature", "add"], slug: "implement-feature" },
  ]

  for (const rule of rules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      const tpl = templates.find((t) => t.slug === rule.slug)
      if (tpl) return tpl.id
    }
  }

  // Default
  const fallback = templates.find((t) => t.slug === "implement-feature")
  return fallback?.id ?? null
}

const MODEL_LABELS: Record<string, string> = {
  haiku: "Haiku",
  sonnet: "Sonnet",
  opus: "Opus",
  "gpt-4o": "GPT-4o",
  o3: "o3",
  copilot: "Copilot",
}

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  "code-generation": "Code Generation",
  "review-analysis": "Review & Analysis",
}

const CATEGORIES: readonly TemplateCategory[] = ["code-generation", "review-analysis"]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RequestTaskModal({
  open,
  onOpenChange,
  templates,
  onSubmit,
}: RequestTaskModalProps) {
  const [fetchState, setFetchState] = React.useState<
    "idle" | "fetching" | "done"
  >("idle")
  const [parsedIssue, setParsedIssue] = React.useState<ParsedIssue | null>(null)
  const [submitState, setSubmitState] = React.useState<
    "idle" | "loading" | "success" | "error"
  >("idle")

  const fetchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onChange",
    defaultValues: {
      github_issue_url: "",
      template_id: "",
    },
  })

  const urlValue = watch("github_issue_url")
  const templateIdValue = watch("template_id")

  // When the URL changes and is valid, simulate a fetch + auto-suggest template
  React.useEffect(() => {
    if (fetchTimerRef.current) {
      clearTimeout(fetchTimerRef.current)
    }

    const result = GitHubIssueUrlSchema.safeParse(urlValue)
    if (!result.success) {
      setFetchState("idle")
      setParsedIssue(null)
      return
    }

    setFetchState("fetching")
    setParsedIssue(null)

    fetchTimerRef.current = setTimeout(() => {
      const parsed = parseGitHubIssueUrl(urlValue)
      setParsedIssue(parsed)
      setFetchState("done")

      // Auto-suggest template only when user hasn't already picked one
      if (!templateIdValue) {
        const suggested = suggestTemplateId(urlValue, templates)
        if (suggested) {
          setValue("template_id", suggested, { shouldValidate: true })
        }
      }
    }, 600)

    return () => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlValue])

  // Reset everything when the dialog closes
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        reset()
        setFetchState("idle")
        setParsedIssue(null)
        setSubmitState("idle")
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, reset],
  )

  const handleFormSubmit = async (data: FormValues) => {
    setSubmitState("loading")
    try {
      await onSubmit(data)
      setSubmitState("success")
    } catch {
      setSubmitState("error")
    }
  }

  // Clear submit error when the user makes any form change so they can retry.
  React.useEffect(() => {
    if (submitState === "error") {
      setSubmitState("idle")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlValue, templateIdValue])

  const isSubmitting = submitState === "loading"
  const isSuccess = submitState === "success"
  const canSubmit = isValid && !isSubmitting && !isSuccess

  // Group templates by category for the select
  const templatesByCategory = React.useMemo(() => {
    const groups: Record<TemplateCategory, Template[]> = {
      "code-generation": [],
      "review-analysis": [],
    }
    for (const tpl of templates) {
      groups[tpl.category].push(tpl)
    }
    return groups
  }, [templates])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isSubmitting}>
        {isSuccess ? (
          <SuccessView onClose={() => handleOpenChange(false)} />
        ) : (
          <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
            <DialogHeader>
              <DialogTitle>Request a task</DialogTitle>
              <DialogDescription>
                Paste a GitHub issue URL and choose how you want it solved.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              {/* Step 1 — GitHub issue URL */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="github_issue_url">
                  GitHub issue URL
                  <span className="ml-1 text-destructive" aria-hidden>*</span>
                </Label>
                <Input
                  id="github_issue_url"
                  type="url"
                  placeholder="https://github.com/owner/repo/issues/123"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.github_issue_url}
                  {...register("github_issue_url")}
                />
                {errors.github_issue_url && (
                  <p className="text-xs text-destructive" role="alert">
                    {errors.github_issue_url.message}
                  </p>
                )}

                {/* Issue preview */}
                {fetchState === "fetching" && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2Icon className="size-3 animate-spin" aria-hidden />
                    Fetching issue&hellip;
                  </p>
                )}
                {fetchState === "done" && parsedIssue && (
                  <div className="flex items-start gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs">
                    <CheckCircle2Icon
                      className="mt-px size-3.5 shrink-0 text-green-500"
                      aria-hidden
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground">
                        {parsedIssue.owner}/{parsedIssue.repo}
                      </span>
                      <span className="text-muted-foreground">
                        Issue #{parsedIssue.issueNumber}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2 — Template selection */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template_select">
                  Template
                  <span className="ml-1 text-destructive" aria-hidden>*</span>
                </Label>
                <Select
                  value={templateIdValue}
                  onValueChange={(value) => {
                    if (value !== null) {
                      setValue("template_id", value, { shouldValidate: true })
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id="template_select"
                    className="w-full"
                    aria-invalid={!!errors.template_id}
                  >
                    <SelectValue placeholder="Select a template">
                      {(value: string | null) => {
                        if (!value) return null
                        const tpl = templates.find((t) => t.id === value)
                        return tpl?.name ?? value
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES
                      .filter((category) => templatesByCategory[category].length > 0)
                      .map((category) => (
                        <SelectGroup key={category}>
                          <SelectLabel>
                            {CATEGORY_LABELS[category]}
                          </SelectLabel>
                          {templatesByCategory[category].map((tpl) => (
                            <SelectItem key={tpl.id} value={tpl.id}>
                              <TemplateOption template={tpl} />
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                  </SelectContent>
                </Select>
                {errors.template_id && (
                  <p className="text-xs text-destructive" role="alert">
                    {errors.template_id.message}
                  </p>
                )}

                {/* Selected template detail card */}
                {templateIdValue && (
                  <TemplateDetailCard
                    template={templates.find((t) => t.id === templateIdValue) ?? null}
                  />
                )}
              </div>
            </div>

            <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              {submitState === "error" && (
                <p className="text-xs text-destructive sm:mr-auto" role="alert">
                  Something went wrong. Please try again.
                </p>
              )}
              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2Icon className="animate-spin" aria-hidden />
                    Posting&hellip;
                  </>
                ) : (
                  "Post Task"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TemplateOption({ template }: { template: Template }) {
  return (
    <span className="flex items-center justify-between gap-3 w-full">
      <span className="truncate">{template.name}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        <Badge variant="secondary" className="text-[10px]">
          {MODEL_LABELS[template.recommended_model] ?? template.recommended_model}
        </Badge>
        <span className="text-xs text-muted-foreground tabular-nums">
          ~{template.token_estimate_low}–{template.token_estimate_high}k tokens
        </span>
      </span>
    </span>
  )
}

function TemplateDetailCard({ template }: { template: Template | null }) {
  if (!template) return null
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
      <p className="mb-1 font-medium text-foreground">{template.name}</p>
      <p className="mb-2 leading-relaxed">{template.description}</p>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">
          {MODEL_LABELS[template.recommended_model] ?? template.recommended_model}
        </Badge>
        <Badge variant="outline">
          {template.token_estimate_low}–{template.token_estimate_high}k tokens
        </Badge>
        <Badge variant="outline">
          {template.recommended_mode === "safe" ? "Safe mode" : "Full access"}
        </Badge>
      </div>
    </div>
  )
}

function SuccessView({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-green-500/10">
        <CheckCircle2Icon className="size-7 text-green-500" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium">Task posted!</p>
        <p className="text-sm text-muted-foreground">
          {"It's live on the board."}
        </p>
      </div>
      <Button onClick={onClose} className="mt-2 w-full sm:w-auto">
        Close
      </Button>
    </div>
  )
}
