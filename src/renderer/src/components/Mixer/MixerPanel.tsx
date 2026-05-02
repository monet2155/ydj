import { useEffect, useRef, useState } from 'react'
import { useMixerStore } from '../../store/mixerStore.js'
import { useDeckStore, type DeckId } from '../../store/deckStore.js'
import { getMixerEngine } from '../../hooks/useAudio.js'
import { getDeckEngine } from '../../hooks/useAudio.js'
import Knob from './Knob.js'

const AUTO_DURATIONS = [4, 8, 16, 32] as const
type AutoDuration = typeof AUTO_DURATIONS[number]

function EqChannel({ deckId }: { deckId: DeckId }): JSX.Element {
  const eq = useDeckStore((s) => s.decks[deckId].eq)
  const { setEq, setEqKill } = useDeckStore()
  const bands = ['high', 'mid', 'low'] as const

  const handleEq = (band: 'low' | 'mid' | 'high', db: number): void => {
    getDeckEngine(deckId).setEq(band, db)
    setEq(deckId, band, db)
  }

  const handleKill = (band: 'low' | 'mid' | 'high'): void => {
    const kill = !eq[`${band}Kill` as 'lowKill' | 'midKill' | 'highKill']
    getDeckEngine(deckId).setEqKill(band, kill)
    setEqKill(deckId, band, kill)
  }

  return (
    <div className="flex flex-col items-center gap-2 px-2">
      <span className="text-xs font-black tracking-widest text-slate-500">
        {deckId}
      </span>
      {bands.map((band) => {
        const kill = eq[`${band}Kill` as 'lowKill' | 'midKill' | 'highKill']
        return (
          <div key={band} className="flex flex-col items-center gap-1">
            <Knob
              value={kill ? -40 : eq[band]}
              min={-40}
              max={6}
              defaultValue={0}
              label={band.toUpperCase()}
              color={kill ? '#ef4444' : '#64748b'}
              size={38}
              onChange={(db) => { if (!kill) handleEq(band, db) }}
            />
            <button
              onClick={() => handleKill(band)}
              className={[
                'text-[10px] font-bold px-2 py-1 rounded tracking-widest transition-colors',
                kill ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'
              ].join(' ')}
            >
              KILL
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default function MixerPanel(): JSX.Element {
  const { crossfader, masterVolume, setCrossfader, setMasterVolume } = useMixerStore()
  const cueEnabledA = useMixerStore((s) => s.cueEnabled.A)
  const cueEnabledB = useMixerStore((s) => s.cueEnabled.B)
  const cueGain = useMixerStore((s) => s.cueGain)
  const cueMix = useMixerStore((s) => s.cueMix)
  const [autoDuration, setAutoDuration] = useState<AutoDuration>(8)
  const [autoFading, setAutoFading] = useState(false)
  const [autoRemaining, setAutoRemaining] = useState(0)
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { getMixerEngine().setCrossfader(crossfader) }, [crossfader])
  useEffect(() => { getMixerEngine().setMasterVolume(masterVolume) }, [masterVolume])
  useEffect(() => { getMixerEngine().setCueEnabled('A', cueEnabledA) }, [cueEnabledA])
  useEffect(() => { getMixerEngine().setCueEnabled('B', cueEnabledB) }, [cueEnabledB])
  useEffect(() => { getMixerEngine().setCueGain(cueGain) }, [cueGain])
  useEffect(() => { getMixerEngine().setCueMix(cueMix) }, [cueMix])

  const handleAuto = (): void => {
    if (autoFading) {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current)
      setAutoFading(false)
      return
    }
    const target = crossfader < 0.5 ? 1 : 0
    const startVal = crossfader
    const startTime = Date.now()
    const durationMs = autoDuration * 1000
    setAutoFading(true)
    autoTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const t = Math.min(elapsed / durationMs, 1)
      const next = startVal + (target - startVal) * t
      setCrossfader(next)
      setAutoRemaining(Math.max(0, (durationMs - elapsed) / 1000))
      if (t >= 1) {
        clearInterval(autoTimerRef.current!)
        autoTimerRef.current = null
        setAutoFading(false)
        setAutoRemaining(0)
      }
    }, 40)
  }

  useEffect(() => () => { if (autoTimerRef.current) clearInterval(autoTimerRef.current) }, [])

  return (
    <div
      className="flex flex-col items-center shrink-0 p-2 pb-10 gap-3 border-x"
      style={{ width: 220, background: 'linear-gradient(180deg, #0b0d14 0%, #080a10 100%)', borderColor: 'rgba(255,255,255,0.06)' }}
      data-testid="mixer-panel"
    >
      <div className="text-[10px] font-black tracking-[0.25em] text-slate-500">MIXER</div>

      {/* EQ channels */}
      <div className="flex gap-1 w-full justify-center">
        <EqChannel deckId="A" />

        {/* Master volume */}
        <div className="flex flex-col items-center gap-2 px-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-xs text-slate-600">VOL</span>
          <input
            type="range" min={0} max={1} step={0.01}
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="accent-slate-400"
            style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 80 }}
          />
          <span className="text-xs font-mono text-slate-600">{Math.round(masterVolume * 100)}</span>
        </div>

        <EqChannel deckId="B" />
      </div>

      <div className="flex-1" />

      {/* Crossfader */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        <div className="flex justify-between w-full px-1 items-center">
          <span className="text-[11px] font-black text-slate-400">A</span>
          <span className="text-[9px] font-bold tracking-[0.2em] text-slate-600">XFADER</span>
          <span className="text-[11px] font-black text-slate-400">B</span>
        </div>
        {/* Gradient track wrapper */}
        <div className="relative w-full flex items-center">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded pointer-events-none"
            style={{ background: '#1e293b' }} />
          <input
            type="range" min={0} max={1} step={0.001}
            value={crossfader}
            onChange={(e) => { if (!autoFading) setCrossfader(parseFloat(e.target.value)) }}
            className="relative w-full"
            style={{ background: 'transparent' }}
          />
        </div>

        {/* Auto-crossfade */}
        <div className="flex gap-1 w-full">
          <button
            onClick={handleAuto}
            className="flex-1 py-1.5 rounded text-[10px] font-bold font-mono tracking-widest transition-all duration-150"
            style={autoFading ? {
              background: 'linear-gradient(90deg, #3b82f630, #10b98130, #f9731630)',
              border: '1px solid rgba(16,185,129,0.4)',
              color: '#6ee7b7',
              boxShadow: '0 0 10px rgba(16,185,129,0.2)',
            } : {
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#94a3b8',
            }}
          >
            {autoFading ? `■ ${autoRemaining.toFixed(1)}s` : '▶ AUTO'}
          </button>
          <button
            onClick={() => {
              const idx = AUTO_DURATIONS.indexOf(autoDuration)
              setAutoDuration(AUTO_DURATIONS[(idx + 1) % AUTO_DURATIONS.length])
            }}
            disabled={autoFading}
            className="w-10 py-1.5 rounded text-[10px] font-mono text-slate-400 disabled:opacity-40 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {autoDuration}s
          </button>
        </div>
      </div>
    </div>
  )
}
