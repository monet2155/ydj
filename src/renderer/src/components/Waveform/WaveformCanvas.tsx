import { useEffect, useRef, useCallback, useState } from 'react'

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
  onDragStart?: () => void
  onScratch?: (deltaSeconds: number, timeDeltaSec: number) => void
  onDragEnd?: () => void
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

// Seconds visible on each side of the playhead — 작을수록 더 가까이(줌 인)
const VISIBLE_SECONDS = 1.5

export default function WaveformCanvas({
  audioBuffer,
  position,
  duration,
  color,
  hotCues,
  loop,
  onSeek,
  onDragStart,
  onScratch,
  onDragEnd,
}: WaveformCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const peaksRef = useRef<Float32Array | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startPos: number } | null>(null)

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
    // Deep background with subtle gradient
    const bg = ctx.createLinearGradient(0, 0, 0, height)
    bg.addColorStop(0, '#07090f')
    bg.addColorStop(1, '#0a0c14')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    const peaks = peaksRef.current
    if (!peaks) {
      // Empty state placeholder
      ctx.fillStyle = '#1e293b40'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = '#334155'
      ctx.font = '11px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('트랙을 불러오세요', width / 2, height / 2)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      return
    }

    const halfW = VISIBLE_SECONDS       // seconds shown on each side
    const totalVisible = halfW * 2      // total seconds in view
    const startTime = position - halfW

    for (let x = 0; x < width; x++) {
      const t = startTime + (x / width) * totalVisible
      const idx = Math.round(t * PEAKS_PER_SEC)
      const peak = idx >= 0 && idx < peaks.length ? peaks[idx] : 0
      const barH = peak * mid * 0.9

      if (t < position) {
        // Played — brighter color with subtle opacity falloff from playhead
        const proximity = Math.max(0, 1 - (position - t) / 4)
        ctx.globalAlpha = 0.55 + proximity * 0.45
        ctx.fillStyle = color
      } else {
        // Unplayed — muted, slightly blue-tinted grey
        ctx.globalAlpha = 0.25 + (peak * 0.2)
        ctx.fillStyle = '#3d4f6a'
      }
      ctx.fillRect(x, mid - barH, 1, barH * 2)
    }
    ctx.globalAlpha = 1

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
      ctx.font = 'bold 9px monospace'
      hotCues.forEach((sec, i) => {
        if (sec === null) return
        const x = ((sec - startTime) / totalVisible) * width
        if (x < -14 || x > width + 14) return
        const c = CUE_COLORS[i]
        ctx.fillStyle = c
        ctx.fillRect(x, 0, 2, height)
        // Label badge at top
        ctx.fillRect(x, 0, 14, 12)
        ctx.fillStyle = '#fff'
        ctx.fillText(String(i + 1), x + 2, 10)
      })
    }

    // Playhead — deck-colored with glow
    const px = Math.floor(width / 2)
    ctx.shadowColor = color
    ctx.shadowBlur = 10
    ctx.fillStyle = color
    ctx.fillRect(px - 1, 0, 2, height)
    // Bright center line
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillRect(px, 0, 1, height)
  }, [position, color, hotCues, loop])

  useEffect(() => { draw() }, [draw])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!duration) return
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startPos: position }
    setIsDragging(true)
    onDragStart?.()

    let lastX = e.clientX
    let lastTime = performance.now()

    const onMouseMove = (ev: MouseEvent): void => {
      if (!dragRef.current) return
      const canvas = canvasRef.current
      const width = canvas?.offsetWidth || 600
      const now = performance.now()

      // Incremental delta per frame for rate calculation
      const dxIncremental = ev.clientX - lastX
      const timeDeltaSec = Math.max(0.001, (now - lastTime) / 1000)
      // Drag right → earlier time (negative delta)
      const deltaSeconds = -(dxIncremental / width) * VISIBLE_SECONDS * 2
      lastX = ev.clientX
      lastTime = now

      onScratch?.(deltaSeconds, timeDeltaSec)
    }

    const onMouseUp = (ev: MouseEvent): void => {
      // Click (no significant drag) → seek to clicked position
      if (dragRef.current && Math.abs(ev.clientX - dragRef.current.startX) < 4) {
        const canvas = canvasRef.current
        if (canvas && onSeek) {
          const rect = canvas.getBoundingClientRect()
          const x = ev.clientX - rect.left
          const t = (dragRef.current.startPos - VISIBLE_SECONDS) + (x / rect.width) * VISIBLE_SECONDS * 2
          onSeek(Math.max(0, Math.min(duration, t)))
        }
      }
      dragRef.current = null
      setIsDragging(false)
      onDragEnd?.()
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [onSeek, onDragStart, onScratch, onDragEnd, duration, position])

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    />
  )
}
