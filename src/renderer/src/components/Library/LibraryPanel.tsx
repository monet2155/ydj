import { useEffect, useRef, useState } from 'react'
import { useLibraryStore } from '../../store/libraryStore.js'
import { useQueueStore } from '../../store/queueStore.js'
import type { DeckId } from '../../store/deckStore.js'
import type { LibraryTrack, SearchResult } from '../../../../preload/index.js'

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
  const { queues, enqueue, remove } = useQueueStore()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showQueue, setShowQueue] = useState(false)
  const inputRef = useRef(input)
  inputRef.current = input

  useEffect(() => {
    const unsub = window.electronAPI.youtube.onProgress((id, percent) => {
      if (id === 'library') setProgress(percent)
    })
    return unsub
  }, [])

  const isUrl = (s: string): boolean => s.startsWith('http://') || s.startsWith('https://')

  const handleDownload = async (url: string): Promise<void> => {
    if (!url.trim() || progress !== null) return
    setError(null)
    setProgress(0)
    setSearchResults([])
    try {
      const result = await window.electronAPI.youtube.download(url, 'library' as DeckId)
      if (result.success) {
        setInput('')
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

  const handleSearch = async (): Promise<void> => {
    const q = inputRef.current.trim()
    if (!q || searching) return
    setError(null)
    setSearchResults([])
    setSearching(true)
    try {
      const results = await window.electronAPI.youtube.search(q)
      setSearchResults(results)
      if (results.length === 0) setError('검색 결과가 없습니다.')
    } catch (e) {
      setError(String(e))
    } finally {
      setSearching(false)
    }
  }

  const handleSubmit = (): void => {
    const val = inputRef.current.trim()
    if (!val) return
    if (isUrl(val)) handleDownload(val)
    else handleSearch()
  }

  const isDownloading = progress !== null
  const totalQueued = queues.A.length + queues.B.length

  return (
    <div className="flex flex-col h-full">
      {/* Input bar */}
      <div className="shrink-0 px-3 py-2 border-b border-slate-800 flex flex-col gap-1.5">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setSearchResults([]) }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="YouTube URL 또는 검색어"
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500"
          />
          <button
            onClick={handleSubmit}
            disabled={isDownloading || searching || !input.trim()}
            className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs font-mono disabled:opacity-50 shrink-0"
          >
            {isDownloading ? `${Math.round(progress!)}%` : searching ? '...' : isUrl(input) ? 'ADD' : '검색'}
          </button>
          {totalQueued > 0 && (
            <button
              onClick={() => setShowQueue((v) => !v)}
              className={[
                'px-2 py-1 rounded text-xs font-mono shrink-0',
                showQueue ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              ].join(' ')}
            >
              QUEUE {totalQueued}
            </button>
          )}
          <span className="text-xs text-slate-700 shrink-0">{tracks.length} tracks</span>
        </div>

        {isDownloading && (
          <div className="h-0.5 bg-slate-800 rounded overflow-hidden">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p className="text-red-400 text-xs truncate">{error}</p>}
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="shrink-0 border-b border-slate-800 bg-slate-950">
          <div className="px-3 py-1 text-[10px] text-slate-600 font-bold tracking-widest">검색 결과</div>
          {searchResults.map((r) => (
            <div
              key={r.videoId}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-900 border-b border-slate-800/50"
            >
              <span className="flex-1 text-xs text-slate-300 truncate">{r.title}</span>
              <span className="text-xs font-mono text-slate-600 shrink-0">{formatTime(r.duration)}</span>
              <button
                onClick={() => handleDownload(`https://www.youtube.com/watch?v=${r.videoId}`)}
                disabled={isDownloading}
                className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[10px] font-mono shrink-0 disabled:opacity-40"
              >
                + ADD
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Queue panel */}
      {showQueue && (
        <div className="shrink-0 border-b border-slate-800 bg-slate-950">
          {(['A', 'B'] as DeckId[]).map((deckId) => {
            const q = queues[deckId]
            if (q.length === 0) return null
            const color = deckId === 'A' ? 'text-blue-400' : 'text-orange-400'
            return (
              <div key={deckId}>
                <div className={`px-3 py-1 text-[10px] font-bold tracking-widest ${color}`}>
                  QUEUE {deckId} ({q.length})
                </div>
                {q.map((track, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1 hover:bg-slate-900 border-b border-slate-800/30">
                    <span className="text-[10px] text-slate-600 w-4 shrink-0">{i + 1}</span>
                    <span className="flex-1 text-xs text-slate-400 truncate">{track.title}</span>
                    <button
                      onClick={() => remove(deckId, i)}
                      className="text-[10px] text-slate-600 hover:text-red-400 shrink-0 px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Track list */}
      <div className="flex-1 overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-700 text-xs">
            URL 또는 검색어를 입력해서 트랙을 추가하세요
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
                          >A</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onLoad(track.filePath, track, 'B') }}
                            className="px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold"
                          >B</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); enqueue('A', track) }}
                            className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-blue-800 text-blue-300 font-bold text-[10px]"
                            title="Deck A 큐에 추가"
                          >+A</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); enqueue('B', track) }}
                            className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-orange-800 text-orange-300 font-bold text-[10px]"
                            title="Deck B 큐에 추가"
                          >+B</button>
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
