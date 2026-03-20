import { makeBadge } from 'badge-maker'
import { CopyBadgeButton } from '@/app/profile/[user]/copy-badge-button'

// ---------------------------------------------------------------------------
// BadgePreview — server component
// Renders the shields.io-style SVG inline (no network fetch to own API) and
// shows the Markdown embed snippet with a copy button.
//
// Security note: dangerouslySetInnerHTML is used here intentionally because
// the SVG markup is produced entirely by the `badge-maker` library from
// trusted, sanitised inputs (numeric task count + allowlisted username
// stripped of any HTML-special characters). No user-controlled HTML reaches
// the DOM renderer.
// ---------------------------------------------------------------------------

export interface BadgePreviewProps {
  username: string
  tasksCompleted: number
}

/** Strip any characters that could be injected into SVG/HTML attributes. */
function sanitizeLabel(value: string): string {
  return value.replace(/[<>"'`&]/g, '')
}

export function BadgePreview({ username, tasksCompleted }: BadgePreviewProps) {
  // Sanitise both inputs before they reach badge-maker
  const safeUsername = sanitizeLabel(username)
  const count = Math.max(0, Math.floor(tasksCompleted)) // ensure non-negative integer
  const message = `Helped ${count} project${count !== 1 ? 's' : ''}`

  // badge-maker produces a self-contained SVG string; all dynamic content has
  // already been sanitised above.
  const svg = makeBadge({
    label: 'TokenForGood',
    message,
    color: '4CAF50',
    labelColor: '555',
    style: 'flat',
  })

  const badgeMarkdown = `[![TokenForGood](https://tokenforgood.dev/api/badge/@${safeUsername})](https://tokenforgood.dev/profile/@${safeUsername})`

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-6">
      <h2 className="mb-1 text-sm font-semibold text-foreground">
        Your TokenForGood Badge
      </h2>
      <p className="mb-5 text-xs text-muted-foreground">
        Show your open-source contributions in your GitHub README.
      </p>

      {/* SVG is generated server-side from sanitised, trusted data only */}
      <div
        className="mb-5"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {/* Markdown snippet + copy button */}
      <div className="flex items-start gap-2">
        <pre className="flex-1 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs text-foreground">
          <code>{badgeMarkdown}</code>
        </pre>
        <CopyBadgeButton text={badgeMarkdown} />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Badge image also available at{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          /api/badge/@{safeUsername}
        </code>
        {' '}for use in any Markdown file.
      </p>
    </div>
  )
}
