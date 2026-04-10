import { useEffect, useRef, useState } from 'react'
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
  const fetchTracks = useLibraryStore((s) => s.fetchTracks)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [progress, setProgress] = useState<number | null>(null) // null = idle
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef(url)
  urlRef.current = url

  // Subscribe to download progress for 'library' deckId
  useEffect(() => {
    const unsub = window.electronAPI.youtube.onProgress((id, percent) => {
      if (id === 'library') setProgress(percent)
    })
    return unsub
  }, [])

  const handleDownload = async (): Promise<void> => {
    const target = urlRef.current.trim()
    if (!target || progress !== null) return
    setError(null)
    setProgress(0)
    try {
      const result = await window.electronAPI.youtube.download(target, 'library' as DeckId)
      if (result.success) {
        setUrl('')
        await fetchTracks()
      } else {
        setError(result.error)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setProgress(null)
    }
  }

  const isDownloading = progress !== null

  return (
    <div className="flex flex-col h-full">
      {/* URL input bar */}
      <div className="shrink-0 px-3 py-2 border-b border-slate-800 flex flex-col gap-1.5">
        <div className="flex gap-2 items-center">
          <span className="text-xs font-bold tracking-widest text-slate-500 shrink-0">LIBRARY</span>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
            placeholder="YouTube URL 붙여넣기 → 라이브러리에 추가"
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500"
          />
          <button
            onClick={handleDownload}
            disabled={isDownloading || !url.trim()}
            className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs font-mono disabled:opacity-50 shrink-0"
          >
            {isDownloading ? `${Math.round(progress!)}%` : 'ADD'}
          </button>
          <span className="text-xs text-slate-700 shrink-0">{tracks.length} tracks</span>
        </div>

        {/* Progress / error */}
        {isDownloading && (
          <div className="h-0.5 bg-slate-800 rounded overflow-hidden">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p className="text-red-400 text-xs truncate">{error}</p>}
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-700 text-xs">
            URL을 입력해서 트랙을 추가하세요
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0a0d14] text-slate-600">
              <tr>
                <th className="text-left px-3 py-1 font-normal">제목</th>
                <th className="text-right px-3 py-1 font-normal w-14">길이</th>
                <th className="w-24 px-3 py-1" />
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
                    <td className="px-3 py-1.5 max-w-0 w-full">
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
                            className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold"
                          >
                            A
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onLoad(track.filePath, track, 'B') }}
                            className="px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold"
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
