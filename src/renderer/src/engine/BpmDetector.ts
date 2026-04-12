/**
 * BpmDetector — autocorrelation-based BPM detection
 *
 * Algorithm:
 * 1. Downsample to ~4 kHz with averaging (low-pass + decimate → bass/kick focus)
 * 2. RMS energy per 10 ms frame
 * 3. Onset strength = positive half-wave rectified first difference of energy
 * 4. Autocorrelation of onset strength in the 60–200 BPM lag range
 * 5. Parabolic interpolation for sub-frame precision
 * 6. Octave correction (halve if >160, double if <80)
 *
 * Works far better than peak-interval histogram on real music because
 * autocorrelation finds the *repeating pattern* rather than individual loud peaks.
 */

const MIN_BPM = 60
const MAX_BPM = 200
const TARGET_RATE = 4000   // Hz — sufficient for kick/bass onset detection
const FRAME_MS   = 10      // ms per RMS energy frame

export function detectBpmFromPeaks(samples: Float32Array, sampleRate: number): number {
  // ── 1. Downsample with averaging (anti-aliased decimation) ─────────────────
  const step = Math.max(1, Math.floor(sampleRate / TARGET_RATE))
  const actualRate = sampleRate / step
  const dsLen = Math.floor(samples.length / step)
  const ds = new Float32Array(dsLen)
  for (let i = 0; i < dsLen; i++) {
    let s = 0
    const base = i * step
    for (let j = 0; j < step; j++) s += Math.abs(samples[base + j])
    ds[i] = s / step
  }

  // ── 2. RMS energy per frame ────────────────────────────────────────────────
  const frameSize = Math.max(1, Math.round(actualRate * FRAME_MS / 1000))
  const numFrames = Math.floor(dsLen / frameSize)
  if (numFrames < 20) return 0

  const energy = new Float32Array(numFrames)
  for (let f = 0; f < numFrames; f++) {
    let s = 0
    const base = f * frameSize
    for (let j = 0; j < frameSize; j++) s += ds[base + j] ** 2
    energy[f] = Math.sqrt(s / frameSize)
  }

  // ── 3. Onset strength: positive half-wave rectified first difference ───────
  //   Captures beats as sharp energy rises while ignoring slow fades.
  const onset = new Float32Array(numFrames)
  for (let f = 1; f < numFrames; f++) {
    onset[f] = Math.max(0, energy[f] - energy[f - 1])
  }

  // ── 4. Autocorrelation of onset strength in BPM lag range ─────────────────
  //   acf[lag] is high when the onset pattern repeats every `lag` frames,
  //   i.e. beat period = lag * frameSize / actualRate seconds.
  const minLag = Math.max(1, Math.floor(actualRate * 60 / (MAX_BPM * frameSize)))
  const maxLag = Math.floor(actualRate * 60 / (MIN_BPM * frameSize))
  if (minLag >= maxLag) return 0

  const acf = new Float32Array(maxLag + 1)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0
    const n = numFrames - lag
    for (let i = 0; i < n; i++) s += onset[i] * onset[i + lag]
    acf[lag] = s
  }

  // Find the lag with the strongest autocorrelation
  let bestLag = minLag
  let bestScore = acf[minLag]
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (acf[lag] > bestScore) {
      bestScore = acf[lag]
      bestLag = lag
    }
  }
  if (bestScore <= 0) return 0

  // ── 5. Parabolic interpolation for sub-frame precision ────────────────────
  let refinedLag = bestLag
  if (bestLag > minLag && bestLag < maxLag) {
    const y0 = acf[bestLag - 1], y1 = acf[bestLag], y2 = acf[bestLag + 1]
    const denom = 2 * (2 * y1 - y0 - y2)
    if (denom > 0) refinedLag = bestLag + (y0 - y2) / denom
  }

  const beatPeriodSec = (refinedLag * frameSize) / actualRate
  let bpm = 60 / beatPeriodSec

  // ── 6. Octave correction ───────────────────────────────────────────────────
  //   Autocorrelation can lock onto half or double the true beat period.
  //   Snap to the musically sensible range with a single halve or double.
  if (bpm < 80 && bpm * 2 <= MAX_BPM) bpm *= 2
  else if (bpm > 160 && bpm / 2 >= MIN_BPM) bpm /= 2

  return Math.max(MIN_BPM, Math.min(MAX_BPM, bpm))
}

export function detectBpmFromBuffer(buffer: AudioBuffer): number {
  return detectBpmFromPeaks(buffer.getChannelData(0), buffer.sampleRate)
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
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
  return 60000 / avg
}
