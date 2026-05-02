import type { Preset } from '../types'

// Numark Party Mix MKII — 측정 결과(docs/MIDI_PARTY_MIX_2.md)에서 가져옴.
// 이 프리셋이 4단계 (a)의 source of truth.
export const partyMix2Preset: Preset = {
  name: 'Numark Party Mix MKII',
  bindings: {
    // ─── Transport ───────────────────────────────────────
    'deck.A.play': { type: 0x90, channel: 0, data1: 0x00, value: { kind: 'momentary' } },
    'deck.A.cue':  { type: 0x90, channel: 0, data1: 0x01, value: { kind: 'momentary' } },
    'deck.A.sync': { type: 0x90, channel: 0, data1: 0x02, value: { kind: 'momentary' } },
    'deck.B.play': { type: 0x90, channel: 1, data1: 0x00, value: { kind: 'momentary' } },
    'deck.B.cue':  { type: 0x90, channel: 1, data1: 0x01, value: { kind: 'momentary' } },
    'deck.B.sync': { type: 0x90, channel: 1, data1: 0x02, value: { kind: 'momentary' } },

    // ─── Pads (mode-agnostic) ────────────────────────────
    'deck.A.pad.1': { type: 0x90, channel: 4, data1: 0x14, value: { kind: 'momentary' } },
    'deck.A.pad.2': { type: 0x90, channel: 4, data1: 0x15, value: { kind: 'momentary' } },
    'deck.A.pad.3': { type: 0x90, channel: 4, data1: 0x16, value: { kind: 'momentary' } },
    'deck.A.pad.4': { type: 0x90, channel: 4, data1: 0x17, value: { kind: 'momentary' } },
    'deck.B.pad.1': { type: 0x90, channel: 5, data1: 0x14, value: { kind: 'momentary' } },
    'deck.B.pad.2': { type: 0x90, channel: 5, data1: 0x15, value: { kind: 'momentary' } },
    'deck.B.pad.3': { type: 0x90, channel: 5, data1: 0x16, value: { kind: 'momentary' } },
    'deck.B.pad.4': { type: 0x90, channel: 5, data1: 0x17, value: { kind: 'momentary' } },

    // ─── Pad mode echo (state sync from controller) ──────
    'deck.A.padMode.cue':     { type: 0x90, channel: 4, data1: 0x00, value: { kind: 'mode-echo', deck: 'A', mode: 'cue' } },
    'deck.A.padMode.loop':    { type: 0x90, channel: 4, data1: 0x0e, value: { kind: 'mode-echo', deck: 'A', mode: 'loop' } },
    'deck.A.padMode.sampler': { type: 0x90, channel: 4, data1: 0x0b, value: { kind: 'mode-echo', deck: 'A', mode: 'sampler' } },
    'deck.A.padMode.fx':      { type: 0x90, channel: 4, data1: 0x0f, value: { kind: 'mode-echo', deck: 'A', mode: 'fx' } },
    'deck.B.padMode.cue':     { type: 0x90, channel: 5, data1: 0x00, value: { kind: 'mode-echo', deck: 'B', mode: 'cue' } },
    'deck.B.padMode.loop':    { type: 0x90, channel: 5, data1: 0x0e, value: { kind: 'mode-echo', deck: 'B', mode: 'loop' } },
    'deck.B.padMode.sampler': { type: 0x90, channel: 5, data1: 0x0b, value: { kind: 'mode-echo', deck: 'B', mode: 'sampler' } },
    'deck.B.padMode.fx':      { type: 0x90, channel: 5, data1: 0x0f, value: { kind: 'mode-echo', deck: 'B', mode: 'fx' } },

    // ─── Jog ─────────────────────────────────────────────
    // 회전 (CC)와 터치(NoteOn/Off)가 같은 ch/d1을 공유 — status로 분리.
    'deck.A.jog':       { type: 0xb0, channel: 0, data1: 0x06, value: { kind: 'relative-signed' } },
    'deck.B.jog':       { type: 0xb0, channel: 1, data1: 0x06, value: { kind: 'relative-signed' } },
    'deck.A.jog.touch': { type: 0x90, channel: 0, data1: 0x06, value: { kind: 'jog-touch', deck: 'A' } },
    'deck.B.jog.touch': { type: 0x90, channel: 1, data1: 0x06, value: { kind: 'jog-touch', deck: 'B' } },

    // ─── Faders / Pitch ──────────────────────────────────
    'deck.A.volume':    { type: 0xb0, channel: 0,  data1: 0x1c, value: { kind: 'absolute' } },
    'deck.B.volume':    { type: 0xb0, channel: 1,  data1: 0x1c, value: { kind: 'absolute' } },
    'mixer.crossfader': { type: 0xb0, channel: 15, data1: 0x08, value: { kind: 'absolute' } },
    'deck.A.pitch':     { type: 0xb0, channel: 0,  data1: 0x09, value: { kind: 'absolute' } },
    'deck.B.pitch':     { type: 0xb0, channel: 1,  data1: 0x09, value: { kind: 'absolute' } },

    // ─── Knobs ───────────────────────────────────────────
    'mixer.master':        { type: 0xb0, channel: 15, data1: 0x0a, value: { kind: 'absolute' } },
    // MKII #4 노브는 매뉴얼상 "Cue Gain"(헤드폰 출력 볼륨). 측정 시 임시로
    // 'mixer.headphone.mix'로 잡았으나 실제 의미는 cue gain이라 rename.
    'mixer.cueGain':       { type: 0xb0, channel: 15, data1: 0x0c, value: { kind: 'absolute' } },
    'deck.A.level':        { type: 0xb0, channel: 0,  data1: 0x17, value: { kind: 'absolute' } },
    'deck.B.level':        { type: 0xb0, channel: 1,  data1: 0x17, value: { kind: 'absolute' } },

    // ─── EQ + Filter ─────────────────────────────────────
    'deck.A.eq.high': { type: 0xb0, channel: 0, data1: 0x18, value: { kind: 'absolute' } },
    'deck.A.eq.low':  { type: 0xb0, channel: 0, data1: 0x19, value: { kind: 'absolute' } },
    'deck.A.filter':  { type: 0xb0, channel: 0, data1: 0x1a, value: { kind: 'absolute' } },
    'deck.B.eq.high': { type: 0xb0, channel: 1, data1: 0x18, value: { kind: 'absolute' } },
    'deck.B.eq.low':  { type: 0xb0, channel: 1, data1: 0x19, value: { kind: 'absolute' } },
    'deck.B.filter':  { type: 0xb0, channel: 1, data1: 0x1a, value: { kind: 'absolute' } },

    // ─── PFL ─────────────────────────────────────────────
    'deck.A.cueMonitor': { type: 0x90, channel: 0, data1: 0x1b, value: { kind: 'momentary' } },
    'deck.B.cueMonitor': { type: 0x90, channel: 1, data1: 0x1b, value: { kind: 'momentary' } },

    // ─── Browse ──────────────────────────────────────────
    'browse.turn':  { type: 0xb0, channel: 15, data1: 0x00, value: { kind: 'relative-signed' } },
    'browse.press': { type: 0x90, channel: 15, data1: 0x07, value: { kind: 'momentary' } },
    'deck.A.load':  { type: 0x90, channel: 15, data1: 0x02, value: { kind: 'momentary' } },
    'deck.B.load':  { type: 0x90, channel: 15, data1: 0x03, value: { kind: 'momentary' } }
  }
}
