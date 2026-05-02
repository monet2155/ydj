import { create } from 'zustand'

export const STORAGE_KEY = 'ydj.audioOutputs.v1'

export type DeviceRole = 'master' | 'headphone'

interface PersistedIds {
  masterDeviceId: string
  headphoneDeviceId: string
}

interface OutputDeviceStore {
  availableDevices: MediaDeviceInfo[]
  masterDeviceId: string
  headphoneDeviceId: string
  refreshDevices: () => Promise<void>
  setDeviceId: (role: DeviceRole, id: string) => void
}

function loadPersisted(): PersistedIds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { masterDeviceId: 'default', headphoneDeviceId: 'default' }
    const parsed = JSON.parse(raw) as Partial<PersistedIds>
    return {
      masterDeviceId: parsed.masterDeviceId ?? 'default',
      headphoneDeviceId: parsed.headphoneDeviceId ?? 'default'
    }
  } catch {
    return { masterDeviceId: 'default', headphoneDeviceId: 'default' }
  }
}

function persist(ids: PersistedIds): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch { /* localStorage full or unavailable — ignore */ }
}

/** Returns currentId if it's still present in devices (or 'default' is always present),
 *  otherwise 'default'. Pure helper for fallback logic. */
export function pickFallbackDeviceId(currentId: string, devices: MediaDeviceInfo[]): string {
  if (currentId === 'default') return 'default'
  return devices.some((d) => d.deviceId === currentId) ? currentId : 'default'
}

/** Find an audiooutput device whose label contains the given substring (case-insensitive).
 *  Returns deviceId or null. */
export function findDeviceIdByLabel(devices: MediaDeviceInfo[], substring: string): string | null {
  const needle = substring.toLowerCase()
  const match = devices.find((d) => d.label.toLowerCase().includes(needle))
  return match?.deviceId ?? null
}

const persisted = loadPersisted()

export const useOutputDeviceStore = create<OutputDeviceStore>((set, get) => ({
  availableDevices: [],
  masterDeviceId: persisted.masterDeviceId,
  headphoneDeviceId: persisted.headphoneDeviceId,

  refreshDevices: async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return
    const all = await navigator.mediaDevices.enumerateDevices()
    const audioOuts = all.filter((d) => d.kind === 'audiooutput')
    const { masterDeviceId, headphoneDeviceId } = get()
    const nextMaster = pickFallbackDeviceId(masterDeviceId, audioOuts)
    const nextHp = pickFallbackDeviceId(headphoneDeviceId, audioOuts)
    set({
      availableDevices: audioOuts,
      masterDeviceId: nextMaster,
      headphoneDeviceId: nextHp
    })
    if (nextMaster !== masterDeviceId || nextHp !== headphoneDeviceId) {
      persist({ masterDeviceId: nextMaster, headphoneDeviceId: nextHp })
    }
  },

  setDeviceId: (role, id) => {
    const next = role === 'master'
      ? { masterDeviceId: id, headphoneDeviceId: get().headphoneDeviceId }
      : { masterDeviceId: get().masterDeviceId, headphoneDeviceId: id }
    set(next)
    persist(next)
  }
}))
