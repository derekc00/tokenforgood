import Link from 'next/link'
import { Zap } from 'lucide-react'

const FOOTER_LINKS = [
  { label: 'GitHub', href: '#' },
  { label: 'About', href: '#how-it-works' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
] as const

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          {/* Brand tagline */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-mono font-medium text-foreground">
                TokenForGood
              </span>{' '}
              &mdash; connecting spare AI capacity with open source
            </span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-4">
            {FOOTER_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom row */}
        <div className="mt-6 flex flex-col items-center gap-1 border-t border-border/40 pt-4 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Made with ❤️ by the open source community
          </p>
          <p className="text-xs text-muted-foreground">
            &copy; {currentYear} TokenForGood. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
