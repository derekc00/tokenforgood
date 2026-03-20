import { create } from 'zustand'

interface DonateModalStore {
  open: boolean
  openModal: () => void
  closeModal: () => void
  lastBudget: number
  lastProvider: string
  setLastSession: (budget: number, provider: string) => void
}

export const useDonateModal = create<DonateModalStore>((set) => ({
  open: false,
  openModal: () => set({ open: true }),
  closeModal: () => set({ open: false }),
  lastBudget: 25,
  lastProvider: 'claude-max',
  setLastSession: (budget, provider) =>
    set({ lastBudget: budget, lastProvider: provider }),
}))
