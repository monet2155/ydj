import { useRef, useEffect } from 'react'
import { AudioEngine } from '../engine/AudioEngine.js'
import { DeckEngine } from '../engine/DeckEngine.js'
import { MixerEngine } from '../engine/MixerEngine.js'

// Store engines on window so they survive Vite HMR module replacement.
// Module-level `let` resets to null on HMR; window persists.
const w = window as Record<string, unknown>

export function getAudioEngine(): AudioEngine {
  if (!w.__ydj_audio) w.__ydj_audio = AudioEngine.getInstance()
  return w.__ydj_audio as AudioEngine
}

export function getMixerEngine(): MixerEngine {
  if (!w.__ydj_mixer) {
    const ctx = getAudioEngine().ctx
    w.__ydj_mixer = new MixerEngine(ctx)
  }
  return w.__ydj_mixer as MixerEngine
}

export function getDeckEngine(deckId: 'A' | 'B'): DeckEngine {
  const key = `__ydj_deck_${deckId}`
  if (!w[key]) {
    const ctx = getAudioEngine().ctx
    const deck = new DeckEngine(ctx)
    getMixerEngine().connectDeck(deck, deckId)
    w[key] = deck
  }
  return w[key] as DeckEngine
}

/** Hook: position polling for a deck — only fires callback when value changes */
export function useDeckPosition(
  deckId: 'A' | 'B',
  onPosition: (pos: number) => void
): void {
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const deck = getDeckEngine(deckId)
    let lastPos = -1

    const tick = (): void => {
      const pos = deck.position
      if (pos !== lastPos) {
        lastPos = pos
        onPosition(pos)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [deckId, onPosition])
}
