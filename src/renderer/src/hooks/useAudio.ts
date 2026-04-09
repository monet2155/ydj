import { useRef, useEffect } from 'react'
import { AudioEngine } from '../engine/AudioEngine.js'
import { DeckEngine } from '../engine/DeckEngine.js'
import { MixerEngine } from '../engine/MixerEngine.js'

// Singleton engine refs — live outside React tree
let audioEngine: AudioEngine | null = null
const deckEngines: Record<'A' | 'B', DeckEngine | null> = { A: null, B: null }
let mixerEngine: MixerEngine | null = null

export function getAudioEngine(): AudioEngine {
  if (!audioEngine) audioEngine = AudioEngine.getInstance()
  return audioEngine
}

export function getDeckEngine(deckId: 'A' | 'B'): DeckEngine {
  if (!deckEngines[deckId]) {
    const ctx = getAudioEngine().ctx
    deckEngines[deckId] = new DeckEngine(ctx)
  }
  return deckEngines[deckId]!
}

export function getMixerEngine(): MixerEngine {
  if (!mixerEngine) {
    const ctx = getAudioEngine().ctx
    mixerEngine = new MixerEngine(ctx)
    // Connect decks to mixer
    mixerEngine.connectDeck(getDeckEngine('A'), 'A')
    mixerEngine.connectDeck(getDeckEngine('B'), 'B')
  }
  return mixerEngine
}

/** Hook: position polling for a deck */
export function useDeckPosition(
  deckId: 'A' | 'B',
  onPosition: (pos: number) => void
): void {
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const deck = getDeckEngine(deckId)

    const tick = (): void => {
      onPosition(deck.position)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [deckId, onPosition])
}
