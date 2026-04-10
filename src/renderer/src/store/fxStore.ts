import { create } from 'zustand'
import type { DeckId } from './deckStore.js'
import type { FilterMode } from '../engine/FxEngine.js'

export interface FilterSlot {
  enabled: boolean
  wet: number
  param: number
  mode: FilterMode
}
export interface FxSlot {
  enabled: boolean
  wet: number
  param: number
}
export interface DeckFxState {
  filter: FilterSlot
  delay: FxSlot
  reverb: FxSlot
  flanger: FxSlot
}

interface FxStore {
  fx: Record<DeckId, DeckFxState>
  setFilter: (deckId: DeckId, patch: Partial<FilterSlot>) => void
  setDelay: (deckId: DeckId, patch: Partial<FxSlot>) => void
  setReverb: (deckId: DeckId, patch: Partial<FxSlot>) => void
  setFlanger: (deckId: DeckId, patch: Partial<FxSlot>) => void
}

const defaultDeckFx = (): DeckFxState => ({
  filter:  { enabled: false, wet: 1, param: 1,   mode: 'lpf' },
  delay:   { enabled: false, wet: 0.35, param: 0.3 },
  reverb:  { enabled: false, wet: 0.35, param: 0.4 },
  flanger: { enabled: false, wet: 0.5, param: 0.3 },
})

export const useFxStore = create<FxStore>((set) => ({
  fx: { A: defaultDeckFx(), B: defaultDeckFx() },

  setFilter: (deckId, patch) =>
    set((s) => ({ fx: { ...s.fx, [deckId]: { ...s.fx[deckId], filter: { ...s.fx[deckId].filter, ...patch } } } })),

  setDelay: (deckId, patch) =>
    set((s) => ({ fx: { ...s.fx, [deckId]: { ...s.fx[deckId], delay: { ...s.fx[deckId].delay, ...patch } } } })),

  setReverb: (deckId, patch) =>
    set((s) => ({ fx: { ...s.fx, [deckId]: { ...s.fx[deckId], reverb: { ...s.fx[deckId].reverb, ...patch } } } })),

  setFlanger: (deckId, patch) =>
    set((s) => ({ fx: { ...s.fx, [deckId]: { ...s.fx[deckId], flanger: { ...s.fx[deckId].flanger, ...patch } } } })),
}))
