import { useEffect, useRef, useCallback } from 'react'

const CUE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'
]

interface WaveformCanvasProps {
  audioBuffer: AudioBuffer | null
  position: number
  duration: number
  color: string
  hotCues?: (number | null)[]
  loop?: { active: boolean; start: number | null; end: number | null }
  onSeek?: (sec: number) => void
}

// High-res peaks: one peak per 10ms
const PEAKS_PER_SEC = 100

function buildPeaks(buffer: AudioBuffer): Float32Array {
  const total = Math.ceil(buffer.duration * PEAKS_PER_SEC)
  const blockSize = Math.floor(buffer.length / total)
  const channel = buffer.getChannelData(0)
  const peaks = new Float32Array(total)

  for (let i = 0; i < total; i++) {
    let max = 0
    for (let j = 0; j < blockSize; j++) {
      const abs = Math.abs(channel[i * blockSize + j])
      if (abs > max) max = abs
    }
    peaks[i] = max
  }
  return peaks
}

// Seconds visible on each side of the playhead
const VISIBLE_SECONDS = 6

export default function WaveformCanvas({
  audioBuffer,
  position,
  duration,
  color,
  hotCues,
  loop,
  onSeek,
}: WaveformCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const peaksRef = useRef<Float32Array | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)

  useEffect(() => {
    if (!audioBuffer) { peaksRef.current = null; bufferRef.current = null; return }
    if (audioBuffer === bufferRef.current) return
    bufferRef.current = audioBuffer
    peaksRef.current = buildPeaks(audioBuffer)
  }, [audioBuffer])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // HiDPI: scale canvas backing store to device pixel ratio
    const dpr = window.devicePixelRatio || 1
    const cssWidth = canvas.offsetWidth || 600
    const cssHeight = canvas.offsetHeight || 64
    const pxWidth = Math.round(cssWidth * dpr)
    const pxHeight = Math.round(cssHeight * dpr)
    if (canvas.width !== pxWidth || canvas.height !== pxHeight) {
      canvas.width = pxWidth
      canvas.height = pxHeight
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const width = cssWidth
    const height = cssHeight
    const mid = height / 2

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)

    const peaks = peaksRef.current
    if (!peaks) return

    const halfW = VISIBLE_SECONDS       // seconds shown on each side
    const totalVisible = halfW * 2      // total seconds in view
    const startTime = position - halfW

    for (let x = 0; x < width; x++) {
      const t = startTime + (x / width) * totalVisible
      const idx = Math.round(t * PEAKS_PER_SEC)
      const peak = idx >= 0 && idx < peaks.length ? peaks[idx] : 0
      const barH = peak * mid * 0.9

      // Left of playhead = played (colored), right = unplayed (dim)
      ctx.fillStyle = t < position ? color : '#334155'
      ctx.fillRect(x, mid - barH, 1, barH * 2)
    }

    // Loop region overlay
    if (loop && loop.start !== null && loop.end !== null) {
      const x1 = ((loop.start - startTime) / totalVisible) * width
      const x2 = ((loop.end - startTime) / totalVisible) * width
      if (x2 > 0 && x1 < width) {
        const clampX1 = Math.max(0, x1)
        const clampX2 = Math.min(width, x2)
        ctx.fillStyle = loop.active ? 'rgba(59,130,246,0.22)' : 'rgba(100,116,139,0.15)'
        ctx.fillRect(clampX1, 0, clampX2 - clampX1, height)
        ctx.fillStyle = loop.active ? '#3b82f6' : '#64748b'
        if (x1 >= 0 && x1 <= width) ctx.fillRect(x1, 0, 2, height)
        if (x2 >= 0 && x2 <= width) ctx.fillRect(x2 - 2, 0, 2, height)
      }
    }

    // Hot cue markers
    if (hotCues) {
      ctx.font = 'bold 7px monospace'
      hotCues.forEach((sec, i) => {
        if (sec === null) return
        const x = ((sec - startTime) / totalVisible) * width
        if (x < -10 || x > width + 10) return
        const c = CUE_COLORS[i]
        ctx.fillStyle = c
        ctx.fillRect(x, 0, 2, height)
        // Small triangle label at top
        ctx.fillRect(x, 0, 10, 9)
        ctx.fillStyle = '#fff'
        ctx.fillText(String(i + 1), x + 1.5, 8)
      })
    }

    // Center line (playhead always in the middle)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(Math.floor(width / 2), 0, 1, height)
  }, [position, color, hotCues, loop])

  useEffect(() => { draw() }, [draw])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!onSeek || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const halfW = VISIBLE_SECONDS
    const t = (position - halfW) + (x / rect.width) * (halfW * 2)
    onSeek(Math.max(0, Math.min(duration, t)))
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="w-full h-full rounded cursor-pointer"
    />
  )
}
