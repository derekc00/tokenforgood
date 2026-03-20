import { create } from 'zustand'

interface RequestModalStore {
  open: boolean
  openModal: () => void
  closeModal: () => void
}

export const useRequestModal = create<RequestModalStore>((set) => ({
  open: false,
  openModal: () => set({ open: true }),
  closeModal: () => set({ open: false }),
}))
