import { create } from 'zustand'
import type { MidiDevice, PadMode } from '../midi/types'
import type { DeckId } from './deckStore'

export type MidiAccessStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'

interface MidiStore {
  status: MidiAccessStatus
  error: string | null
  devices: MidiDevice[]
  selectedDeviceId: string | null
  padMode: Record<DeckId, PadMode>

  setStatus: (status: MidiAccessStatus, error?: string | null) => void
  setDevices: (devices: MidiDevice[]) => void
  selectDevice: (id: string | null) => void
  setPadMode: (deckId: DeckId, mode: PadMode) => void
}

export const useMidiStore = create<MidiStore>((set) => ({
  status: 'idle',
  error: null,
  devices: [],
  selectedDeviceId: null,
  padMode: { A: 'cue', B: 'cue' },

  setStatus: (status, error = null) => set({ status, error }),
  setPadMode: (deckId, mode) => set((s) => ({ padMode: { ...s.padMode, [deckId]: mode } })),
  setDevices: (devices) => set((state) => {
    // 선택된 장치가 사라지면 자동 선택 해제, 첫 장치로 자동 선택
    const stillExists = state.selectedDeviceId
      && devices.some((d) => d.id === state.selectedDeviceId && d.state === 'connected')
    const nextSelected = stillExists
      ? state.selectedDeviceId
      : (devices.find((d) => d.state === 'connected')?.id ?? null)
    return { devices, selectedDeviceId: nextSelected }
  }),
  selectDevice: (id) => set({ selectedDeviceId: id })
}))
