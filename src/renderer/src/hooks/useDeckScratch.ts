import { useCallback, useRef } from 'react'
import { useDeckStore, type DeckId } from '../store/deckStore.js'
import { getDeckEngine } from './useAudio.js'

export function useDeckScratch(deckId: DeckId) {
  const deck = useDeckStore((s) => s.decks[deckId])
  const { setPlaying, setPosition } = useDeckStore()
  const deckRef = useRef(deck)
  deckRef.current = deck
  const wasPlayingRef = useRef(false)

  const onScratchStart = useCallback((): void => {
    wasPlayingRef.current = deckRef.current.isPlaying
    if (deckRef.current.isPlaying) {
      getDeckEngine(deckId).pause()
      setPlaying(deckId, false)
    }
  }, [deckId, setPlaying])

  const onScratch = useCallback((deltaSeconds: number): void => {
    const cur = deckRef.current
    if (!cur.track) return
    const newPos = Math.max(0, Math.min(cur.track.duration, cur.position + deltaSeconds))
    getDeckEngine(deckId).seek(newPos)
    setPosition(deckId, newPos)
  }, [deckId, setPosition])

  const onScratchEnd = useCallback((): void => {
    if (wasPlayingRef.current) {
      getDeckEngine(deckId).play()
      setPlaying(deckId, true)
    }
  }, [deckId, setPlaying])

  return { onScratchStart, onScratch, onScratchEnd }
}
