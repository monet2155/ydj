import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import { useDeckStore, type DeckId } from '../../store/deckStore.js'
import { getAudioEngine, getDeckEngine, useDeckPosition } from '../../hooks/useAudio.js'
import { setDeckBuffer } from '../../store/audioBufferStore.js'
import { detectBpmFromBuffer } from '../../engine/BpmDetector.js'
import PitchControl from './PitchControl.js'
import SyncButton from './SyncButton.js'

interface DeckPanelProps {
  deckId: DeckId
}

export interface DeckPanelHandle {
  loadFromPath: (filePath: string, meta: { title: string; duration: number; videoId: string }) => Promise<void>
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const DeckPanel = forwardRef<DeckPanelHandle, DeckPanelProps>(function DeckPanel({ deckId }, ref) {
  const isA = deckId === 'A'

  const deck = useDeckStore((s) => s.decks[deckId])
  const { setLoading, setTrack, setPlaying, setPosition, setVolume, setError, setBpm } = useDeckStore()

  const handlePosition = useCallback(
    (pos: number) => setPosition(deckId, pos),
    [deckId, setPosition]
  )
  useDeckPosition(deckId, handlePosition)

  const loadFromPath = useCallback(async (
    filePath: string,
    meta: { title: string; duration: number; videoId: string }
  ): Promise<void> => {
    setLoading(deckId, true, 0)
    try {
      await getAudioEngine().resume()
      const buffer = await getAudioEngine().loadBuffer(filePath)
      getDeckEngine(deckId).load(buffer)
      setDeckBuffer(deckId, buffer)
      setTrack(deckId, { filePath, ...meta, duration: buffer.duration })
      Promise.resolve().then(() => {
        const bpm = detectBpmFromBuffer(buffer)
        if (bpm > 0) setBpm(deckId, Math.round(bpm * 10) / 10)
      })
    } catch (e) {
      setError(deckId, String(e))
    }
  }, [deckId, setLoading, setTrack, setBpm, setError])

  useImperativeHandle(ref, () => ({ loadFromPath }), [loadFromPath])

  const handlePlayPause = async (): Promise<void> => {
    await getAudioEngine().resume()
    const engine = getDeckEngine(deckId)
    if (deck.isPlaying) {
      engine.pause(); setPlaying(deckId, false)
    } else {
      engine.play(); setPlaying(deckId, true)
    }
  }

  const handleCue = (): void => {
    getDeckEngine(deckId).seek(0)
    setPosition(deckId, 0)
    setPlaying(deckId, false)
  }

  const remaining = deck.track ? deck.track.duration - deck.position : 0

  return (
    <div
      className={`flex flex-col flex-1 p-3 gap-2 overflow-y-auto ${isA ? 'bg-[#0f1520]' : 'bg-[#15100f]'}`}
      data-testid={`deck-${deckId}`}
    >
      {/* Deck label + BPM */}
      <div className="flex items-center justify-between">
        <span className={`text-base font-black tracking-widest ${isA ? 'text-blue-400' : 'text-orange-400'}`}>
          DECK {deckId}
        </span>
        {deck.bpm && (
          <span className={`text-xl font-black font-mono ${isA ? 'text-blue-300' : 'text-orange-300'}`}>
            {deck.bpm.toFixed(1)}
          </span>
        )}
      </div>

      {/* Track title */}
      <div className="rounded bg-slate-900 border border-slate-800 px-2 py-1 min-h-[28px] flex items-center">
        {deck.error ? (
          <span className="text-red-400 text-xs truncate">{deck.error}</span>
        ) : deck.track ? (
          <span className="text-slate-300 text-xs truncate">{deck.track.title}</span>
        ) : (
          <span className="text-slate-600 text-xs">트랙 없음</span>
        )}
      </div>

      {/* Loading indicator */}
      {deck.isLoading && (
        <div className={`text-xs font-mono ${isA ? 'text-blue-400' : 'text-orange-400'}`}>
          로딩 중...
        </div>
      )}

      {/* Time display */}
      <div className="flex justify-between text-xs font-mono px-1">
        <span className="text-slate-300">{formatTime(deck.position)}</span>
        <span className="text-slate-600">{deck.track ? formatTime(deck.track.duration) : '0:00'}</span>
        <span className={isA ? 'text-blue-400' : 'text-orange-400'}>
          -{formatTime(Math.max(0, remaining))}
        </span>
      </div>

      {/* Transport */}
      <div className="flex gap-2 items-center justify-center">
        <button
          onClick={handleCue}
          className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold"
        >
          CUE
        </button>
        <button
          onClick={handlePlayPause}
          disabled={!deck.track}
          className={[
            'px-5 py-1.5 rounded text-xs font-mono font-bold disabled:opacity-40',
            deck.isPlaying
              ? isA ? 'bg-blue-600 hover:bg-blue-500' : 'bg-orange-600 hover:bg-orange-500'
              : 'bg-slate-700 hover:bg-slate-600'
          ].join(' ')}
        >
          {deck.isPlaying ? '⏸' : '▶'}
        </button>
      </div>

      {/* SYNC + Pitch */}
      <div className="border-t border-slate-800 pt-2 flex flex-col gap-2">
        <div className="flex justify-end">
          <SyncButton deckId={deckId} />
        </div>
        <PitchControl deckId={deckId} />
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-600 w-6">VOL</span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={deck.volume}
          onChange={(e) => { const v = parseFloat(e.target.value); getDeckEngine(deckId).volume = v; setVolume(deckId, v) }}
          className="flex-1 accent-slate-400"
        />
        <span className="text-xs font-mono text-slate-500 w-8">{Math.round(deck.volume * 100)}%</span>
      </div>
    </div>
  )
})

export default DeckPanel
