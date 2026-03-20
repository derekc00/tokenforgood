'use client'

import { useState } from 'react'
import { toast } from 'sonner'

export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)

  async function copy(text: string, successMessage = 'Copied to clipboard!') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(successMessage)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  return { copy, copied }
}
