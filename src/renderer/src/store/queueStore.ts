import { create } from 'zustand'
import type { DeckId } from './deckStore.js'
import type { LibraryTrack } from '../../../preload/index.js'

interface QueueStore {
  queues: Record<DeckId, LibraryTrack[]>
  enqueue: (deckId: DeckId, track: LibraryTrack) => void
  dequeue: (deckId: DeckId) => LibraryTrack | null
  remove: (deckId: DeckId, index: number) => void
  clear: (deckId: DeckId) => void
}

export const useQueueStore = create<QueueStore>((set, get) => ({
  queues: { A: [], B: [] },

  enqueue: (deckId, track) =>
    set((s) => ({ queues: { ...s.queues, [deckId]: [...s.queues[deckId], track] } })),

  dequeue: (deckId) => {
    const queue = get().queues[deckId]
    if (queue.length === 0) return null
    const [next, ...rest] = queue
    set((s) => ({ queues: { ...s.queues, [deckId]: rest } }))
    return next
  },

  remove: (deckId, index) =>
    set((s) => ({
      queues: { ...s.queues, [deckId]: s.queues[deckId].filter((_, i) => i !== index) }
    })),

  clear: (deckId) =>
    set((s) => ({ queues: { ...s.queues, [deckId]: [] } })),
}))
