export interface MidiDevice {
  id: string
  name: string
  manufacturer: string
  state: 'connected' | 'disconnected'
}

export interface MidiMessage {
  status: number
  data1: number
  data2: number
  channel: number
  timestamp: number
}
