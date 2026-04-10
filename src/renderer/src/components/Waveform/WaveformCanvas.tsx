import { useEffect, useRef, useCallback } from 'react'

interface WaveformCanvasProps {
  audioBuffer: AudioBuffer | null
  position: number
  duration: number
  color: string
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

    // Center line (playhead always in the middle)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(Math.floor(width / 2), 0, 1, height)
  }, [position, color])

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
