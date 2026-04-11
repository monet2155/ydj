import { getDeckEngine } from '../../hooks/useAudio.js'
import { useDeckStore, type DeckId } from '../../store/deckStore.js'

interface PitchControlProps {
  deckId: DeckId
}

export default function PitchControl({ deckId }: PitchControlProps): JSX.Element {
  const isA = deckId === 'A'
  const deck = useDeckStore((s) => s.decks[deckId])
  const { setPlaybackRate } = useDeckStore()

  const pitchPercent = (deck.playbackRate - 1) * 100
  const currentBpm = deck.bpm ? deck.bpm * deck.playbackRate : null

  const handlePitchChange = (percent: number): void => {
    const rate = 1 + percent / 100
    getDeckEngine(deckId).playbackRate = rate
    setPlaybackRate(deckId, rate)
  }

  const handleReset = (): void => handlePitchChange(0)

  return (
    <div className="flex flex-col gap-2 px-1">
      {/* BPM display */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-500">BPM</span>
        <span className={`text-lg font-mono font-bold ${isA ? 'text-amber-400' : 'text-amber-500'}`}>
          {currentBpm ? currentBpm.toFixed(1) : '—'}
        </span>
      </div>

      {/* Pitch slider */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-600 w-6">-10</span>
        <input
          type="range"
          min={-10}
          max={10}
          step={0.1}
          value={pitchPercent}
          onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
          className={`flex-1 ${isA ? 'accent-amber-400' : 'accent-amber-500'}`}
        />
        <span className="text-xs text-slate-600 w-6">+10</span>
      </div>

      {/* Pitch value + reset */}
      <div className="flex justify-between items-center">
        <span className="text-xs font-mono text-slate-400">
          {pitchPercent >= 0 ? '+' : ''}{pitchPercent.toFixed(1)}%
        </span>
        <button
          onClick={handleReset}
          className="text-xs px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 font-mono"
        >
          RESET
        </button>
      </div>
    </div>
  )
}
