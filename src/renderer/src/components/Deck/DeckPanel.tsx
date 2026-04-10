import { useCallback, useEffect, useRef, useState } from 'react'
import { useDeckStore, type DeckId } from '../../store/deckStore.js'
import { getAudioEngine, getDeckEngine, useDeckPosition } from '../../hooks/useAudio.js'
import { detectBpmFromBuffer } from '../../engine/BpmDetector.js'
import PitchControl from './PitchControl.js'
import SyncButton from './SyncButton.js'
import WaveformCanvas from '../Waveform/WaveformCanvas.js'
import VinylDisk from './VinylDisk.js'

interface DeckPanelProps {
  deckId: DeckId
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function DeckPanel({ deckId }: DeckPanelProps): JSX.Element {
  const isA = deckId === 'A'
  const accent = isA ? 'blue' : 'orange'

  const deck = useDeckStore((s) => s.decks[deckId])
  const { setLoading, setTrack, setPlaying, setPosition, setVolume, setError, setBpm } = useDeckStore()

  const [urlInput, setUrlInput] = useState('')
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const urlRef = useRef(urlInput)
  urlRef.current = urlInput
  const scratchWasPlayingRef = useRef(false)
  const deckRef = useRef(deck)
  deckRef.current = deck

  // Position polling
  const handlePosition = useCallback(
    (pos: number) => setPosition(deckId, pos),
    [deckId, setPosition]
  )
  useDeckPosition(deckId, handlePosition)

  // Subscribe to progress IPC events
  useEffect(() => {
    const unsub = window.electronAPI.youtube.onProgress((id, percent) => {
      if (id === deckId) setLoading(deckId, true, percent)
    })
    return unsub
  }, [deckId, setLoading])

  const handleLoad = async (): Promise<void> => {
    const url = urlRef.current.trim()
    if (!url) return

    setLoading(deckId, true, 0)

    try {
      await getAudioEngine().resume()
      const result = await window.electronAPI.youtube.download(url, deckId)

      if (!result.success) {
        setError(deckId, result.error)
        return
      }

      const buffer = await getAudioEngine().loadBuffer(result.track.filePath)
      getDeckEngine(deckId).load(buffer)
      setAudioBuffer(buffer)
      setTrack(deckId, { ...result.track, duration: buffer.duration })

      // T8: BPM detection (async, non-blocking)
      Promise.resolve().then(() => {
        const bpm = detectBpmFromBuffer(buffer)
        if (bpm > 0) setBpm(deckId, Math.round(bpm * 10) / 10)
      })
    } catch (e) {
      setError(deckId, String(e))
    }
  }

  const handlePlayPause = async (): Promise<void> => {
    await getAudioEngine().resume()
    const engine = getDeckEngine(deckId)
    if (deck.isPlaying) {
      engine.pause()
      setPlaying(deckId, false)
    } else {
      engine.play()
      setPlaying(deckId, true)
    }
  }

  const handleScratchStart = useCallback((): void => {
    scratchWasPlayingRef.current = deckRef.current.isPlaying
    if (deckRef.current.isPlaying) {
      getDeckEngine(deckId).pause()
      setPlaying(deckId, false)
    }
  }, [deckId, setPlaying])

  const handleScratch = useCallback((deltaSeconds: number): void => {
    const current = deckRef.current
    if (!current.track) return
    const newPos = Math.max(0, Math.min(current.track.duration, current.position + deltaSeconds))
    getDeckEngine(deckId).seek(newPos)
    setPosition(deckId, newPos)
  }, [deckId, setPosition])

  const handleScratchEnd = useCallback((): void => {
    if (scratchWasPlayingRef.current) {
      getDeckEngine(deckId).play()
      setPlaying(deckId, true)
    }
  }, [deckId, setPlaying])

  const handleCue = (): void => {
    const engine = getDeckEngine(deckId)
    engine.seek(0)
    setPosition(deckId, 0)
    setPlaying(deckId, false)
  }

  const handleVolumeChange = (v: number): void => {
    getDeckEngine(deckId).volume = v
    setVolume(deckId, v)
  }

  const remaining = deck.track ? deck.track.duration - deck.position : 0

  return (
    <div
      className={`flex flex-col flex-1 p-3 gap-3 ${isA ? 'bg-[#0f1520]' : 'bg-[#15100f]'}`}
      data-testid={`deck-${deckId}`}
    >
      {/* Deck label */}
      <div className={`text-xl font-black tracking-widest ${isA ? 'text-blue-400' : 'text-orange-400'}`}>
        DECK {deckId}
      </div>

      {/* URL input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
          placeholder="YouTube URL 붙여넣기"
          className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500"
        />
        <button
          onClick={handleLoad}
          disabled={deck.isLoading}
          className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs font-mono disabled:opacity-50"
        >
          {deck.isLoading ? `${Math.round(deck.loadProgress)}%` : 'LOAD'}
        </button>
      </div>

      {/* Track info */}
      <div className="h-10 rounded bg-slate-900 border border-slate-800 flex items-center px-2">
        {deck.error ? (
          <span className="text-red-400 text-xs truncate">{deck.error}</span>
        ) : deck.track ? (
          <span className="text-slate-300 text-xs truncate">{deck.track.title}</span>
        ) : (
          <span className="text-slate-600 text-xs">트랙 없음</span>
        )}
      </div>

      {/* Loading bar */}
      {deck.isLoading && (
        <div className="h-1 bg-slate-800 rounded overflow-hidden">
          <div
            className={`h-full transition-all ${isA ? 'bg-blue-500' : 'bg-orange-500'}`}
            style={{ width: `${deck.loadProgress}%` }}
          />
        </div>
      )}

      {/* Vinyl disk */}
      <VinylDisk
        isPlaying={deck.isPlaying}
        color={isA ? '#3b82f6' : '#f97316'}
        label={deckId}
        onScratchStart={handleScratchStart}
        onScratch={handleScratch}
        onScratchEnd={handleScratchEnd}
      />

      {/* Waveform strip */}
      <div className="h-10 shrink-0 rounded bg-slate-900 border border-slate-800 overflow-hidden">
        <WaveformCanvas
          audioBuffer={audioBuffer}
          position={deck.position}
          duration={deck.track?.duration ?? 0}
          color={isA ? '#3b82f6' : '#f97316'}
          onSeek={(sec) => {
            getDeckEngine(deckId).seek(sec)
            setPosition(deckId, sec)
          }}
        />
      </div>

      {/* Time display */}
      <div className="flex justify-between text-xs font-mono px-1">
        <span className="text-slate-400">{formatTime(deck.position)}</span>
        <span className="text-slate-600">
          {deck.track ? formatTime(deck.track.duration) : '0:00'}
        </span>
        <span className={`${isA ? 'text-blue-400' : 'text-orange-400'}`}>
          -{formatTime(Math.max(0, remaining))}
        </span>
      </div>

      {/* Transport */}
      <div className="flex gap-2 items-center justify-center">
        <button
          onClick={handleCue}
          className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold"
        >
          CUE
        </button>
        <button
          onClick={handlePlayPause}
          disabled={!deck.track}
          className={[
            'px-6 py-2 rounded text-sm font-mono font-bold disabled:opacity-40',
            deck.isPlaying
              ? isA ? 'bg-blue-600 hover:bg-blue-500' : 'bg-orange-600 hover:bg-orange-500'
              : 'bg-slate-700 hover:bg-slate-600'
          ].join(' ')}
        >
          {deck.isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
        </button>
      </div>

      {/* T8/T9/T10: BPM + Pitch + Sync */}
      <div className="border-t border-slate-800 pt-2 flex flex-col gap-2">
        <div className="flex justify-end">
          <SyncButton deckId={deckId} />
        </div>
        <PitchControl deckId={deckId} />
      </div>

      {/* Volume fader */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-600 w-6">VOL</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={deck.volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          className="flex-1 accent-slate-400"
        />
        <span className="text-xs font-mono text-slate-500 w-8">
          {Math.round(deck.volume * 100)}%
        </span>
      </div>
    </div>
  )
}
