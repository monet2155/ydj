import { describe, it, expect } from 'vitest'
import { detectBpmFromPeaks, tapBpm } from '../engine/BpmDetector.js'

// Create a fake AudioBuffer with a simple beat pattern
function makeBeatBuffer(bpm: number, durationSec: number, sampleRate = 44100): Float32Array {
  const totalSamples = Math.floor(durationSec * sampleRate)
  const data = new Float32Array(totalSamples)
  const samplesPerBeat = Math.floor((60 / bpm) * sampleRate)

  for (let beat = 0; beat * samplesPerBeat < totalSamples; beat++) {
    const idx = beat * samplesPerBeat
    // Sharp transient (kick-like)
    for (let i = 0; i < 100 && idx + i < totalSamples; i++) {
      data[idx + i] = 1.0 - i / 100
    }
  }
  return data
}

describe('BpmDetector', () => {
  it('detects 128 BPM within ±3 BPM', () => {
    const data = makeBeatBuffer(128, 10)
    const detected = detectBpmFromPeaks(data, 44100)
    expect(detected).toBeGreaterThan(125)
    expect(detected).toBeLessThan(131)
  })

  it('detects 140 BPM within ±3 BPM', () => {
    const data = makeBeatBuffer(140, 10)
    const detected = detectBpmFromPeaks(data, 44100)
    expect(detected).toBeGreaterThan(137)
    expect(detected).toBeLessThan(143)
  })

  it('detects 90 BPM within ±3 BPM', () => {
    const data = makeBeatBuffer(90, 10)
    const detected = detectBpmFromPeaks(data, 44100)
    expect(detected).toBeGreaterThan(87)
    expect(detected).toBeLessThan(93)
  })

  describe('tapBpm', () => {
    it('calculates BPM from 4 taps at 128 BPM interval', () => {
      const interval = (60 / 128) * 1000 // ms per beat
      const taps = [0, interval, interval * 2, interval * 3]
      const bpm = tapBpm(taps)
      expect(bpm).toBeGreaterThan(126)
      expect(bpm).toBeLessThan(130)
    })

    it('returns null for fewer than 2 taps', () => {
      expect(tapBpm([0])).toBeNull()
      expect(tapBpm([])).toBeNull()
    })
  })
})
