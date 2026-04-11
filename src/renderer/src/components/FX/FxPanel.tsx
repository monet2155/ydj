import { useEffect, useState } from 'react'
import { useFxStore } from '../../store/fxStore.js'
import { getFxEngine } from '../../hooks/useAudio.js'
import type { DeckId } from '../../store/deckStore.js'
import type { FilterMode } from '../../engine/FxEngine.js'

interface FxPanelProps {
  deckId: DeckId
}

const FX_LABEL: Record<string, string> = {
  filter: 'FILTER',
  delay: 'DELAY',
  reverb: 'REVERB',
  flanger: 'FLANGR',
}

const PARAM_LABEL: Record<string, string> = {
  filter: 'FREQ',
  delay: 'TIME',
  reverb: 'SIZE',
  flanger: 'RATE',
}

export default function FxPanel({ deckId }: FxPanelProps): JSX.Element {
  const isA = deckId === 'A'
  const accent = isA ? 'text-blue-400' : 'text-orange-400'
  const accentBg = isA ? 'bg-blue-600 hover:bg-blue-500' : 'bg-orange-600 hover:bg-orange-500'
  const [open, setOpen] = useState(false)

  const { fx, setFilter, setDelay, setReverb, setFlanger } = useFxStore()
  const deck = fx[deckId]

  useEffect(() => {
    const e = getFxEngine(deckId)
    e.setFilter(deck.filter.enabled, deck.filter.wet, deck.filter.param, deck.filter.mode)
  }, [deckId, deck.filter])

  useEffect(() => {
    const e = getFxEngine(deckId)
    e.setDelay(deck.delay.enabled, deck.delay.wet, deck.delay.param)
  }, [deckId, deck.delay])

  useEffect(() => {
    const e = getFxEngine(deckId)
    e.setReverb(deck.reverb.enabled, deck.reverb.wet, deck.reverb.param)
  }, [deckId, deck.reverb])

  useEffect(() => {
    const e = getFxEngine(deckId)
    e.setFlanger(deck.flanger.enabled, deck.flanger.wet, deck.flanger.param)
  }, [deckId, deck.flanger])

  const anyOn = deck.filter.enabled || deck.delay.enabled || deck.reverb.enabled || deck.flanger.enabled

  const rowClass = 'flex items-center gap-1.5 py-0.5'
  const labelClass = 'text-[10px] font-bold font-mono w-12 shrink-0'
  const sliderClass = 'flex-1 h-1 accent-slate-400'
  const onOffBtn = (enabled: boolean): string =>
    [
      'w-10 py-1 rounded text-[10px] font-bold shrink-0 transition-colors',
      enabled ? accentBg + ' text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300',
    ].join(' ')

  return (
    <div className="flex flex-col border-t border-slate-800 pt-2">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 mb-1 w-full text-left`}
      >
        <span className={`text-[10px] font-bold tracking-widest ${anyOn ? accent : 'text-slate-600'}`}>
          FX
        </span>
        {anyOn && (
          <span className={`text-[9px] font-mono ${accent}`}>
            {[deck.filter.enabled && 'FLT', deck.delay.enabled && 'DLY', deck.reverb.enabled && 'RVB', deck.flanger.enabled && 'FLG']
              .filter(Boolean).join(' ')}
          </span>
        )}
        <span className="ml-auto text-[10px] text-slate-600">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-0.5">
          {/* Filter */}
          <div className={rowClass}>
            <button onClick={() => setFilter(deckId, { enabled: !deck.filter.enabled })} className={onOffBtn(deck.filter.enabled)}>
              {deck.filter.enabled ? 'ON' : 'OFF'}
            </button>
            <span className={`${labelClass} ${deck.filter.enabled ? accent : 'text-slate-600'}`}>{FX_LABEL.filter}</span>
            <button
              onClick={() => setFilter(deckId, { mode: deck.filter.mode === 'lpf' ? 'hpf' : 'lpf' })}
              className="text-[10px] font-bold font-mono w-9 shrink-0 rounded bg-slate-800 text-slate-400 hover:text-slate-200 py-1 transition-colors"
            >
              {deck.filter.mode.toUpperCase()}
            </button>
            <input type="range" min={0} max={1} step={0.01} value={deck.filter.param}
              onChange={(e) => setFilter(deckId, { param: parseFloat(e.target.value) })}
              className={sliderClass} title={PARAM_LABEL.filter} />
            <input type="range" min={0} max={1} step={0.01} value={deck.filter.wet}
              onChange={(e) => setFilter(deckId, { wet: parseFloat(e.target.value) })}
              className={sliderClass} title="WET" />
          </div>

          {/* Delay */}
          <div className={rowClass}>
            <button onClick={() => setDelay(deckId, { enabled: !deck.delay.enabled })} className={onOffBtn(deck.delay.enabled)}>
              {deck.delay.enabled ? 'ON' : 'OFF'}
            </button>
            <span className={`${labelClass} ${deck.delay.enabled ? accent : 'text-slate-600'}`}>{FX_LABEL.delay}</span>
            <div className="w-9 shrink-0" />
            <input type="range" min={0} max={1} step={0.01} value={deck.delay.param}
              onChange={(e) => setDelay(deckId, { param: parseFloat(e.target.value) })}
              className={sliderClass} title={PARAM_LABEL.delay} />
            <input type="range" min={0} max={1} step={0.01} value={deck.delay.wet}
              onChange={(e) => setDelay(deckId, { wet: parseFloat(e.target.value) })}
              className={sliderClass} title="WET" />
          </div>

          {/* Reverb */}
          <div className={rowClass}>
            <button onClick={() => setReverb(deckId, { enabled: !deck.reverb.enabled })} className={onOffBtn(deck.reverb.enabled)}>
              {deck.reverb.enabled ? 'ON' : 'OFF'}
            </button>
            <span className={`${labelClass} ${deck.reverb.enabled ? accent : 'text-slate-600'}`}>{FX_LABEL.reverb}</span>
            <div className="w-9 shrink-0" />
            <input type="range" min={0} max={1} step={0.01} value={deck.reverb.param}
              onChange={(e) => setReverb(deckId, { param: parseFloat(e.target.value) })}
              className={sliderClass} title={PARAM_LABEL.reverb} />
            <input type="range" min={0} max={1} step={0.01} value={deck.reverb.wet}
              onChange={(e) => setReverb(deckId, { wet: parseFloat(e.target.value) })}
              className={sliderClass} title="WET" />
          </div>

          {/* Flanger */}
          <div className={rowClass}>
            <button onClick={() => setFlanger(deckId, { enabled: !deck.flanger.enabled })} className={onOffBtn(deck.flanger.enabled)}>
              {deck.flanger.enabled ? 'ON' : 'OFF'}
            </button>
            <span className={`${labelClass} ${deck.flanger.enabled ? accent : 'text-slate-600'}`}>{FX_LABEL.flanger}</span>
            <div className="w-9 shrink-0" />
            <input type="range" min={0} max={1} step={0.01} value={deck.flanger.param}
              onChange={(e) => setFlanger(deckId, { param: parseFloat(e.target.value) })}
              className={sliderClass} title={PARAM_LABEL.flanger} />
            <input type="range" min={0} max={1} step={0.01} value={deck.flanger.wet}
              onChange={(e) => setFlanger(deckId, { wet: parseFloat(e.target.value) })}
              className={sliderClass} title="WET" />
          </div>

          {/* Slider labels */}
          <div className="flex text-[9px] text-slate-600 font-mono mt-0.5">
            <div className="w-10 shrink-0" />
            <div className="w-12 shrink-0" />
            <div className="w-9 shrink-0" />
            <div className="flex-1 text-center">PARAM</div>
            <div className="flex-1 text-center">WET</div>
          </div>
        </div>
      )}
    </div>
  )
}
