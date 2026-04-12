import { create } from 'zustand'
import type { LibraryTrack } from '../../../preload/index.js'

interface LibraryStore {
  tracks: LibraryTrack[]
  fetchTracks: () => Promise<void>
  updateTrackBpm: (videoId: string, bpm: number) => void
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  tracks: [],
  fetchTracks: async () => {
    const tracks = await window.electronAPI.library.list()
    set({ tracks })
  },
  updateTrackBpm: (videoId, bpm) => {
    set((state) => ({
      tracks: state.tracks.map((t) => t.videoId === videoId ? { ...t, bpm } : t)
    }))
  }
}))
