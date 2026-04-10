/**
 * BpmWorker — runs BPM detection off the main thread.
 * Receives: { samples: Float32Array, sampleRate: number }
 * Posts:    { bpm: number }
 */
import { detectBpmFromPeaks } from './BpmDetector.js'

self.onmessage = (e: MessageEvent<{ samples: Float32Array; sampleRate: number }>): void => {
  const { samples, sampleRate } = e.data
  const bpm = detectBpmFromPeaks(samples, sampleRate)
  self.postMessage({ bpm })
}
