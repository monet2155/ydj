import { useEffect } from 'react'
import { useMixerStore } from '../../store/mixerStore.js'
import { getMixerEngine } from '../../hooks/useAudio.js'

export default function MixerPanel(): JSX.Element {
  const { crossfader, masterVolume, setCrossfader, setMasterVolume } = useMixerStore()

  // Sync mixer store → MixerEngine
  useEffect(() => {
    getMixerEngine().setCrossfader(crossfader)
  }, [crossfader])

  useEffect(() => {
    getMixerEngine().setMasterVolume(masterVolume)
  }, [masterVolume])

  return (
    <div
      className="flex flex-col items-center w-44 shrink-0 bg-[#0a0d14] border-x border-slate-800 p-3 gap-4"
      data-testid="mixer-panel"
    >
      <div className="text-xs font-bold tracking-widest text-slate-600">MIXER</div>

      {/* Master volume */}
      <div className="flex flex-col items-center gap-2 w-full">
        <span className="text-xs text-slate-500">MASTER</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
          orient="vertical"
          className="h-20 accent-slate-400"
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
        />
        <span className="text-xs font-mono text-slate-500">
          {Math.round(masterVolume * 100)}%
        </span>
      </div>

      <div className="flex-1" />

      {/* Crossfader */}
      <div className="flex flex-col items-center gap-2 w-full">
        <div className="flex justify-between w-full text-xs">
          <span className="text-blue-400 font-bold">A</span>
          <span className="text-slate-500">XFADER</span>
          <span className="text-orange-400 font-bold">B</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={crossfader}
          onChange={(e) => setCrossfader(parseFloat(e.target.value))}
          className="w-full accent-slate-400"
        />
      </div>
    </div>
  )
}
