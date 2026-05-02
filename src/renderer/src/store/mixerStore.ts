import { create } from 'zustand'
import type { DeckId } from './deckStore.js'

interface MixerStore {
  crossfader: number  // 0 = full A, 0.5 = center, 1 = full B
  masterVolume: number
  cueEnabled: Record<DeckId, boolean>  // PFL state per deck
  cueGain: number                       // 0..1, headphone master volume
  cueMix: number                        // 0 = cue only, 1 = master only

  setCrossfader: (value: number) => void
  setMasterVolume: (value: number) => void
  setCueEnabled: (deckId: DeckId, on: boolean) => void
  toggleCueEnabled: (deckId: DeckId) => void
  setCueGain: (value: number) => void
  setCueMix: (value: number) => void
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

export const useMixerStore = create<MixerStore>((set) => ({
  crossfader: 0.5,
  masterVolume: 1,
  cueEnabled: { A: false, B: false },
  cueGain: 1,
  cueMix: 0.5,

  setCrossfader: (value) => set({ crossfader: value }),
  setMasterVolume: (value) => set({ masterVolume: value }),
  setCueEnabled: (deckId, on) =>
    set((s) => ({ cueEnabled: { ...s.cueEnabled, [deckId]: on } })),
  toggleCueEnabled: (deckId) =>
    set((s) => ({ cueEnabled: { ...s.cueEnabled, [deckId]: !s.cueEnabled[deckId] } })),
  setCueGain: (value) => set({ cueGain: clamp01(value) }),
  setCueMix: (value) => set({ cueMix: clamp01(value) })
}))
