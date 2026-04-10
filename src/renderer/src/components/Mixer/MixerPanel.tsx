import { useEffect } from 'react'
import { useMixerStore } from '../../store/mixerStore.js'
import { useDeckStore, type DeckId } from '../../store/deckStore.js'
import { getMixerEngine } from '../../hooks/useAudio.js'
import { getDeckEngine } from '../../hooks/useAudio.js'
import Knob from './Knob.js'

function EqChannel({ deckId }: { deckId: DeckId }): JSX.Element {
  const eq = useDeckStore((s) => s.decks[deckId].eq)
  const { setEq, setEqKill } = useDeckStore()
  const isA = deckId === 'A'
  const color = isA ? '#3b82f6' : '#f97316'
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
      <span className={`text-xs font-black tracking-widest ${isA ? 'text-blue-400' : 'text-orange-400'}`}>
        {deckId}
      </span>
      {bands.map((band) => {
        const kill = eq[`${band}Kill` as 'lowKill' | 'midKill' | 'highKill']
        return (
          <div key={band} className="flex flex-col items-center gap-1">
            <Knob
              value={kill ? -40 : eq[band]}
              min={-12}
              max={6}
              defaultValue={0}
              label={band.toUpperCase()}
              color={kill ? '#ef4444' : color}
              size={32}
              onChange={(db) => { if (!kill) handleEq(band, db) }}
            />
            <button
              onClick={() => handleKill(band)}
              className={[
                'text-[9px] font-bold px-1.5 py-0.5 rounded tracking-widest',
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

  useEffect(() => { getMixerEngine().setCrossfader(crossfader) }, [crossfader])
  useEffect(() => { getMixerEngine().setMasterVolume(masterVolume) }, [masterVolume])

  return (
    <div
      className="flex flex-col items-center shrink-0 bg-[#0a0d14] border-x border-slate-800 p-2 gap-3"
      style={{ width: 220 }}
      data-testid="mixer-panel"
    >
      <div className="text-xs font-bold tracking-widest text-slate-600">MIXER</div>

      {/* EQ channels */}
      <div className="flex gap-1 w-full justify-center">
        <EqChannel deckId="A" />

        {/* Master volume */}
        <div className="flex flex-col items-center gap-2 px-2 border-x border-slate-800">
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
      <div className="flex flex-col items-center gap-1 w-full">
        <div className="flex justify-between w-full text-xs px-1">
          <span className="text-blue-400 font-bold">A</span>
          <span className="text-slate-600 text-[10px] tracking-widest">XFADER</span>
          <span className="text-orange-400 font-bold">B</span>
        </div>
        <input
          type="range" min={0} max={1} step={0.01}
          value={crossfader}
          onChange={(e) => setCrossfader(parseFloat(e.target.value))}
          className="w-full accent-slate-400"
        />
      </div>
    </div>
  )
}
