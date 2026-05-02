import { useMidiStore } from '../../store/midiStore'

interface Props {
  onClick?: () => void
}

export default function MidiStatus({ onClick }: Props): JSX.Element {
  const status = useMidiStore((s) => s.status)
  const devices = useMidiStore((s) => s.devices)
  const selectedId = useMidiStore((s) => s.selectedDeviceId)

  const selected = devices.find((d) => d.id === selectedId && d.state === 'connected')

  let label: string
  let dotColor: string
  if (status === 'unsupported' || status === 'denied') {
    label = 'MIDI: off'
    dotColor = '#475569'
  } else if (status !== 'granted') {
    label = 'MIDI: …'
    dotColor = '#475569'
  } else if (!selected) {
    label = 'MIDI: —'
    dotColor = '#475569'
  } else {
    label = `MIDI: ${selected.name}`
    dotColor = '#22c55e'
  }

  return (
    <button
      onClick={onClick}
      title="Open MIDI Learn"
      className="flex items-center gap-1.5 text-[10px] tracking-[0.15em] text-slate-500 hover:text-slate-300 transition-colors"
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: dotColor }}
      />
      <span>{label}</span>
    </button>
  )
}
