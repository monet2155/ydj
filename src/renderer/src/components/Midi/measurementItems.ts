export type ItemKind = 'button' | 'pad' | 'fader' | 'knob' | 'jog' | 'encoder'

export interface MeasurementItem {
  key: string
  group: string
  label: string
  kind: ItemKind
  hint?: string
}

// Numark Party Mix MKII — User Guide v1.4 기반
// 컨트롤 번호는 매뉴얼 Top Panel 도식의 번호(#)
//
// 패드 모드 4종 (#18 Pad Mode 버튼으로 순환): Cue / Loop / Sampler / Effects.
// 같은 물리 패드 4개가 모드마다 다른 MIDI note를 보낼 가능성이 높아 모드별로 따로 측정한다.
// (Serato 설계 관행 + 매뉴얼 §17~18: "press the Pad Mode button" to change function)
export const MEASUREMENT_ITEMS: MeasurementItem[] = [
  // ── Transport (#14, #15, #16) ──────────────────────────────
  { key: 'deck.A.play',  group: 'Transport',  label: 'Play A (#16)',  kind: 'button', hint: '✓ already measured (NoteOn ch=0 d1=0)' },
  { key: 'deck.A.cue',   group: 'Transport',  label: 'Cue A (#15)',   kind: 'button' },
  { key: 'deck.A.sync',  group: 'Transport',  label: 'Sync A (#14)',  kind: 'button' },
  { key: 'deck.B.play',  group: 'Transport',  label: 'Play B (#16)',  kind: 'button' },
  { key: 'deck.B.cue',   group: 'Transport',  label: 'Cue B (#15)',   kind: 'button' },
  { key: 'deck.B.sync',  group: 'Transport',  label: 'Sync B (#14)',  kind: 'button' },

  // ── Pad Mode (#18) — global, single button ───────────────
  // 측정 결과: A/B 모두 동일 메시지(ch=15 d1=50). 컨트롤러는 모드 정보를 MIDI에
  // 담지 않으므로 호스트가 카운터를 추적해야 함 (Cue → Loop → Sampler → Effects).
  { key: 'mixer.padMode',  group: 'Pad Mode', label: 'Pad Mode (#18)', kind: 'button', hint: 'global; host tracks current mode' },

  // ── Pads (#17) — 8 keys, mode-agnostic ────────────────────
  // 모든 모드에서 같은 note 발사. 호스트가 mixer.padMode 상태에 따라 의미 분기.
  { key: 'deck.A.pad.1', group: 'Pads', label: 'Pad A1', kind: 'pad', hint: 'meaning depends on Pad Mode' },
  { key: 'deck.A.pad.2', group: 'Pads', label: 'Pad A2', kind: 'pad' },
  { key: 'deck.A.pad.3', group: 'Pads', label: 'Pad A3', kind: 'pad' },
  { key: 'deck.A.pad.4', group: 'Pads', label: 'Pad A4', kind: 'pad' },
  { key: 'deck.B.pad.1', group: 'Pads', label: 'Pad B1', kind: 'pad' },
  { key: 'deck.B.pad.2', group: 'Pads', label: 'Pad B2', kind: 'pad' },
  { key: 'deck.B.pad.3', group: 'Pads', label: 'Pad B3', kind: 'pad' },
  { key: 'deck.B.pad.4', group: 'Pads', label: 'Pad B4', kind: 'pad' },

  // ── Jog Wheels (#12) — relative encoder, no touch detection in MIDI ──
  // 측정 결과: 컨트롤러는 단일 CC만 보냄(d2=0x01 +1, d2=0x7f -1).
  // touch top vs outer 구분 없음. host가 재생 상태로 scratch/pitch-bend 분기.
  { key: 'deck.A.jog', group: 'Jog', label: 'Jog A — rotate (#12)', kind: 'jog', hint: 'd2=0x01 +1, 0x7f -1 (relative)' },
  { key: 'deck.B.jog', group: 'Jog', label: 'Jog B — rotate (#12)', kind: 'jog' },

  // ── Faders & Crossfader (#9, #10, #13) ────────────────────
  { key: 'deck.A.volume',    group: 'Faders', label: 'Channel Volume A (#9)',  kind: 'fader' },
  { key: 'deck.B.volume',    group: 'Faders', label: 'Channel Volume B (#9)',  kind: 'fader' },
  { key: 'mixer.crossfader', group: 'Faders', label: 'Crossfader (#10)',       kind: 'fader' },
  { key: 'deck.A.pitch',     group: 'Faders', label: 'Pitch Fader A (#13)',    kind: 'fader' },
  { key: 'deck.B.pitch',     group: 'Faders', label: 'Pitch Fader B (#13)',    kind: 'fader' },

  // ── Mixer Master/Cue Gain (#3, #4) + Channel Level (#5) ───
  { key: 'mixer.master',         group: 'Mixer Knobs', label: 'Main Gain (#3)',      kind: 'knob', hint: 'overall master volume' },
  { key: 'mixer.headphone.mix',  group: 'Mixer Knobs', label: 'Cue Gain (#4)',       kind: 'knob', hint: 'headphone cue volume' },
  { key: 'deck.A.level',         group: 'Mixer Knobs', label: 'Level A (#5)',        kind: 'knob', hint: 'pre-fader, pre-EQ channel gain' },
  { key: 'deck.B.level',         group: 'Mixer Knobs', label: 'Level B (#5)',        kind: 'knob' },

  // ── EQ + Filter (#6 High, #7 Low, #8 Filter) ──────────────
  { key: 'deck.A.eq.high', group: 'EQ + Filter', label: 'High EQ A (#6)',  kind: 'knob', hint: 'treble' },
  { key: 'deck.A.eq.low',  group: 'EQ + Filter', label: 'Low EQ A (#7)',   kind: 'knob', hint: 'bass' },
  { key: 'deck.A.filter',  group: 'EQ + Filter', label: 'Filter A (#8)',   kind: 'knob', hint: 'left=LPF, right=HPF (center=off)' },
  { key: 'deck.B.eq.high', group: 'EQ + Filter', label: 'High EQ B (#6)',  kind: 'knob' },
  { key: 'deck.B.eq.low',  group: 'EQ + Filter', label: 'Low EQ B (#7)',   kind: 'knob' },
  { key: 'deck.B.filter',  group: 'EQ + Filter', label: 'Filter B (#8)',   kind: 'knob' },

  // ── PFL/Cue 모니터 (#11) ──────────────────────────────────
  { key: 'deck.A.cueMonitor', group: 'PFL', label: 'PFL/Cue A (#11)', kind: 'button', hint: 'headphone cue monitor toggle' },
  { key: 'deck.B.cueMonitor', group: 'PFL', label: 'PFL/Cue B (#11)', kind: 'button' },

  // ── Browse / Load (#1, #2) ────────────────────────────────
  { key: 'browse.turn',   group: 'Browse', label: 'Browse Knob — rotate (#1)', kind: 'encoder', hint: 'cycle crates/tracks (relative CC?)' },
  { key: 'browse.press',  group: 'Browse', label: 'Browse Knob — press (#1)',  kind: 'button', hint: 'enter / move forward' },
  { key: 'deck.A.load',   group: 'Browse', label: 'Load 1 (#2)',                kind: 'button', hint: 'load selected track to Deck A' },
  { key: 'deck.B.load',   group: 'Browse', label: 'Load 2 (#2)',                kind: 'button' },

  // ── 기타 ──────────────────────────────────────────────────
  // Party Ball Mode 버튼은 LED 조명 전용이라 측정에서 제외 (소프트웨어가 색상 결정)
]

export const STATUS_NAMES: Record<number, string> = {
  0x80: 'NoteOff',
  0x90: 'NoteOn',
  0xa0: 'Aftertouch',
  0xb0: 'CC',
  0xc0: 'Program',
  0xd0: 'ChanPress',
  0xe0: 'PitchBend'
}

export interface CapturedBinding {
  status: number       // first byte (status + channel)
  type: number         // status & 0xf0
  channel: number
  data1: number
  samples: Uint8Array[] // last few raw messages — used to infer pattern
}

export function inferPattern(samples: Uint8Array[]): string {
  if (samples.length === 0) return '—'
  const types = samples.map((s) => (s[0] ?? 0) & 0xf0)
  const hasNoteOn = types.includes(0x90)
  const hasNoteOff = types.includes(0x80) || samples.some((s) => ((s[0] ?? 0) & 0xf0) === 0x90 && (s[2] ?? 0) === 0)
  const hasCC = types.includes(0xb0)
  if (hasCC) {
    const vals = samples.filter((s) => ((s[0] ?? 0) & 0xf0) === 0xb0).map((s) => s[2] ?? 0)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    // jog/encoder: relative often uses 0x01/0x7f pattern (1 or 127 only)
    const uniqueVals = new Set(vals)
    if (uniqueVals.size <= 2 && (uniqueVals.has(1) || uniqueVals.has(127) || uniqueVals.has(63) || uniqueVals.has(65))) {
      return 'relative? (CC, ±1 step)'
    }
    if (min < 32 && max > 96) return 'absolute (CC, full range)'
    if (min < 64 && max > 64) return 'absolute (CC)'
    return 'CC (limited range — move further)'
  }
  if (hasNoteOn && hasNoteOff) return 'momentary'
  if (hasNoteOn) return 'toggle?'
  return 'unknown'
}
