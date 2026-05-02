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

// ─── Preset / Binding ────────────────────────────────────────

export type PadMode = 'cue' | 'loop' | 'sampler' | 'fx'

export const PAD_MODES: PadMode[] = ['cue', 'loop', 'sampler', 'fx']

// 컨트롤러가 보내는 메시지의 구조적 식별자
// 버튼: type=0x90, ch, d1
// CC:   type=0xb0, ch, d1
export interface MidiBinding {
  type: number     // 0x90 (NoteOn) or 0xb0 (CC)
  channel: number  // 0~15
  data1: number    // note or CC number
  // value semantics — Mapper가 d2 해석에 사용
  value:
    | { kind: 'momentary' }                                    // 버튼 (NoteOn vel>0 → trigger)
    | { kind: 'absolute' }                                     // CC d2 0~127 → 0..1
    | { kind: 'relative-signed' }                              // CC d2: 1..63=+N, 65..127=-(128-N)
    | { kind: 'mode-echo'; deck: 'A' | 'B'; mode: PadMode }    // 패드모드 echo
    | { kind: 'jog-touch'; deck: 'A' | 'B' }                   // NoteOn=down / NoteOff=up
    | { kind: 'cue-toggle'; deck: 'A' | 'B' }                  // NoteOn=cue on / NoteOff=cue off (controller-driven)
}

export type ActionKey =
  // Transport
  | 'deck.A.play'  | 'deck.B.play'
  | 'deck.A.cue'   | 'deck.B.cue'
  | 'deck.A.sync'  | 'deck.B.sync'
  // Pad (모드 무관, 호스트가 분기)
  | 'deck.A.pad.1' | 'deck.A.pad.2' | 'deck.A.pad.3' | 'deck.A.pad.4'
  | 'deck.B.pad.1' | 'deck.B.pad.2' | 'deck.B.pad.3' | 'deck.B.pad.4'
  // Pad mode echo
  | 'deck.A.padMode.cue' | 'deck.A.padMode.loop' | 'deck.A.padMode.sampler' | 'deck.A.padMode.fx'
  | 'deck.B.padMode.cue' | 'deck.B.padMode.loop' | 'deck.B.padMode.sampler' | 'deck.B.padMode.fx'
  // Jog
  | 'deck.A.jog' | 'deck.B.jog'
  | 'deck.A.jog.touch' | 'deck.B.jog.touch'
  // Faders / Pitch
  | 'deck.A.volume' | 'deck.B.volume'
  | 'mixer.crossfader'
  | 'deck.A.pitch'  | 'deck.B.pitch'
  // Knobs
  | 'mixer.master' | 'mixer.cueGain'
  | 'deck.A.level' | 'deck.B.level'
  // EQ + Filter
  | 'deck.A.eq.high' | 'deck.A.eq.low' | 'deck.A.filter'
  | 'deck.B.eq.high' | 'deck.B.eq.low' | 'deck.B.filter'
  // PFL
  | 'deck.A.cueMonitor' | 'deck.B.cueMonitor'
  // Browse
  | 'browse.turn' | 'browse.press'
  | 'deck.A.load' | 'deck.B.load'

export interface Preset {
  name: string
  bindings: Partial<Record<ActionKey, MidiBinding>>
}
