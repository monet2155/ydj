import { useMidiStore } from '../store/midiStore'
import type { MidiDevice } from './types'
import { MidiMapper } from './MidiMapper'
import { partyMix2Preset } from './presets/partyMix2'

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

export type MidiListener = (data: Uint8Array, deviceName: string) => void

class MidiManager {
  private access: MIDIAccess | null = null
  private initialized = false
  private boundInputs = new Set<string>()
  private listeners = new Set<MidiListener>()
  public mapper = new MidiMapper(partyMix2Preset)
  // 개발 중 raw 메시지 콘솔 덤프. 토글: window.midi.debugLog = false
  public debugLog = false

  subscribe(listener: MidiListener): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  // Fired the first time a known device appears in this session.
  private knownDeviceCallback: ((deviceName: string) => void) | null = null
  private announcedDevices = new Set<string>()
  registerKnownDeviceCallback(fn: ((deviceName: string) => void) | null): void {
    this.knownDeviceCallback = fn
  }

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
        if (deviceName && !this.announcedDevices.has(deviceName)) {
          this.announcedDevices.add(deviceName)
          this.knownDeviceCallback?.(deviceName)
        }
        input.onmidimessage = (e: MIDIMessageEvent): void => {
          if (!e.data) return
          if (this.debugLog) {
            // eslint-disable-next-line no-console
            console.log(formatMessage(deviceName, e.data))
          }
          this.listeners.forEach((fn) => fn(e.data, deviceName))
          this.route(e.data)
        }
        this.boundInputs.add(input.id)
      } else if (input.state !== 'connected') {
        this.boundInputs.delete(input.id)
      }
    })
    useMidiStore.getState().setDevices(devices)
  }

  private route(data: Uint8Array): void {
    this.mapper.handle(data)
  }
}

export const midiManager = new MidiManager()

if (typeof window !== 'undefined') {
  // DevTools에서 토글 가능: midi.debugLog = false
  ;(window as unknown as { midi: MidiManager }).midi = midiManager
}
