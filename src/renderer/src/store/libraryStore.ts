import { create } from 'zustand'
import type { LibraryTrack } from '../../../preload/index.js'

interface LibraryStore {
  tracks: LibraryTrack[]
  selectedId: string | null
  fetchTracks: () => Promise<void>
  updateTrackBpm: (videoId: string, bpm: number) => void
  setSelectedId: (id: string | null) => void
  moveSelection: (direction: 1 | -1) => void
}

/** Pure: 현재 선택 위치에서 dir만큼 이동한 새 selectedId. 트랙 없으면 null. */
export function nextSelectedId(
  tracks: LibraryTrack[],
  current: string | null,
  direction: 1 | -1
): string | null {
  if (tracks.length === 0) return null
  const idx = current ? tracks.findIndex((t) => t.videoId === current) : -1
  const nextIdx = Math.max(0, Math.min(tracks.length - 1, idx + direction))
  return tracks[nextIdx].videoId
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  tracks: [],
  selectedId: null,
  fetchTracks: async () => {
    const tracks = await window.electronAPI.library.list()
    set((s) => ({
      tracks,
      // 첫 fetch 또는 선택했던 트랙이 사라졌을 때 첫 항목으로 자동 선택
      selectedId: s.selectedId && tracks.some((t) => t.videoId === s.selectedId)
        ? s.selectedId
        : (tracks[0]?.videoId ?? null)
    }))
  },
  updateTrackBpm: (videoId, bpm) => {
    set((state) => ({
      tracks: state.tracks.map((t) => t.videoId === videoId ? { ...t, bpm } : t)
    }))
  },
  setSelectedId: (id) => set({ selectedId: id }),
  moveSelection: (direction) => {
    const { tracks, selectedId } = get()
    set({ selectedId: nextSelectedId(tracks, selectedId, direction) })
  }
}))
