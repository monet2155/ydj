import { useEffect, useRef, useState, useCallback } from 'react'
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

  // Library open/resize state
  const [libOpen, setLibOpen] = useState(true)
  const [libHeight, setLibHeight] = useState(200)
  const dragState = useRef<{ startY: number; startH: number } | null>(null)

  const onDragMove = useCallback((e: MouseEvent) => {
    if (!dragState.current) return
    const delta = dragState.current.startY - e.clientY  // drag up → taller
    setLibHeight(Math.max(80, Math.min(520, dragState.current.startH + delta)))
  }, [])

  const onDragEnd = useCallback(() => {
    dragState.current = null
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
  }, [onDragMove])

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragState.current = { startY: e.clientY, startH: libHeight }
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd)
  }, [libHeight, onDragMove, onDragEnd])

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

      {/* Spacer — pushes library to bottom */}
      <div className="flex-1" />

      {/* Library — collapsible + resizable */}
      <div
        className="shrink-0 bg-[#0a0d14] flex flex-col overflow-hidden"
        style={{ height: libOpen ? libHeight : 28 }}
      >
        {/* Drag handle + header bar */}
        <div
          className="h-7 shrink-0 flex items-center px-3 gap-2 border-t border-slate-800 select-none cursor-ns-resize group"
          onMouseDown={onDragStart}
        >
          {/* Grip dots */}
          <div className="flex flex-col gap-0.5 opacity-30 group-hover:opacity-60">
            {[0, 1].map((r) => (
              <div key={r} className="flex gap-0.5">
                {[0, 1, 2].map((c) => <div key={c} className="w-0.5 h-0.5 rounded-full bg-slate-400" />)}
              </div>
            ))}
          </div>
          <span className="text-[10px] font-bold tracking-widest text-slate-600 flex-1 pointer-events-none">
            LIBRARY
          </span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setLibOpen((v) => !v)}
            className="text-slate-600 hover:text-slate-300 text-xs px-1"
          >
            {libOpen ? '▼' : '▲'}
          </button>
        </div>

        {/* Panel content */}
        {libOpen && (
          <div className="flex-1 min-h-0">
            <LibraryPanel onLoad={handleLibraryLoad} />
          </div>
        )}
      </div>
    </div>
  )
}
