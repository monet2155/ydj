import { useEffect, useRef, useState } from 'react'

interface VinylDiskProps {
  isPlaying: boolean
  color: string    // '#3b82f6' | '#f97316'
  label: string    // 'A' | 'B'
  hasTrack?: boolean
  onScratchStart: () => void
  onScratch: (deltaSeconds: number) => void
  onScratchEnd: () => void
}

// 33 RPM → degrees per millisecond
const DEG_PER_MS = (33 * 360) / 60_000

export default function VinylDisk({
  isPlaying,
  color,
  label,
  hasTrack = false,
  onScratchStart,
  onScratch,
  onScratchEnd,
}: VinylDiskProps): JSX.Element {
  const diskRef = useRef<HTMLDivElement>(null)
  const angleRef = useRef(0)
  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const lastMouseAngleRef = useRef(0)
  const rafRef = useRef(0)
  const isPlayingRef = useRef(isPlaying)
  isPlayingRef.current = isPlaying

  // Rotation loop — runs when playing and not dragging
  useEffect(() => {
    if (!isPlaying) return

    let lastTime = performance.now()

    const tick = (now: number): void => {
      if (!isDraggingRef.current) {
        angleRef.current = (angleRef.current + DEG_PER_MS * (now - lastTime)) % 360
        if (diskRef.current) {
          diskRef.current.style.transform = `rotate(${angleRef.current}deg)`
        }
        lastTime = now
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying])

  // Mouse angle helper
  const getMouseAngle = (e: MouseEvent): number => {
    const rect = diskRef.current!.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI)
  }

  // Attach global mouse handlers
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      if (!isDraggingRef.current) return

      const newAngle = getMouseAngle(e)
      let delta = newAngle - lastMouseAngleRef.current
      // Wrap-around correction
      if (delta > 180) delta -= 360
      if (delta < -180) delta += 360

      angleRef.current = (angleRef.current + delta + 360) % 360
      if (diskRef.current) {
        diskRef.current.style.transform = `rotate(${angleRef.current}deg)`
      }
      lastMouseAngleRef.current = newAngle

      // 1 full revolution (360°) = 60/33 seconds at 33 RPM
      const deltaSeconds = (delta / 360) * (60 / 33)
      onScratch(deltaSeconds)
    }

    const onUp = (): void => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsDragging(false)
      onScratchEnd()
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [onScratch, onScratchEnd])

  const handleMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    isDraggingRef.current = true
    setIsDragging(true)
    lastMouseAngleRef.current = getMouseAngle(e.nativeEvent)
    onScratchStart()
  }

  return (
    <div
      className="relative w-full aspect-square max-w-[200px] mx-auto select-none rounded-full"
      style={{
        boxShadow: isDragging
          ? `0 0 0 2px ${color}99, 0 0 24px ${color}55, 0 0 48px ${color}22`
          : isPlaying
            ? `0 0 0 1px ${color}44, 0 0 16px ${color}30, 0 4px 20px rgba(0,0,0,0.7)`
            : '0 0 0 1px rgba(255,255,255,0.06), 0 4px 20px rgba(0,0,0,0.7)',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      {/* Record body — rotation applied via ref */}
      <div
        ref={diskRef}
        className="absolute inset-0 rounded-full cursor-grab active:cursor-grabbing"
        style={{ background: 'radial-gradient(circle, #1c1a14 50%, #0d0c09 100%)' }}
        onMouseDown={handleMouseDown}
      >
        {/* Groove rings */}
        {[28, 36, 44, 52, 60, 68, 76].map((r, i) => (
          <div
            key={r}
            className="absolute rounded-full"
            style={{
              inset: `${r / 2}%`,
              border: `1px solid rgba(255,255,255,${0.04 + i * 0.01})`,
            }}
          />
        ))}

        {/* Center label */}
        <div
          className="absolute rounded-full flex flex-col items-center justify-center"
          style={{ inset: '35%', backgroundColor: color, opacity: hasTrack ? 0.9 : 0.4 }}
        >
          <span
            className="text-white font-black text-lg tracking-widest leading-none"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
          >
            {label}
          </span>
          {!hasTrack && (
            <span className="text-white text-[7px] font-bold opacity-70 tracking-wider leading-none mt-0.5">
              LOAD
            </span>
          )}
        </div>

        {/* Spindle */}
        <div
          className="absolute w-2 h-2 rounded-full bg-slate-900"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        />
      </div>
    </div>
  )
}
