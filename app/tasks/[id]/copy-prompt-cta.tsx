'use client'

import type { Task } from '@/lib/types'
import { CopyPromptModal } from '@/components/copy-prompt-modal'
import { useCopyPromptModal } from '@/components/use-copy-prompt-modal'
import { Button } from '@/components/ui/button'

export function CopyPromptCTA({ task }: { task: Task }) {
  const { open, openModal, closeModal } = useCopyPromptModal()

  return (
    <>
      <Button size="lg" className="w-full" onClick={() => openModal(task)}>
        Copy Prompt
      </Button>
      <CopyPromptModal
        open={open}
        onOpenChange={(o) => (o ? undefined : closeModal())}
        task={task}
      />
    </>
  )
}
