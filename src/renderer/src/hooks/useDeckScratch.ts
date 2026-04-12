import { useCallback, useRef } from 'react'
import { useDeckStore, type DeckId } from '../store/deckStore.js'
import { getDeckEngine } from './useAudio.js'

export function useDeckScratch(deckId: DeckId) {
  const deck = useDeckStore((s) => s.decks[deckId])
  const { setPlaying, setPosition } = useDeckStore()
  const deckRef = useRef(deck)
  deckRef.current = deck

  const wasPlayingRef = useRef(false)
  const savedRateRef = useRef(1)

  const onScratchStart = useCallback((): void => {
    const engine = getDeckEngine(deckId)
    wasPlayingRef.current = engine.isPlaying
    savedRateRef.current = engine.playbackRate
    if (engine.isPlaying) {
      // Freeze audio in place — keeps the source node alive for rate control
      engine.playbackRate = 0
    }
  }, [deckId])

  // deltaSeconds: how much audio position should advance
  // timeDeltaSec: real elapsed time since last call
  const onScratch = useCallback((deltaSeconds: number, timeDeltaSec: number): void => {
    const engine = getDeckEngine(deckId)
    if (wasPlayingRef.current) {
      // Rate = audio seconds per real second → produces pitch-shifted scratch sound
      const rate = timeDeltaSec > 0 ? deltaSeconds / timeDeltaSec : 0
      // Clamp: Web Audio can't reverse; freeze for backward motion
      engine.playbackRate = Math.max(0, Math.min(8, rate))
      setPosition(deckId, engine.position)
    } else {
      // Not playing — seek-only, no audio
      const cur = deckRef.current
      if (!cur.track) return
      const newPos = Math.max(0, Math.min(cur.track.duration, cur.position + deltaSeconds))
      engine.seek(newPos)
      setPosition(deckId, newPos)
    }
  }, [deckId, setPosition])

  const onScratchEnd = useCallback((): void => {
    const engine = getDeckEngine(deckId)
    if (wasPlayingRef.current) {
      engine.playbackRate = savedRateRef.current  // restore normal speed
      setPlaying(deckId, true)
    } else {
      setPlaying(deckId, false)
    }
    setPosition(deckId, engine.position)
  }, [deckId, setPlaying, setPosition])

  return { onScratchStart, onScratch, onScratchEnd }
}
