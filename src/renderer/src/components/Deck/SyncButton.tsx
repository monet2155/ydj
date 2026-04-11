import { getDeckEngine } from '../../hooks/useAudio.js'
import { useDeckStore, type DeckId } from '../../store/deckStore.js'

interface SyncButtonProps {
  deckId: DeckId
}

export default function SyncButton({ deckId }: SyncButtonProps): JSX.Element {
  const isA = deckId === 'A'
  const masterId: DeckId = isA ? 'B' : 'A'

  const thisDeck = useDeckStore((s) => s.decks[deckId])
  const masterDeck = useDeckStore((s) => s.decks[masterId])
  const { setPlaybackRate } = useDeckStore()

  const canSync = !!(thisDeck.bpm && masterDeck.bpm)

  const handleSync = (): void => {
    if (!thisDeck.bpm || !masterDeck.bpm) return

    // Master's current effective BPM
    const masterEffectiveBpm = masterDeck.bpm * masterDeck.playbackRate
    // Required playbackRate to match
    const newRate = masterEffectiveBpm / thisDeck.bpm

    getDeckEngine(deckId).playbackRate = newRate
    setPlaybackRate(deckId, newRate)
  }

  return (
    <button
      onClick={handleSync}
      disabled={!canSync}
      title={canSync ? `Sync to Deck ${masterId} BPM` : 'Load tracks on both decks first'}
      className={[
        'px-3 py-1 rounded text-xs font-mono font-bold transition-colors disabled:opacity-30',
        isA
          ? 'bg-blue-900 hover:bg-blue-800 text-blue-300 border border-blue-700'
          : 'bg-orange-900 hover:bg-orange-800 text-orange-300 border border-orange-700'
      ].join(' ')}
    >
      SYNC
    </button>
  )
}
