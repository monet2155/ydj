import { useEffect, useRef, useCallback } from 'react'

interface WaveformCanvasProps {
  audioBuffer: AudioBuffer | null
  position: number       // current playback position in seconds
  duration: number
  color: string          // accent color for played region
  onSeek?: (sec: number) => void
}

function buildPeaks(buffer: AudioBuffer, numPoints: number): Float32Array {
  const channel = buffer.getChannelData(0)
  const blockSize = Math.floor(channel.length / numPoints)
  const peaks = new Float32Array(numPoints)

  for (let i = 0; i < numPoints; i++) {
    let max = 0
    for (let j = 0; j < blockSize; j++) {
      const abs = Math.abs(channel[i * blockSize + j])
      if (abs > max) max = abs
    }
    peaks[i] = max
  }
  return peaks
}

export default function WaveformCanvas({
  audioBuffer,
  position,
  duration,
  color,
  onSeek
}: WaveformCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const peaksRef = useRef<Float32Array | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)

  // Rebuild peaks when buffer changes
  useEffect(() => {
    if (!audioBuffer) {
      peaksRef.current = null
      bufferRef.current = null
      return
    }
    if (audioBuffer === bufferRef.current) return
    bufferRef.current = audioBuffer
    const canvas = canvasRef.current
    if (!canvas) return
    peaksRef.current = buildPeaks(audioBuffer, canvas.width)
  }, [audioBuffer])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    const mid = height / 2

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)

    const peaks = peaksRef.current
    if (!peaks) return

    const progress = duration > 0 ? position / duration : 0
    const playedX = Math.floor(progress * width)

    for (let x = 0; x < width; x++) {
      const peak = peaks[x] ?? 0
      const barH = peak * mid * 0.9

      ctx.fillStyle = x < playedX ? color : '#334155'
      ctx.fillRect(x, mid - barH, 1, barH * 2)
    }

    // Playhead line
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(playedX, 0, 1, height)
  }, [position, duration, color])

  // Redraw on every position change
  useEffect(() => {
    draw()
  }, [draw])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!onSeek || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const sec = (x / rect.width) * duration
    onSeek(sec)
  }

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={80}
      onClick={handleClick}
      className="w-full h-full rounded cursor-pointer"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
