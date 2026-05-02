import { useEffect, useMemo, useRef, useState } from 'react'
import { midiManager } from '../../midi/MidiManager'
import { useMidiStore } from '../../store/midiStore'
import {
  MEASUREMENT_ITEMS,
  STATUS_NAMES,
  inferPattern,
  type CapturedBinding,
  type MeasurementItem
} from './measurementItems'

interface Props {
  onClose: () => void
}

const STORAGE_KEY = 'ydj.midiMeasurement.v1'

type StoredCaptured = Omit<CapturedBinding, 'samples'> & { samples: number[][] }

function loadStored(): Record<string, CapturedBinding> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, StoredCaptured>
    const out: Record<string, CapturedBinding> = {}
    for (const [k, v] of Object.entries(parsed)) {
      out[k] = { ...v, samples: v.samples.map((s) => Uint8Array.from(s)) }
    }
    return out
  } catch {
    return {}
  }
}

function saveStored(state: Record<string, CapturedBinding>): void {
  const serializable: Record<string, StoredCaptured> = {}
  for (const [k, v] of Object.entries(state)) {
    serializable[k] = { ...v, samples: v.samples.map((s) => Array.from(s)) }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
}

export default function MidiLearnPanel({ onClose }: Props): JSX.Element {
  const devices = useMidiStore((s) => s.devices)
  const selectedId = useMidiStore((s) => s.selectedDeviceId)
  const selectedDevice = devices.find((d) => d.id === selectedId)

  const [captured, setCaptured] = useState<Record<string, CapturedBinding>>(() => loadStored())
  const [listeningKey, setListeningKey] = useState<string | null>(null)
  const listeningKeyRef = useRef<string | null>(null)
  listeningKeyRef.current = listeningKey

  // Persist on every update
  useEffect(() => { saveStored(captured) }, [captured])

  // Subscribe to MIDI while panel is open
  useEffect(() => {
    const unsub = midiManager.subscribe((data) => {
      const key = listeningKeyRef.current
      if (!key) return
      const status = data[0] ?? 0
      const type = status & 0xf0
      // Ignore NoteOff/NoteOn vel=0 for the *first* capture (we want the trigger),
      // but include them in samples to help pattern inference for momentary buttons.
      setCaptured((prev) => {
        const existing = prev[key]
        // Same first message (initial capture) — replace; subsequent messages append as samples
        if (!existing) {
          // Skip pure releases as initial capture for buttons (NoteOff or NoteOn vel=0)
          if (type === 0x80) return prev
          if (type === 0x90 && (data[2] ?? 0) === 0) return prev
          return {
            ...prev,
            [key]: {
              status,
              type,
              channel: status & 0x0f,
              data1: data[1] ?? 0,
              samples: [Uint8Array.from(data)]
            }
          }
        }
        // Append sample (cap at 8) — used for pattern inference
        const samples = [...existing.samples, Uint8Array.from(data)].slice(-8)
        return { ...prev, [key]: { ...existing, samples } }
      })
    })
    return unsub
  }, [])

  // Auto-stop listening after 1.5s of inactivity OR on first capture for non-CC items
  useEffect(() => {
    if (!listeningKey) return
    const timer = setTimeout(() => setListeningKey(null), 4000)
    return () => clearTimeout(timer)
  }, [listeningKey, captured])

  const groups = useMemo(() => {
    const map = new Map<string, MeasurementItem[]>()
    for (const item of MEASUREMENT_ITEMS) {
      const arr = map.get(item.group) ?? []
      arr.push(item)
      map.set(item.group, arr)
    }
    return Array.from(map.entries())
  }, [])

  const total = MEASUREMENT_ITEMS.length
  const done = Object.keys(captured).length

  const handleListen = (key: string): void => {
    setListeningKey(key)
  }

  const handleClear = (key: string): void => {
    setCaptured((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handleClearAll = (): void => {
    if (confirm('모든 측정값을 삭제하시겠습니까?')) {
      setCaptured({})
    }
  }

  const exportMarkdown = (): string => {
    const lines: string[] = []
    lines.push(`# Numark Party Mix MKII — measurement (${done}/${total})\n`)
    for (const [group, items] of groups) {
      lines.push(`## ${group}\n`)
      lines.push('| key | status | ch | d1 | pattern |')
      lines.push('|-----|--------|----|----|---------|')
      for (const item of items) {
        const c = captured[item.key]
        if (c) {
          const name = STATUS_NAMES[c.type] ?? `0x${c.type.toString(16)}`
          lines.push(`| ${item.key} | ${name} (0x${c.type.toString(16)}) | ${c.channel} | 0x${c.data1.toString(16).padStart(2, '0')} (${c.data1}) | ${inferPattern(c.samples)} |`)
        } else {
          lines.push(`| ${item.key} | — | — | — | — |`)
        }
      }
      lines.push('')
    }
    return lines.join('\n')
  }

  const exportTs = (): string => {
    const lines: string[] = []
    lines.push("// Auto-generated from MidiLearnPanel. Edit by hand if needed.")
    lines.push("import type { Preset } from '../types'  // TODO: define Preset/MidiBinding types in 4단계\n")
    lines.push("export const partyMix2Preset: Preset = {")
    lines.push("  name: 'Numark Party Mix MKII',")
    lines.push("  bindings: {")
    for (const item of MEASUREMENT_ITEMS) {
      const c = captured[item.key]
      if (!c) continue
      lines.push(`    '${item.key}': { status: 0x${c.type.toString(16)}, channel: ${c.channel}, data1: 0x${c.data1.toString(16).padStart(2, '0')} }, // ${item.label}`)
    }
    lines.push("  }")
    lines.push("}")
    return lines.join('\n')
  }

  const [showExport, setShowExport] = useState<{ kind: 'md' | 'ts'; text: string } | null>(null)

  const handleCopy = async (text: string, kind: 'md' | 'ts'): Promise<void> => {
    // Electron preload 경유 (renderer의 navigator.clipboard는 종종 차단됨)
    const electronClipboard = (window as unknown as {
      electronAPI?: { clipboard?: { writeText: (t: string) => void } }
    }).electronAPI?.clipboard
    if (electronClipboard) {
      try {
        electronClipboard.writeText(text)
        return
      } catch { /* fall through */ }
    }
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch { /* fall through */ }
    // Last resort: show textarea so user can ⌘C
    setShowExport({ kind, text })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#0d1018] border border-white/10 rounded-lg shadow-2xl w-[760px] max-h-[85vh] flex flex-col text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between h-10 px-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-black tracking-[0.3em] text-slate-300">MIDI LEARN</span>
            <span className="text-[10px] text-slate-500">
              {selectedDevice?.name ?? 'no device'} · {done}/{total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleCopy(exportMarkdown(), 'md')}
              className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded"
            >
              Copy MD
            </button>
            <button
              onClick={() => void handleCopy(exportTs(), 'ts')}
              className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded"
            >
              Copy TS
            </button>
            <button
              onClick={() => setShowExport({ kind: 'md', text: exportMarkdown() })}
              className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded"
              title="Show as text (manual copy)"
            >
              Show
            </button>
            <button
              onClick={handleClearAll}
              className="text-[10px] px-2 py-1 text-red-300 hover:bg-red-900/40 rounded"
            >
              Clear
            </button>
            <button
              onClick={onClose}
              className="text-[14px] text-slate-500 hover:text-slate-200 px-2"
            >
              ×
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3">
          {groups.map(([group, items]) => (
            <div key={group} className="mb-4">
              <div className="text-[9px] font-black tracking-[0.25em] text-slate-500 mb-1.5 px-1">
                {group.toUpperCase()}
              </div>
              <div className="space-y-1">
                {items.map((item) => {
                  const c = captured[item.key]
                  const isListening = listeningKey === item.key
                  const statusName = c ? (STATUS_NAMES[c.type] ?? `0x${c.type.toString(16)}`) : null
                  return (
                    <div
                      key={item.key}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] ${
                        isListening ? 'bg-blue-900/40 border border-blue-500/50' : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="w-44 text-slate-300">{item.label}</div>
                      <div className="w-32 text-slate-500 text-[10px]">{item.key}</div>
                      <div className="flex-1 text-[10px] font-mono">
                        {isListening ? (
                          <span className="text-blue-300">listening… {c ? `· got ${c.samples.length}` : ''}</span>
                        ) : c ? (
                          <span className="text-emerald-400">
                            {statusName} ch={c.channel} d1=0x{c.data1.toString(16).padStart(2, '0')} ({c.data1})
                            <span className="text-slate-500 ml-2">[{inferPattern(c.samples)}]</span>
                          </span>
                        ) : (
                          <span className="text-slate-600">{item.hint ?? '—'}</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleListen(item.key)}
                        className={`text-[10px] px-2 py-0.5 rounded ${
                          isListening ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {isListening ? 'stop' : c ? 're-learn' : 'learn'}
                      </button>
                      {c && (
                        <button
                          onClick={() => handleClear(item.key)}
                          className="text-[10px] px-1.5 py-0.5 text-slate-500 hover:text-red-300"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-[10px] text-slate-500 px-4 py-2 border-t border-white/5 shrink-0">
          Tip: 'learn' → 컨트롤러 조작 → 4초 후 자동 종료. Faders/jog는 listening 동안 여러 샘플을 모아 pattern을 추정합니다.
        </div>

        {showExport && (
          <div
            className="absolute inset-0 bg-black/70 flex items-center justify-center p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget) setShowExport(null) }}
          >
            <div className="bg-[#0d1018] border border-white/10 rounded w-full max-w-[700px] max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                <span className="text-[10px] tracking-[0.2em] text-slate-400">
                  EXPORT · {showExport.kind.toUpperCase()} · select all + ⌘C
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowExport({
                        kind: showExport.kind === 'md' ? 'ts' : 'md',
                        text: showExport.kind === 'md' ? exportTs() : exportMarkdown()
                      })
                    }}
                    className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded"
                  >
                    Switch to {showExport.kind === 'md' ? 'TS' : 'MD'}
                  </button>
                  <button
                    onClick={() => setShowExport(null)}
                    className="text-[14px] text-slate-500 hover:text-slate-200 px-2"
                  >×</button>
                </div>
              </div>
              <textarea
                readOnly
                value={showExport.text}
                onFocus={(e) => e.currentTarget.select()}
                autoFocus
                className="flex-1 bg-[#06080d] text-slate-300 font-mono text-[11px] p-3 resize-none outline-none"
                style={{ minHeight: '50vh' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
