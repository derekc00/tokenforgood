"use client"

import { useState } from 'react'
import { Clipboard, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  text: string
  label?: string
  iconOnly?: boolean
  className?: string
}

export function CopyButton({ text, label, iconOnly = false, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable — silently fail
    }
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy to clipboard'}
        className={cn(
          'flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:text-foreground',
          className,
        )}
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-500" />
        ) : (
          <Clipboard className="size-3.5" />
        )}
      </button>
    )
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleCopy}
      className={cn('shrink-0 gap-1.5', className)}
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-emerald-500" />
          Copied
        </>
      ) : (
        <>
          <Clipboard className="size-3.5" />
          {label ?? 'Copy'}
        </>
      )}
    </Button>
  )
}
