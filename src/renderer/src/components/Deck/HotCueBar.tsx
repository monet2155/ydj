import { useDeckStore, type DeckId } from '../../store/deckStore.js'
import { getDeckEngine } from '../../hooks/useAudio.js'

const CUE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'
]

interface HotCueBarProps {
  deckId: DeckId
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function HotCueBar({ deckId }: HotCueBarProps): JSX.Element {
  const deck = useDeckStore((s) => s.decks[deckId])
  const { setHotCue, setPosition, setPlaying } = useDeckStore()
  const videoId = deck.track?.videoId

  const handleSet = (i: number): void => {
    if (!deck.track || !videoId) return
    const pos = deck.position
    const slots = [...deck.hotCues]
    slots[i] = pos
    setHotCue(deckId, i, pos)
    window.electronAPI.hotcues.save(videoId, slots)
  }

  const handleJump = (i: number): void => {
    const pos = deck.hotCues[i]
    if (pos === null) return
    getDeckEngine(deckId).seek(pos)
    setPosition(deckId, pos)
    if (!deck.isPlaying) {
      getDeckEngine(deckId).play()
      setPlaying(deckId, true)
    }
  }

  const handleDelete = (e: React.MouseEvent, i: number): void => {
    e.preventDefault()
    if (!videoId) return
    const slots = [...deck.hotCues]
    slots[i] = null
    setHotCue(deckId, i, null)
    window.electronAPI.hotcues.save(videoId, slots)
  }

  return (
    <div className="grid grid-cols-4 gap-1">
      {deck.hotCues.map((pos, i) => {
        const color = CUE_COLORS[i]
        const isSet = pos !== null
        return (
          <button
            key={i}
            onClick={() => isSet ? handleJump(i) : handleSet(i)}
            onContextMenu={(e) => handleDelete(e, i)}
            disabled={!deck.track}
            className="flex flex-col items-center justify-center rounded py-1 text-xs font-bold disabled:opacity-30 transition-colors"
            style={{
              backgroundColor: isSet ? `${color}33` : '#1e293b',
              border: `1px solid ${isSet ? color : '#2d3748'}`,
              color: isSet ? color : '#475569',
              minHeight: 34
            }}
            title={isSet ? `HOT CUE ${i + 1}: ${formatTime(pos)} (우클릭: 삭제)` : `HOT CUE ${i + 1} — 클릭해서 현재 위치 저장`}
          >
            {isSet ? (
              <>
                <span>{i + 1}</span>
                <span style={{ fontSize: 10, opacity: 0.8 }}>{formatTime(pos)}</span>
              </>
            ) : (
              <span className="text-slate-600 text-sm leading-none">+</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
