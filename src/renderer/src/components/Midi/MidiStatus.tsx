import { useMidiStore } from '../../store/midiStore'

export default function MidiStatus(): JSX.Element {
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
    <div className="flex items-center gap-1.5 text-[10px] tracking-[0.15em] text-slate-500">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: dotColor }}
      />
      <span>{label}</span>
    </div>
  )
}
