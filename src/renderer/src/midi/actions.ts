import { useDeckStore, type DeckId } from '../store/deckStore'
import { getAudioEngine, getDeckEngine } from '../hooks/useAudio'

export async function togglePlay(deckId: DeckId): Promise<void> {
  const deck = useDeckStore.getState().decks[deckId]
  if (!deck.track) return
  await getAudioEngine().resume()
  const engine = getDeckEngine(deckId)
  if (deck.isPlaying) {
    engine.pause()
    useDeckStore.getState().setPlaying(deckId, false)
  } else {
    engine.play()
    useDeckStore.getState().setPlaying(deckId, true)
  }
}
