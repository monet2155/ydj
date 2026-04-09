import { create } from 'zustand'

export type DeckId = 'A' | 'B'

export interface TrackInfo {
  title: string
  duration: number
  videoId: string
  thumbnailUrl?: string
  filePath: string
}

export interface DeckState {
  track: TrackInfo | null
  isLoading: boolean
  loadProgress: number
  isPlaying: boolean
  position: number
  volume: number
  playbackRate: number
  bpm: number | null
  error: string | null
}

interface DeckStore {
  decks: Record<DeckId, DeckState>
  setLoading: (deckId: DeckId, loading: boolean, progress?: number) => void
  setTrack: (deckId: DeckId, track: TrackInfo) => void
  setPlaying: (deckId: DeckId, playing: boolean) => void
  setPosition: (deckId: DeckId, position: number) => void
  setVolume: (deckId: DeckId, volume: number) => void
  setPlaybackRate: (deckId: DeckId, rate: number) => void
  setBpm: (deckId: DeckId, bpm: number) => void
  setError: (deckId: DeckId, error: string | null) => void
}

const defaultDeck: DeckState = {
  track: null,
  isLoading: false,
  loadProgress: 0,
  isPlaying: false,
  position: 0,
  volume: 1,
  playbackRate: 1,
  bpm: null,
  error: null
}

export const useDeckStore = create<DeckStore>((set) => ({
  decks: { A: { ...defaultDeck }, B: { ...defaultDeck } },

  setLoading: (deckId, loading, progress = 0) =>
    set((s) => ({
      decks: { ...s.decks, [deckId]: { ...s.decks[deckId], isLoading: loading, loadProgress: progress, error: null } }
    })),

  setTrack: (deckId, track) =>
    set((s) => ({
      decks: { ...s.decks, [deckId]: { ...s.decks[deckId], track, isLoading: false, loadProgress: 100 } }
    })),

  setPlaying: (deckId, playing) =>
    set((s) => ({
      decks: { ...s.decks, [deckId]: { ...s.decks[deckId], isPlaying: playing } }
    })),

  setPosition: (deckId, position) =>
    set((s) => ({
      decks: { ...s.decks, [deckId]: { ...s.decks[deckId], position } }
    })),

  setVolume: (deckId, volume) =>
    set((s) => ({
      decks: { ...s.decks, [deckId]: { ...s.decks[deckId], volume } }
    })),

  setPlaybackRate: (deckId, rate) =>
    set((s) => ({
      decks: { ...s.decks, [deckId]: { ...s.decks[deckId], playbackRate: rate } }
    })),

  setBpm: (deckId, bpm) =>
    set((s) => ({
      decks: { ...s.decks, [deckId]: { ...s.decks[deckId], bpm } }
    })),

  setError: (deckId, error) =>
    set((s) => ({
      decks: { ...s.decks, [deckId]: { ...s.decks[deckId], error, isLoading: false } }
    }))
}))
