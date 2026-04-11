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
  const hasTrack = useDeckStore((s) => s.decks[deckId].track !== null)
  const color = deckId === 'A' ? '#3b82f6' : '#f97316'
  const scratch = useDeckScratch(deckId)
  return (
    <div className="flex items-center justify-center w-44 shrink-0 bg-[#0a0d14] border-x border-slate-800 py-3">
      <VinylDisk isPlaying={isPlaying} color={color} label={deckId} hasTrack={hasTrack} {...scratch} />
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
  const CLOSED_H = 28
  const SNAP_THRESHOLD = 80   // below this on release → snap closed
  const DEFAULT_OPEN_H = 220

  const [libHeight, setLibHeight] = useState(CLOSED_H)
  const [isDragging, setIsDragging] = useState(false)
  const lastOpenH = useRef(DEFAULT_OPEN_H)
  const dragState = useRef<{ startY: number; startH: number } | null>(null)

  const isLibOpen = libHeight > CLOSED_H

  const onDragMove = useCallback((e: MouseEvent) => {
    if (!dragState.current) return
    const delta = dragState.current.startY - e.clientY  // drag up → taller
    const next = Math.max(CLOSED_H, Math.min(520, dragState.current.startH + delta))
    setLibHeight(next)
  }, [])

  const onDragEnd = useCallback(() => {
    dragState.current = null
    setIsDragging(false)
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
    // Snap: below threshold → close, above → keep & remember height
    setLibHeight((h) => {
      if (h < SNAP_THRESHOLD) return CLOSED_H
      lastOpenH.current = h
      return h
    })
  }, [onDragMove])

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragState.current = { startY: e.clientY, startH: libHeight }
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd)
  }, [libHeight, onDragMove, onDragEnd])

  const toggleLib = (): void => {
    setLibHeight((h) => {
      if (h > CLOSED_H) { lastOpenH.current = h; return CLOSED_H }
      return lastOpenH.current
    })
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
    <div
      className="flex flex-col h-screen bg-[#0f1117] text-slate-200 overflow-hidden relative"
      style={{ '--lib-height': `${libHeight}px` } as React.CSSProperties}
    >
      {/* Header */}
      <header className="flex items-center justify-center h-8 shrink-0 relative border-b border-white/5"
        style={{ background: 'linear-gradient(180deg, #0d1018 0%, #0a0c12 100%)' }}>
        <span
          className="text-xs font-black tracking-[0.3em]"
          style={{
            background: 'linear-gradient(90deg, #3b82f6, #a78bfa, #f97316)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          YDJ
        </span>
      </header>

      {/* Waveforms — full width, side by side */}
      <WaveformRow />

      {/* Middle: flex-1 so it fills whatever space the library doesn't take */}
      <div className="flex flex-1 min-h-0 border-b border-white/5">
        <DeckPanel ref={deckARef} deckId="A" />
        <DeckDisk deckId="A" />
        <MixerPanel />
        <DeckDisk deckId="B" />
        <DeckPanel ref={deckBRef} deckId="B" />
      </div>

      {/* Library — absolute overlay anchored to bottom, drag to open/close/resize */}
      <div
        className="absolute left-0 right-0 bottom-0 flex flex-col overflow-hidden"
        style={{
          height: libHeight,
          zIndex: 10,
          transition: isDragging ? 'none' : 'height 0.18s ease-out',
          background: 'linear-gradient(180deg, #0b0d15 0%, #080a10 100%)',
        }}
      >
        {/* Drag handle */}
        <div
          className="h-7 shrink-0 flex items-center px-3 gap-2 select-none cursor-ns-resize group"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          onMouseDown={onDragStart}
        >
          {/* Drag indicator */}
          <div className="w-8 flex flex-col gap-[3px] opacity-20 group-hover:opacity-50 transition-opacity">
            <div className="h-px bg-slate-400 rounded" />
            <div className="h-px bg-slate-400 rounded" />
            <div className="h-px bg-slate-400 rounded" />
          </div>
          <span className="text-[9px] font-black tracking-[0.25em] text-slate-600 flex-1 pointer-events-none">
            LIBRARY
          </span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleLib}
            className="text-[10px] text-slate-600 hover:text-slate-300 px-1 transition-colors"
          >
            {isLibOpen ? '▾' : '▴'}
          </button>
        </div>

        {/* Panel content — rendered even when animating so it doesn't flash */}
        <div className="flex-1 min-h-0" style={{ visibility: isLibOpen ? 'visible' : 'hidden' }}>
          <LibraryPanel onLoad={handleLibraryLoad} />
        </div>
      </div>
    </div>
  )
}
