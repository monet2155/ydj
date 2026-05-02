import { useMidiStore } from '../store/midiStore'
import type { MidiDevice } from './types'
import { togglePlay } from './actions'

const STATUS_NAME: Record<number, string> = {
  0x80: 'NoteOff',
  0x90: 'NoteOn',
  0xa0: 'Aftertouch',
  0xb0: 'CC',
  0xc0: 'Program',
  0xd0: 'ChanPress',
  0xe0: 'PitchBend'
}

function formatMessage(deviceName: string, data: Uint8Array): string {
  const statusByte = data[0] ?? 0
  const type = statusByte & 0xf0
  const channel = statusByte & 0x0f
  const name = STATUS_NAME[type] ?? `0x${type.toString(16)}`
  const d1 = data[1] ?? 0
  const d2 = data[2] ?? 0
  const hex = Array.from(data).map((b) => b.toString(16).padStart(2, '0')).join(' ')
  return `[MIDI ${deviceName}] ${name} ch=${channel} d1=${d1} d2=${d2}  raw=${hex}`
}

class MidiManager {
  private access: MIDIAccess | null = null
  private initialized = false
  private boundInputs = new Set<string>()
  // 개발 중 raw 메시지 콘솔 덤프. 2단계 측정 끝나면 false로 바꾸거나 토글로 노출.
  public debugLog = true

  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    const store = useMidiStore.getState()

    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      store.setStatus('unsupported', 'WebMIDI not available in this environment')
      return
    }

    store.setStatus('requesting')
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false })
    } catch (err) {
      store.setStatus('denied', err instanceof Error ? err.message : String(err))
      return
    }

    store.setStatus('granted')
    this.refreshDevices()
    this.access.onstatechange = (): void => {
      this.refreshDevices()
    }
  }

  private refreshDevices(): void {
    if (!this.access) return
    const devices: MidiDevice[] = []
    this.access.inputs.forEach((input) => {
      devices.push({
        id: input.id,
        name: input.name ?? 'Unknown device',
        manufacturer: input.manufacturer ?? '',
        state: input.state === 'connected' ? 'connected' : 'disconnected'
      })

      if (input.state === 'connected' && !this.boundInputs.has(input.id)) {
        const deviceName = input.name ?? 'Unknown'
        input.onmidimessage = (e: MIDIMessageEvent): void => {
          if (!e.data) return
          if (this.debugLog) {
            // eslint-disable-next-line no-console
            console.log(formatMessage(deviceName, e.data))
          }
          this.route(e.data)
        }
        this.boundInputs.add(input.id)
      } else if (input.state !== 'connected') {
        this.boundInputs.delete(input.id)
      }
    })
    useMidiStore.getState().setDevices(devices)
  }

  // 3단계: 하드코딩 라우터. 4단계에서 MidiMapper로 교체.
  // Party Mix MKII: Play A = NoteOn ch=0 d1=0x00 (velocity 127)
  private route(data: Uint8Array): void {
    const status = data[0] ?? 0
    const type = status & 0xf0
    const channel = status & 0x0f
    const d1 = data[1] ?? 0
    const d2 = data[2] ?? 0

    if (type === 0x90 && d2 > 0 && channel === 0 && d1 === 0x00) {
      void togglePlay('A')
    }
  }
}

export const midiManager = new MidiManager()

if (typeof window !== 'undefined') {
  // DevTools에서 토글 가능: midi.debugLog = false
  ;(window as unknown as { midi: MidiManager }).midi = midiManager
}
