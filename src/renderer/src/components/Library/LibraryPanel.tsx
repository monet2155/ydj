import { useState } from 'react'
import { useLibraryStore } from '../../store/libraryStore.js'
import type { DeckId } from '../../store/deckStore.js'

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface LibraryPanelProps {
  onLoad: (filePath: string, meta: { title: string; duration: number; videoId: string }, deckId: DeckId) => void
}

export default function LibraryPanel({ onLoad }: LibraryPanelProps): JSX.Element {
  const tracks = useLibraryStore((s) => s.tracks)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 shrink-0">
        <span className="text-xs font-bold tracking-widest text-slate-500">LIBRARY</span>
        <span className="text-xs text-slate-700">{tracks.length} tracks</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-700 text-xs">
            트랙 없음 — URL을 덱에 로드하면 여기에 쌓입니다
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0a0d14] text-slate-600">
              <tr>
                <th className="text-left px-3 py-1 font-normal">제목</th>
                <th className="text-right px-3 py-1 font-normal w-14">길이</th>
                <th className="w-32 px-3 py-1" />
              </tr>
            </thead>
            <tbody>
              {tracks.map((track) => {
                const isSelected = selectedId === track.videoId
                return (
                  <tr
                    key={track.videoId}
                    onClick={() => setSelectedId(isSelected ? null : track.videoId)}
                    className={[
                      'cursor-pointer border-b border-slate-800/50',
                      isSelected ? 'bg-slate-800' : 'hover:bg-slate-900'
                    ].join(' ')}
                  >
                    <td className="px-3 py-1.5 truncate max-w-0 w-full">
                      <span className="truncate block">{track.title}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-500 font-mono tabular-nums whitespace-nowrap">
                      {formatTime(track.duration)}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {isSelected && (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); onLoad(track.filePath, track, 'A') }}
                            className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                          >
                            A
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onLoad(track.filePath, track, 'B') }}
                            className="px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold"
                          >
                            B
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
