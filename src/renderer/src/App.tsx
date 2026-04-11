import { useEffect, useRef } from 'react'
import DeckPanel, { type DeckPanelHandle } from './components/Deck/DeckPanel'
import VinylDisk from './components/Deck/VinylDisk'
import MixerPanel from './components/Mixer/MixerPanel'
import WaveformRow from './components/Waveform/WaveformRow'
import LibraryPanel from './components/Library/LibraryPanel'
import { useLibraryStore } from './store/libraryStore'
import { useDeckStore, type DeckId } from './store/deckStore'
import { useDeckScratch } from './hooks/useDeckScratch'
import { useQueueStore } from './store/queueStore'
import { getDeckEngine } from './hooks/useAudio'

function DeckDisk({ deckId }: { deckId: DeckId }): JSX.Element {
  const isPlaying = useDeckStore((s) => s.decks[deckId].isPlaying)
  const color = deckId === 'A' ? '#3b82f6' : '#f97316'
  const scratch = useDeckScratch(deckId)
  return (
    <div className="flex items-center justify-center w-44 shrink-0 bg-[#0a0d14] border-x border-slate-800 py-3">
      <VinylDisk isPlaying={isPlaying} color={color} label={deckId} {...scratch} />
    </div>
  )
}

export default function App(): JSX.Element {
  const fetchTracks = useLibraryStore((s) => s.fetchTracks)
  const deckARef = useRef<DeckPanelHandle>(null)
  const deckBRef = useRef<DeckPanelHandle>(null)
  const dequeueRef = useRef(useQueueStore.getState().dequeue)
  dequeueRef.current = useQueueStore.getState().dequeue

  useEffect(() => { fetchTracks() }, [fetchTracks])

  const handleLibraryLoad = (
    filePath: string,
    meta: { title: string; duration: number; videoId: string },
    deckId: DeckId
  ): void => {
    const ref = deckId === 'A' ? deckARef : deckBRef
    ref.current?.loadFromPath(filePath, meta)
  }

  // Wire queue auto-load: when a deck finishes naturally, load next from queue
  useEffect(() => {
    const decks: DeckId[] = ['A', 'B']
    decks.forEach((deckId) => {
      const engine = getDeckEngine(deckId)
      engine.onEnded = () => {
        const next = dequeueRef.current(deckId)
        if (next) {
          const ref = deckId === 'A' ? deckARef : deckBRef
          ref.current?.loadFromPath(next.filePath, next)
        }
      }
    })
    return () => {
      decks.forEach((deckId) => { getDeckEngine(deckId).onEnded = null })
    }
  }, [])

  return (
    <div className="flex flex-col h-screen bg-[#0f1117] text-slate-200 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-center h-7 bg-[#0a0d14] border-b border-slate-800 shrink-0">
        <span className="text-xs font-bold tracking-widest text-slate-500">YDJ</span>
      </header>

      {/* Waveforms — full width, side by side */}
      <WaveformRow />

      {/* Middle: Deck A | Vinyl A | Mixer | Vinyl B | Deck B */}
      <div className="flex shrink-0 border-b border-slate-800" style={{ height: 300 }}>
        <DeckPanel ref={deckARef} deckId="A" />
        <DeckDisk deckId="A" />
        <MixerPanel />
        <DeckDisk deckId="B" />
        <DeckPanel ref={deckBRef} deckId="B" />
      </div>

      {/* Library — always visible, takes remaining space */}
      <div className="flex-1 min-h-0 bg-[#0a0d14]">
        <LibraryPanel onLoad={handleLibraryLoad} />
      </div>
    </div>
  )
}
