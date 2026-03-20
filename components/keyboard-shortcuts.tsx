'use client'

import { useEffect } from 'react'
import { useRequestModal } from '@/components/use-request-modal'
import { useDonateModal } from '@/components/use-donate-modal'

export function KeyboardShortcuts() {
  const { openModal: openRequestModal } = useRequestModal()
  const { openModal: openDonateModal } = useDonateModal()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't fire when typing in inputs, textareas, or contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return

      // Don't fire with modifier keys (Cmd, Ctrl, Alt)
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case 'd':
          e.preventDefault()
          openDonateModal()
          break
        case 'r':
          e.preventDefault()
          openRequestModal()
          break
        case '?':
          e.preventDefault()
          // Could open a keyboard shortcuts help dialog
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [openDonateModal, openRequestModal])

  return null // No UI, just effects
}
