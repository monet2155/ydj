/**
 * BpmDetector — lightweight peak-based BPM detection
 *
 * Algorithm:
 * 1. Downsample to mono
 * 2. Find onset peaks (energy threshold)
 * 3. Compute inter-onset intervals
 * 4. Histogram of intervals → find dominant interval → BPM
 */

const MIN_BPM = 60
const MAX_BPM = 200

/**
 * Detect BPM from raw PCM samples.
 * Returns BPM as a float, or 0 if detection failed.
 */
export function detectBpmFromPeaks(samples: Float32Array, sampleRate: number): number {
  // 1. Compute energy envelope (RMS over small windows)
  const windowSize = Math.floor(sampleRate * 0.01) // 10ms windows
  const energies: number[] = []

  for (let i = 0; i < samples.length - windowSize; i += windowSize) {
    let sum = 0
    for (let j = 0; j < windowSize; j++) {
      sum += samples[i + j] ** 2
    }
    energies.push(Math.sqrt(sum / windowSize))
  }

  // 2. Find peaks: local maxima above adaptive threshold
  const threshold = computeAdaptiveThreshold(energies)
  const peakIndices: number[] = []
  const minPeakGap = Math.floor((60 / MAX_BPM) * sampleRate / windowSize)

  for (let i = 1; i < energies.length - 1; i++) {
    if (
      energies[i] > threshold &&
      energies[i] > energies[i - 1] &&
      energies[i] >= energies[i + 1]
    ) {
      if (peakIndices.length === 0 || i - peakIndices[peakIndices.length - 1] >= minPeakGap) {
        peakIndices.push(i)
      }
    }
  }

  if (peakIndices.length < 4) return 0

  // 3. Compute inter-onset intervals in samples
  const intervals: number[] = []
  for (let i = 1; i < peakIndices.length; i++) {
    const diffFrames = peakIndices[i] - peakIndices[i - 1]
    const diffSec = (diffFrames * windowSize) / sampleRate
    const bpm = 60 / diffSec
    if (bpm >= MIN_BPM && bpm <= MAX_BPM) {
      intervals.push(bpm)
    }
  }

  if (intervals.length === 0) return 0

  // 4. Histogram of BPM values (1 BPM buckets)
  const hist = new Map<number, number>()
  for (const bpm of intervals) {
    const bucket = Math.round(bpm)
    hist.set(bucket, (hist.get(bucket) ?? 0) + 1)
  }

  // Find bucket with most votes
  let bestBpm = 0
  let bestCount = 0
  for (const [bpm, count] of hist) {
    if (count > bestCount) {
      bestCount = count
      bestBpm = bpm
    }
  }

  // Refine: average of all intervals within ±3 BPM of winner
  const nearby = intervals.filter((b) => Math.abs(b - bestBpm) <= 3)
  return nearby.reduce((a, b) => a + b, 0) / nearby.length
}

function computeAdaptiveThreshold(energies: number[]): number {
  // Use the mean + 0.5 std as threshold
  const mean = energies.reduce((a, b) => a + b, 0) / energies.length
  const variance = energies.reduce((a, b) => a + (b - mean) ** 2, 0) / energies.length
  return mean + Math.sqrt(variance) * 0.5
}

/**
 * Detect BPM from an AudioBuffer (uses first channel only).
 * Runs synchronously — call from a Web Worker for large files.
 */
export function detectBpmFromBuffer(buffer: AudioBuffer): number {
  const samples = buffer.getChannelData(0)
  return detectBpmFromPeaks(samples, buffer.sampleRate)
}

/**
 * Tap tempo: given array of tap timestamps (ms), returns BPM or null.
 */
export function tapBpm(timestamps: number[]): number | null {
  if (timestamps.length < 2) return null

  const intervals: number[] = []
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1])
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
  return 60000 / avgInterval
}
