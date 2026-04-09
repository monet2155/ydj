import { create } from 'zustand'

interface MixerStore {
  crossfader: number  // 0 = full A, 0.5 = center, 1 = full B
  masterVolume: number
  setCrossfader: (value: number) => void
  setMasterVolume: (value: number) => void
}

export const useMixerStore = create<MixerStore>((set) => ({
  crossfader: 0.5,
  masterVolume: 1,
  setCrossfader: (value) => set({ crossfader: value }),
  setMasterVolume: (value) => set({ masterVolume: value })
}))
