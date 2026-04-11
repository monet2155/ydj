import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import { useDeckStore, type DeckId } from '../../store/deckStore.js'
import { getAudioEngine, getDeckEngine, useDeckPosition } from '../../hooks/useAudio.js'
import { setDeckBuffer } from '../../store/audioBufferStore.js'
import PitchControl from './PitchControl.js'
import SyncButton from './SyncButton.js'
import HotCueBar from './HotCueBar.js'
import LoopControl from './LoopControl.js'
import FxPanel from '../FX/FxPanel.js'

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
  const { setLoading, setTrack, setPlaying, setPosition, setVolume, setError, setBpm, setHotCues } = useDeckStore()

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
      if (meta.videoId) {
        window.electronAPI.hotcues.load(meta.videoId)
          .then((slots) => setHotCues(deckId, slots))
          .catch(() => { /* hot cue load failed — non-critical */ })
      }
      const worker = new Worker(new URL('../../engine/BpmWorker.ts', import.meta.url), { type: 'module' })
      const samples = buffer.getChannelData(0).slice() // copy before transfer
      worker.postMessage({ samples, sampleRate: buffer.sampleRate }, [samples.buffer])
      worker.onmessage = (e: MessageEvent<{ bpm: number }>): void => {
        if (e.data.bpm > 0) setBpm(deckId, Math.round(e.data.bpm * 10) / 10)
        worker.terminate()
      }
      worker.onerror = (): void => worker.terminate()
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
      className={`flex flex-col flex-1 p-3 gap-2 overflow-y-auto ${isA ? 'deck-border-a' : 'deck-border-b'}`}
      style={{
        paddingBottom: 'var(--lib-height)',
        background: isA
          ? 'linear-gradient(160deg, #120f08 0%, #0d0c09 60%)'
          : 'linear-gradient(160deg, #110e07 0%, #0d0c09 60%)',
      }}
      data-testid={`deck-${deckId}`}
    >
      {/* Deck label */}
      <div className="flex items-center">
        <span className={`text-base font-black tracking-widest ${isA ? 'text-amber-400' : 'text-amber-600'}`}>
          DECK {deckId}
        </span>
      </div>

      {/* Track title */}
      <div className="rounded px-2 py-1 min-h-[28px] flex items-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {deck.error ? (
          <span className="text-red-400 text-xs truncate">{deck.error}</span>
        ) : deck.track ? (
          <span className="text-stone-300 text-xs truncate">{deck.track.title}</span>
        ) : (
          <span className="text-stone-600 text-xs">트랙 없음</span>
        )}
      </div>

      {/* Loading indicator */}
      {deck.isLoading && (
        <div className={`text-xs font-mono ${isA ? 'text-amber-400' : 'text-amber-600'}`}>
          로딩 중...
        </div>
      )}

      {/* Time display */}
      <div className="flex justify-between text-xs font-mono px-1">
        <div className="flex flex-col items-start">
          <span className="text-[9px] text-stone-600 leading-none mb-0.5">elapsed</span>
          <span className="text-stone-300">{formatTime(deck.position)}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-stone-600 leading-none mb-0.5">total</span>
          <span className="text-stone-600">{deck.track ? formatTime(deck.track.duration) : '0:00'}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-stone-600 leading-none mb-0.5">remain</span>
          <span className={isA ? 'text-amber-400' : 'text-amber-500'}>
            -{formatTime(Math.max(0, remaining))}
          </span>
        </div>
      </div>

      {/* Transport */}
      <div className="flex gap-2 items-stretch">
        <button
          onClick={handleCue}
          title="재생 위치를 처음으로 되돌림 (CUE)"
          className="px-3 py-2 rounded text-stone-300 text-xs font-mono font-bold transition-colors shrink-0"
          style={{ background: 'rgba(255,248,230,0.06)', border: '1px solid rgba(255,248,230,0.08)' }}
        >
          CUE
        </button>
        <button
          onClick={handlePlayPause}
          disabled={!deck.track}
          className={[
            'flex-1 py-2.5 rounded text-base font-mono font-bold disabled:opacity-40 transition-all duration-150',
            deck.isPlaying
              ? isA ? 'bg-amber-500 hover:bg-amber-400' : 'bg-amber-700 hover:bg-amber-600'
              : ''
          ].join(' ')}
          style={deck.isPlaying ? {
            boxShadow: isA ? '0 0 16px #fbbf2460, 0 0 32px #fbbf2425' : '0 0 16px #d9770660, 0 0 32px #d9770625',
          } : {
            background: 'rgba(255,248,230,0.07)',
            border: '1px solid rgba(255,248,230,0.1)',
          }}
        >
          {deck.isPlaying ? '⏸' : '▶'}
        </button>
      </div>

      {/* Hot Cues */}
      <HotCueBar deckId={deckId} />

      {/* Loop */}
      <LoopControl deckId={deckId} />

      {/* SYNC + Pitch */}
      <div className="pt-2 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(255,248,230,0.06)' }}>
        <div className="flex justify-end">
          <SyncButton deckId={deckId} />
        </div>
        <PitchControl deckId={deckId} />
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-600 w-6">VOL</span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={deck.volume}
          onChange={(e) => { const v = parseFloat(e.target.value); getDeckEngine(deckId).volume = v; setVolume(deckId, v) }}
          className="flex-1 accent-slate-400"
        />
        <span className="text-xs font-mono text-slate-500 w-8">{Math.round(deck.volume * 100)}%</span>
      </div>

      {/* FX */}
      <FxPanel deckId={deckId} />
    </div>
  )
})

export default DeckPanel
