import * as React from 'react'

export interface EmptyStateProps {
  /** Optional icon rendered in the circle above the text. */
  icon?: React.ReactNode
  /** Primary heading text. */
  title: string
  /** Secondary description text. */
  description?: string
  /** Optional CTA button or link rendered below the description. */
  action?: React.ReactNode
}

/**
 * Generic empty state UI — used wherever a list or section has no content to
 * show (filtered task lists, contribution history, etc.).
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
