import { useDeckStore, type DeckId } from '../../store/deckStore.js'
import { getDeckEngine } from '../../hooks/useAudio.js'

const AUTO_LOOP_BEATS = [1/4, 1/2, 1, 2, 4, 8] as const

interface LoopControlProps {
  deckId: DeckId
}

export default function LoopControl({ deckId }: LoopControlProps): JSX.Element {
  const deck = useDeckStore((s) => s.decks[deckId])
  const { setLoop } = useDeckStore()
  const isA = deckId === 'A'
  const color = isA ? 'bg-blue-600 hover:bg-blue-500' : 'bg-orange-600 hover:bg-orange-500'
  const activeColor = isA ? 'bg-blue-500 ring-2 ring-blue-300' : 'bg-orange-500 ring-2 ring-orange-300'

  const bpm = deck.bpm

  const activateAutoLoop = (beats: number): void => {
    if (!deck.track || bpm === null) return
    const secPerBeat = 60 / bpm
    const loopLen = beats * secPerBeat
    const start = deck.position
    const end = Math.min(start + loopLen, deck.track.duration)
    getDeckEngine(deckId).activateLoop(start, end)
    setLoop(deckId, { active: true, start, end })
  }

  const toggleLoop = (): void => {
    const engine = getDeckEngine(deckId)
    if (deck.loop.active) {
      engine.deactivateLoop()
      setLoop(deckId, { ...deck.loop, active: false })
    } else if (deck.loop.start !== null && deck.loop.end !== null) {
      engine.activateLoop(deck.loop.start, deck.loop.end)
      setLoop(deckId, { ...deck.loop, active: true })
    }
  }

  const formatBeats = (b: number): string =>
    b < 1 ? `1/${Math.round(1 / b)}` : `${b}`

  return (
    <div className="flex flex-col gap-1">
      {/* Auto loop buttons */}
      <div className="flex gap-0.5">
        {AUTO_LOOP_BEATS.map((beats) => (
          <button
            key={beats}
            onClick={() => activateAutoLoop(beats)}
            disabled={!deck.track || deck.bpm === null}
            className={[
              'flex-1 py-1 rounded text-[9px] font-bold font-mono disabled:opacity-30',
              deck.loop.active ? color : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
            ].join(' ')}
          >
            {formatBeats(beats)}
          </button>
        ))}
      </div>

      {/* Loop toggle */}
      {deck.loop.start !== null && (
        <button
          onClick={toggleLoop}
          className={[
            'w-full py-1 rounded text-[10px] font-bold font-mono',
            deck.loop.active ? activeColor + ' text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'
          ].join(' ')}
        >
          {deck.loop.active ? '⟳ LOOP ON' : '⟳ LOOP OFF'}
        </button>
      )}
    </div>
  )
}
