import { useState, useEffect } from 'react'
import type { DeckId } from './deckStore.js'

// Store on window to survive Vite HMR module replacement
const w = window as Record<string, unknown>
if (!w.__ydj_bufs) w.__ydj_bufs = { A: null, B: null }
if (!w.__ydj_buf_subs) w.__ydj_buf_subs = new Set<() => void>()

const buffers = w.__ydj_bufs as Record<string, AudioBuffer | null>
const subscribers = w.__ydj_buf_subs as Set<() => void>

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
