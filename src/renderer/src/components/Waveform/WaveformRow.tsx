import { useAudioBuffers } from '../../store/audioBufferStore.js'
import { useDeckStore } from '../../store/deckStore.js'
import { getDeckEngine } from '../../hooks/useAudio.js'
import { useDeckScratch } from '../../hooks/useDeckScratch.js'
import WaveformCanvas from './WaveformCanvas.js'

export default function WaveformRow(): JSX.Element {
  const buffers = useAudioBuffers()
  const deckA = useDeckStore((s) => s.decks['A'])
  const deckB = useDeckStore((s) => s.decks['B'])
  const { setPosition } = useDeckStore()

  const scratchA = useDeckScratch('A')
  const scratchB = useDeckScratch('B')

  return (
    <div className="flex shrink-0 border-b border-slate-800" style={{ height: 110 }}>
      {/* Deck A waveform */}
      <div className="flex-1 border-r border-slate-800 bg-slate-950 overflow-hidden">
        <WaveformCanvas
          audioBuffer={buffers['A'] ?? null}
          position={deckA.position}
          duration={deckA.track?.duration ?? 0}
          color="#3b82f6"
          hotCues={deckA.hotCues}
          loop={deckA.loop}
          onSeek={(sec) => { getDeckEngine('A').seek(sec); setPosition('A', sec) }}
          onDragStart={scratchA.onScratchStart}
          onScratch={scratchA.onScratch}
          onDragEnd={scratchA.onScratchEnd}
        />
      </div>
      {/* Deck B waveform */}
      <div className="flex-1 bg-slate-950 overflow-hidden">
        <WaveformCanvas
          audioBuffer={buffers['B'] ?? null}
          position={deckB.position}
          duration={deckB.track?.duration ?? 0}
          color="#f97316"
          hotCues={deckB.hotCues}
          loop={deckB.loop}
          onSeek={(sec) => { getDeckEngine('B').seek(sec); setPosition('B', sec) }}
          onDragStart={scratchB.onScratchStart}
          onScratch={scratchB.onScratch}
          onDragEnd={scratchB.onScratchEnd}
        />
      </div>
    </div>
  )
}
