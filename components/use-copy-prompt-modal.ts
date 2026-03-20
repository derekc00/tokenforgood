import { create } from 'zustand'
import type { Task } from '@/lib/types'

interface CopyPromptModalStore {
  open: boolean
  currentTask: Task | null
  openModal: (task: Task) => void
  closeModal: () => void
}

export const useCopyPromptModal = create<CopyPromptModalStore>((set) => ({
  open: false,
  currentTask: null,
  openModal: (task) => set({ open: true, currentTask: task }),
  closeModal: () => set({ open: false, currentTask: null }),
}))
