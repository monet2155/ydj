import { useEffect, useState, useCallback } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastEntry {
  id: number
  message: string
  action?: ToastAction
  kind: 'info' | 'warn'
}

let nextId = 1
let push: ((entry: Omit<ToastEntry, 'id'>) => void) | null = null

export function showToast(message: string, opts: { action?: ToastAction; kind?: 'info' | 'warn' } = {}): void {
  push?.({ message, action: opts.action, kind: opts.kind ?? 'info' })
}

export default function ToastContainer(): JSX.Element {
  const [entries, setEntries] = useState<ToastEntry[]>([])

  const dismiss = useCallback((id: number) => {
    setEntries((es) => es.filter((e) => e.id !== id))
  }, [])

  useEffect(() => {
    push = (entry) => {
      const id = nextId++
      setEntries((es) => [...es, { ...entry, id }])
      setTimeout(() => dismiss(id), 6000)
    }
    return () => { push = null }
  }, [dismiss])

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {entries.map((e) => (
        <div
          key={e.id}
          className="pointer-events-auto bg-[#0d1018] border border-white/10 rounded shadow-lg px-3 py-2 flex items-center gap-3 text-[11px] text-slate-200"
          style={{ borderLeftColor: e.kind === 'warn' ? '#f59e0b' : '#22c55e', borderLeftWidth: 3 }}
        >
          <span className="flex-1">{e.message}</span>
          {e.action && (
            <button
              onClick={() => { e.action!.onClick(); dismiss(e.id) }}
              className="text-emerald-400 hover:text-emerald-300 font-bold"
            >
              {e.action.label}
            </button>
          )}
          <button onClick={() => dismiss(e.id)} className="text-slate-500 hover:text-slate-300">×</button>
        </div>
      ))}
    </div>
  )
}
