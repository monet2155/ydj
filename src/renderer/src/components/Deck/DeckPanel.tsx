interface DeckPanelProps {
  deckId: 'A' | 'B'
}

export default function DeckPanel({ deckId }: DeckPanelProps): JSX.Element {
  const isA = deckId === 'A'

  return (
    <div
      className={[
        'flex flex-col flex-1 p-4 gap-3',
        isA ? 'bg-[#0f1520]' : 'bg-[#15100f]'
      ].join(' ')}
      data-testid={`deck-${deckId}`}
    >
      {/* Deck label */}
      <div className={[
        'text-2xl font-black tracking-widest',
        isA ? 'text-blue-400' : 'text-orange-400'
      ].join(' ')}>
        DECK {deckId}
      </div>

      {/* Track info placeholder */}
      <div className="h-16 rounded-lg bg-slate-900 border border-slate-800 flex items-center px-3">
        <span className="text-slate-600 text-sm">YouTube URL을 붙여넣으세요</span>
      </div>

      {/* Waveform placeholder */}
      <div className="flex-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center min-h-[80px]">
        <span className="text-slate-700 text-xs">WAVEFORM</span>
      </div>

      {/* Transport controls placeholder */}
      <div className="flex gap-2 justify-center">
        <button className="px-4 py-2 rounded bg-slate-800 text-slate-400 text-sm font-mono">
          CUE
        </button>
        <button className={[
          'px-6 py-2 rounded font-mono font-bold text-sm',
          isA ? 'bg-blue-700 hover:bg-blue-600' : 'bg-orange-700 hover:bg-orange-600'
        ].join(' ')}>
          PLAY
        </button>
      </div>

      {/* BPM + Pitch placeholder */}
      <div className="flex items-center justify-between px-2">
        <div className="text-xs text-slate-600">BPM —</div>
        <div className="text-xs text-slate-600">PITCH 0.0%</div>
      </div>
    </div>
  )
}
