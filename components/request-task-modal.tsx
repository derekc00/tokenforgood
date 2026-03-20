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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { GitHubIssueUrlSchema, GitHubPRUrlSchema } from "@/lib/schemas"
import type { Template, TemplateCategory, SourceType } from "@/lib/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: Template[]
  onSubmit: (data: {
    github_issue_url?: string
    github_pr_url?: string
    template_id: string
  }) => Promise<void>
}

interface ParsedSource {
  owner: string
  repo: string
  number: number
}

// ---------------------------------------------------------------------------
// Form schema — unified with optional URL fields
// ---------------------------------------------------------------------------

const FormSchema = z.object({
  source_url: z.string().min(1, "URL is required"),
  template_id: z.string().min(1, "Please select a template"),
})

type FormValues = z.infer<typeof FormSchema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseIssueUrl(url: string): ParsedSource | null {
  const match = url.match(
    /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)$/,
  )
  if (!match) return null
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) }
}

function parsePRUrl(url: string): ParsedSource | null {
  const match = url.match(
    /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)$/,
  )
  if (!match) return null
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) }
}

function suggestTemplateId(
  url: string,
  templates: Template[],
  sourceType: SourceType,
): string | null {
  if (sourceType === "pull-request") {
    const fallback = templates.find(
      (t) => t.source_type === "pull-request" && t.slug === "review-pr",
    )
    return fallback?.id ?? null
  }

  const lower = url.toLowerCase()
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
      const tpl = templates.find((t) => t.slug === rule.slug && t.source_type === "issue")
      if (tpl) return tpl.id
    }
  }

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RequestTaskModal({
  open,
  onOpenChange,
  templates,
  onSubmit,
}: RequestTaskModalProps) {
  const [sourceType, setSourceType] = React.useState<SourceType>("issue")
  const [fetchState, setFetchState] = React.useState<"idle" | "fetching" | "done">("idle")
  const [parsedSource, setParsedSource] = React.useState<ParsedSource | null>(null)
  const [submitState, setSubmitState] = React.useState<"idle" | "loading" | "success">("idle")
  const [urlError, setUrlError] = React.useState<string | null>(null)

  const fetchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const isIssueMode = sourceType === "issue"

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
    defaultValues: { source_url: "", template_id: "" },
  })

  const urlValue = watch("source_url")
  const templateIdValue = watch("template_id")

  // Filter templates by source_type
  const filteredTemplates = React.useMemo(
    () => templates.filter((t) => t.source_type === sourceType),
    [templates, sourceType],
  )

  // Group filtered templates by category
  const templatesByCategory = React.useMemo(() => {
    const groups: Record<TemplateCategory, Template[]> = {
      "code-generation": [],
      "review-analysis": [],
    }
    for (const tpl of filteredTemplates) {
      groups[tpl.category].push(tpl)
    }
    return groups
  }, [filteredTemplates])

  // Validate URL and auto-suggest template
  React.useEffect(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)

    if (!urlValue) {
      setFetchState("idle")
      setParsedSource(null)
      setUrlError(null)
      return
    }

    const schema = isIssueMode ? GitHubIssueUrlSchema : GitHubPRUrlSchema
    const result = schema.safeParse(urlValue)
    if (!result.success) {
      setFetchState("idle")
      setParsedSource(null)
      setUrlError(
        isIssueMode
          ? "Must be a valid GitHub issue URL (e.g., https://github.com/owner/repo/issues/123)"
          : "Must be a valid GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)",
      )
      return
    }

    setUrlError(null)
    setFetchState("fetching")
    setParsedSource(null)

    fetchTimerRef.current = setTimeout(() => {
      const parsed = isIssueMode ? parseIssueUrl(urlValue) : parsePRUrl(urlValue)
      setParsedSource(parsed)
      setFetchState("done")

      if (!templateIdValue) {
        const suggested = suggestTemplateId(urlValue, templates, sourceType)
        if (suggested) {
          setValue("template_id", suggested, { shouldValidate: true })
        }
      }
    }, 600)

    return () => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlValue, sourceType])

  // Reset template when source type changes
  React.useEffect(() => {
    setValue("template_id", "", { shouldValidate: false })
    setValue("source_url", "", { shouldValidate: false })
    setParsedSource(null)
    setFetchState("idle")
    setUrlError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType])

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        reset()
        setSourceType("issue")
        setFetchState("idle")
        setParsedSource(null)
        setSubmitState("idle")
        setUrlError(null)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, reset],
  )

  const handleFormSubmit = async (data: FormValues) => {
    // Validate URL format one more time
    const schema = isIssueMode ? GitHubIssueUrlSchema : GitHubPRUrlSchema
    const urlResult = schema.safeParse(data.source_url)
    if (!urlResult.success) {
      setUrlError(urlResult.error.issues[0]?.message ?? "Invalid URL")
      return
    }

    setSubmitState("loading")
    try {
      const payload = isIssueMode
        ? { github_issue_url: data.source_url, template_id: data.template_id }
        : { github_pr_url: data.source_url, template_id: data.template_id }
      await onSubmit(payload)
      setSubmitState("success")
    } catch {
      setSubmitState("idle")
    }
  }

  const isSubmitting = submitState === "loading"
  const isSuccess = submitState === "success"
  const canSubmit = isValid && !isSubmitting && !isSuccess && !urlError

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
                Paste a GitHub URL and choose how you want it handled.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              {/* Source type toggle */}
              <div className="flex flex-col gap-1.5">
                <Label>Source type</Label>
                <ToggleGroup
                  value={[sourceType]}
                  onValueChange={(vals) => {
                    const next = vals[0] as SourceType | undefined
                    if (next) setSourceType(next)
                  }}
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="issue">GitHub Issue</ToggleGroupItem>
                  <ToggleGroupItem value="pull-request">GitHub PR</ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* URL input */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="source_url">
                  {isIssueMode ? "GitHub issue URL" : "GitHub PR URL"}
                  <span className="ml-1 text-destructive" aria-hidden>*</span>
                </Label>
                <Input
                  id="source_url"
                  type="url"
                  placeholder={
                    isIssueMode
                      ? "https://github.com/owner/repo/issues/123"
                      : "https://github.com/owner/repo/pull/123"
                  }
                  disabled={isSubmitting}
                  aria-invalid={!!urlError || !!errors.source_url}
                  {...register("source_url")}
                />
                {(urlError || errors.source_url) && (
                  <p className="text-xs text-destructive" role="alert">
                    {urlError ?? errors.source_url?.message}
                  </p>
                )}

                {/* Source preview */}
                {fetchState === "fetching" && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2Icon className="size-3 animate-spin" aria-hidden />
                    {isIssueMode ? "Fetching issue\u2026" : "Fetching PR\u2026"}
                  </p>
                )}
                {fetchState === "done" && parsedSource && (
                  <div className="flex items-start gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs">
                    <CheckCircle2Icon
                      className="mt-px size-3.5 shrink-0 text-green-500"
                      aria-hidden
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground">
                        {parsedSource.owner}/{parsedSource.repo}
                      </span>
                      <span className="text-muted-foreground">
                        {isIssueMode ? `Issue #${parsedSource.number}` : `PR #${parsedSource.number}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Template selection */}
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
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(templatesByCategory) as Array<
                      [TemplateCategory, Template[]]
                    >)
                      .filter(([, items]) => items.length > 0)
                      .map(([category, items]) => (
                        <SelectGroup key={category}>
                          <SelectLabel>
                            {CATEGORY_LABELS[category]}
                          </SelectLabel>
                          {items.map((tpl) => (
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
                    template={filteredTemplates.find((t) => t.id === templateIdValue) ?? null}
                  />
                )}
              </div>
            </div>

            <DialogFooter>
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
