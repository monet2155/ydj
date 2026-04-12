import { useRef, useEffect } from 'react'
import { AudioEngine } from '../engine/AudioEngine.js'
import { DeckEngine } from '../engine/DeckEngine.js'
import { MixerEngine } from '../engine/MixerEngine.js'
import { FxEngine } from '../engine/FxEngine.js'

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
  const existing = w[key] as DeckEngine | undefined
  // If the cached instance is stale (HMR replaced DeckEngine but window still holds
  // the old object), clear it so we create a fresh one with the current API.
  if (existing && typeof existing.setDirection !== 'function') {
    delete w[key]
    delete w[`__ydj_fx_${deckId}`]
  }
  if (!w[key]) {
    const ctx = getAudioEngine().ctx
    const deck = new DeckEngine(ctx)
    getMixerEngine().connectDeck(deck, deckId)
    w[key] = deck
    // Clear stale FxEngine so it's rebuilt with the new deck
    delete w[`__ydj_fx_${deckId}`]
  }
  return w[key] as DeckEngine
}

export function getFxEngine(deckId: 'A' | 'B'): FxEngine {
  const key = `__ydj_fx_${deckId}`
  if (!w[key]) {
    const ctx = getAudioEngine().ctx
    const deck = getDeckEngine(deckId)
    w[key] = new FxEngine(ctx, deck)
  }
  return w[key] as FxEngine
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
