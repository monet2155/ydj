import { useCallback, useRef } from 'react'

interface KnobProps {
  value: number      // current value
  min: number
  max: number
  defaultValue?: number
  label: string
  color?: string
  size?: number
  onChange: (v: number) => void
  onDoubleClick?: () => void
}

export default function Knob({
  value, min, max, defaultValue = 0, label, color = '#94a3b8', size = 36, onChange, onDoubleClick
}: KnobProps): JSX.Element {
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null)

  // Piecewise mapping centered on defaultValue:
  //   min..defaultValue → -135°..0°  (lower half)
  //   defaultValue..max →   0°..+135° (upper half)
  // 비대칭 레인지(예: -40..0..+6)에서 시각적 중심이 0이 되도록 한다.
  const range = max - min
  const center = defaultValue
  const angle = value <= center
    ? (center === min ? 0 : ((value - center) / (center - min)) * 135)  // -135..0
    : (center === max ? 0 : ((value - center) / (max - center)) * 135)  // 0..+135

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startVal: value }

    const onMove = (ev: MouseEvent): void => {
      if (!dragRef.current) return
      const delta = (dragRef.current.startY - ev.clientY) / 100  // px → normalized
      const next = Math.max(min, Math.min(max, dragRef.current.startVal + delta * range))
      onChange(Math.round(next * 10) / 10)
    }

    const onUp = (): void => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [value, min, max, range, onChange])

  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <div
        className="relative rounded-full cursor-ns-resize"
        style={{ width: size, height: size }}
        onMouseDown={onMouseDown}
        onDoubleClick={() => { onDoubleClick?.(); onChange(defaultValue) }}
        title={`${label}: ${value > 0 ? '+' : ''}${value.toFixed(1)} dB (더블클릭: 리셋)`}
      >
        {/* Track */}
        <svg width={size} height={size} className="absolute inset-0">
          <circle
            cx={size / 2} cy={size / 2} r={size / 2 - 3}
            fill="#1e293b" stroke="#334155" strokeWidth={1.5}
          />
          {/* Indicator line */}
          <line
            x1={size / 2}
            y1={size / 2}
            x2={size / 2 + (size / 2 - 6) * Math.sin((angle * Math.PI) / 180)}
            y2={size / 2 - (size / 2 - 6) * Math.cos((angle * Math.PI) / 180)}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span className="text-slate-600 font-bold tracking-widest" style={{ fontSize: 9 }}>{label}</span>
    </div>
  )
}
