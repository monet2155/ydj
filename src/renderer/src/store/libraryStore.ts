import { create } from 'zustand'
import type { LibraryTrack } from '../../../preload/index.js'

interface LibraryStore {
  tracks: LibraryTrack[]
  fetchTracks: () => Promise<void>
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  tracks: [],
  fetchTracks: async () => {
    const tracks = await window.electronAPI.library.list()
    set({ tracks })
  }
}))
