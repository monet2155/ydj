import { useState, useEffect } from 'react'
import type { DeckId } from './deckStore.js'

const buffers: Record<string, AudioBuffer | null> = { A: null, B: null }
const subscribers = new Set<() => void>()

export function setDeckBuffer(id: DeckId, buf: AudioBuffer | null): void {
  buffers[id] = buf
  subscribers.forEach((fn) => fn())
}

export function getDeckBuffer(id: DeckId): AudioBuffer | null {
  return buffers[id] ?? null
}

export function useAudioBuffers(): Record<string, AudioBuffer | null> {
  const [, tick] = useState(0)
  useEffect(() => {
    const fn = (): void => tick((n) => n + 1)
    subscribers.add(fn)
    return () => { subscribers.delete(fn) }
  }, [])
  return buffers
}
