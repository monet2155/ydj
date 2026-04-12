import { useCallback, useRef } from 'react'
import { useDeckStore, type DeckId } from '../store/deckStore.js'
import { getDeckEngine } from './useAudio.js'

export interface ScratchHandlers {
  onScratchStart: () => void
  onScratch: (deltaSeconds: number, timeDeltaSec: number) => void
  onScratchEnd: () => void
}

export function useDeckScratch(deckId: DeckId): ScratchHandlers {
  const { setPlaying, setPosition } = useDeckStore()
  const deckRef = useRef(useDeckStore.getState().decks[deckId])

  // Keep deckRef current without subscribing to store (avoids re-render per frame)
  useDeckStore.subscribe((state) => { deckRef.current = state.decks[deckId] })

  const wasPlayingRef = useRef(false)

  const onScratchStart = useCallback((): void => {
    const engine = getDeckEngine(deckId)
    wasPlayingRef.current = engine.isPlaying
    if (engine.isPlaying) {
      // Freeze audio — keep source node alive for rate control
      engine.playbackRate = 0
    }
  }, [deckId])

  // deltaSeconds: audio position delta; timeDeltaSec: real time since last call
  const onScratch = useCallback((deltaSeconds: number, timeDeltaSec: number): void => {
    const engine = getDeckEngine(deckId)
    const cur = deckRef.current
    if (!cur.track) return
    const duration = cur.track.duration

    if (wasPlayingRef.current) {
      const rate = timeDeltaSec > 0 ? deltaSeconds / timeDeltaSec : 0
      if (rate >= 0) {
        // Forward: setDirection handles the reverse→forward switch if needed,
        // or just updates the rate when already forward.
        engine.setDirection(false, Math.min(8, rate))
        setPosition(deckId, engine.position)
      } else {
        // Backward: switch to reverse buffer playback with the absolute rate.
        // setDirection handles the forward→reverse switch (with crossfade) or
        // just updates rate when already in reverse.
        engine.setDirection(true, Math.min(8, Math.abs(rate)))
        setPosition(deckId, engine.position)
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
      // Use store's playbackRate as the authoritative restore target — it reflects
      // any pitch/sync changes made after onScratchStart (savedRef would be stale).
      const restoreRate = useDeckStore.getState().decks[deckId].playbackRate
      // If we ended in reverse, switch back to forward playback
      if (engine.isReverse) {
        engine.setDirection(false, restoreRate)
      } else {
        engine.playbackRate = restoreRate
      }
      // Engine may have stopped if reverse scratch reached position 0.
      // Restart from the current offset (0 = beginning of track) at the restored rate.
      if (!engine.isPlaying) {
        engine.play()
      }
      setPlaying(deckId, true)
    } else {
      setPlaying(deckId, false)
    }
    setPosition(deckId, engine.position)
  }, [deckId, setPlaying, setPosition])

  return { onScratchStart, onScratch, onScratchEnd }
}
