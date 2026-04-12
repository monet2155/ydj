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
    const cur = deckRef.current
    if (!cur.track) return
    const duration = cur.track.duration

    if (wasPlayingRef.current) {
      const rate = timeDeltaSec > 0 ? deltaSeconds / timeDeltaSec : 0
      if (rate >= 0) {
        // Forward: set playback rate → pitch-shifted scratch sound
        engine.playbackRate = Math.min(8, rate)
        setPosition(deckId, engine.position)
      } else {
        // Backward: seek source node to new position at rate=0 (silent).
        // Must actually move the source node so onScratchEnd resumes from
        // the correct position — setFrozenPosition only updates the tracker.
        const newPos = Math.max(0, Math.min(duration, engine.position + deltaSeconds))
        engine.playbackRate = 0   // ensure frozen before seek
        engine.seek(newPos)       // stop → restart source at newPos at rate=0
        setPosition(deckId, newPos)
      }
    } else {
      // Not playing — seek-only, no audio
      const newPos = Math.max(0, Math.min(duration, cur.position + deltaSeconds))
      engine.seek(newPos)
      setPosition(deckId, newPos)
    }
  }, [deckId, setPosition])

  const onScratchEnd = useCallback((): void => {
    const engine = getDeckEngine(deckId)
    if (wasPlayingRef.current) {
      // Rate is currently 0. Setting it to savedRate directly would resume
      // the source from its internal frozen position, which is correct here:
      // forward scratch left source at the right pos, backward scratch
      // already seeked source to the right pos via engine.seek().
      engine.playbackRate = savedRateRef.current
      setPlaying(deckId, true)
    } else {
      setPlaying(deckId, false)
    }
    setPosition(deckId, engine.position)
  }, [deckId, setPlaying, setPosition])

  return { onScratchStart, onScratch, onScratchEnd }
}
