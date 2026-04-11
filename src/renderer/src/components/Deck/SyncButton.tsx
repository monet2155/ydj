import { getDeckEngine } from '../../hooks/useAudio.js'
import { useDeckStore, type DeckId } from '../../store/deckStore.js'

interface SyncButtonProps {
  deckId: DeckId
}

export default function SyncButton({ deckId }: SyncButtonProps): JSX.Element {
  const masterId: DeckId = deckId === 'A' ? 'B' : 'A'

  const thisDeck = useDeckStore((s) => s.decks[deckId])
  const masterDeck = useDeckStore((s) => s.decks[masterId])
  const { setPlaybackRate } = useDeckStore()

  const canSync = !!(thisDeck.bpm && masterDeck.bpm)

  const handleSync = (): void => {
    if (!thisDeck.bpm || !masterDeck.bpm) return
    const masterEffectiveBpm = masterDeck.bpm * masterDeck.playbackRate
    const newRate = masterEffectiveBpm / thisDeck.bpm
    getDeckEngine(deckId).playbackRate = newRate
    setPlaybackRate(deckId, newRate)
  }

  return (
    <button
      onClick={handleSync}
      disabled={!canSync}
      title={canSync ? `Sync to Deck ${masterId} BPM` : 'Load tracks on both decks first'}
      className="px-3 py-1 rounded text-xs font-mono font-bold transition-colors disabled:opacity-30"
      style={{
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.25)',
        color: '#fbbf24',
      }}
    >
      SYNC
    </button>
  )
}
