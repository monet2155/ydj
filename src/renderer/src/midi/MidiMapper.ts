import type { ActionKey, MidiBinding, Preset, PadMode } from './types'
import { useMidiStore } from '../store/midiStore'
import {
  togglePlay,
  cueDeck,
  syncDeck,
  triggerHotCue,
  setAutoLoop,
  setDeckVolume,
  setEqBand,
  setFilter,
  setCrossfader,
  setMasterVolume,
  setPitchPercent,
  jogStep,
  moveBrowseSelection,
  loadSelectedToDeck,
  toggleFx,
  cycleFxTimeDivision
} from './actions'
import type { DeckId } from '../store/deckStore'

// Reverse index: "type:ch:d1" → ActionKey + binding
type Index = Map<string, { action: ActionKey; binding: MidiBinding }>

function indexKey(type: number, channel: number, data1: number): string {
  return `${type.toString(16)}:${channel}:${data1}`
}

function buildIndex(preset: Preset): Index {
  const map: Index = new Map()
  for (const [k, b] of Object.entries(preset.bindings)) {
    if (!b) continue
    map.set(indexKey(b.type, b.channel, b.data1), { action: k as ActionKey, binding: b })
  }
  return map
}

const PAD_LOOP_BEATS = [1, 2, 4, 8] // Pad 1~4 in Loop mode

export class MidiMapper {
  private index: Index

  constructor(public preset: Preset) {
    this.index = buildIndex(preset)
  }

  setPreset(preset: Preset): void {
    this.preset = preset
    this.index = buildIndex(preset)
  }

  // 들어온 raw 메시지를 분석해 액션 디스패치
  handle(data: Uint8Array): void {
    const status = data[0] ?? 0
    const type = status & 0xf0
    const channel = status & 0x0f
    const d1 = data[1] ?? 0
    const d2 = data[2] ?? 0

    const hit = this.index.get(indexKey(type, channel, d1))
    if (!hit) return

    const { action, binding } = hit

    switch (binding.value.kind) {
      case 'momentary': {
        // NoteOn vel>0만 trigger. NoteOff/vel0 무시.
        if (type === 0x90 && d2 > 0) this.dispatchTrigger(action)
        return
      }
      case 'absolute': {
        const norm = d2 / 127
        this.dispatchAbsolute(action, norm)
        return
      }
      case 'relative-signed': {
        // Party Mix MKII: d2=0x01 → +1, d2=0x7f → -1
        const dir = d2 === 0x01 ? 1 : d2 === 0x7f ? -1 : 0
        if (dir !== 0) this.dispatchRelative(action, dir as 1 | -1)
        return
      }
      case 'mode-echo': {
        if (type === 0x90 && d2 > 0) {
          useMidiStore.getState().setPadMode(binding.value.deck, binding.value.mode)
        }
        return
      }
    }
  }

  private dispatchTrigger(action: ActionKey): void {
    // Transport
    if (action === 'deck.A.play') return void togglePlay('A')
    if (action === 'deck.B.play') return void togglePlay('B')
    if (action === 'deck.A.cue')  return cueDeck('A')
    if (action === 'deck.B.cue')  return cueDeck('B')
    if (action === 'deck.A.sync') return syncDeck('A')
    if (action === 'deck.B.sync') return syncDeck('B')

    // Pads — 모드별 분기
    const padMatch = action.match(/^deck\.([AB])\.pad\.(\d)$/)
    if (padMatch) {
      const deck = padMatch[1] as DeckId
      const idx = parseInt(padMatch[2], 10) - 1   // 0~3
      const mode = useMidiStore.getState().padMode[deck]
      this.handlePad(deck, idx, mode)
      return
    }

    // PFL/Cue Monitor — TODO: 실제 헤드폰 모니터링이 구현되면 연결
    if (action === 'deck.A.cueMonitor' || action === 'deck.B.cueMonitor') return

    // Load — 현재 선택된 라이브러리 트랙을 그 덱에 로드
    if (action === 'deck.A.load') return loadSelectedToDeck('A')
    if (action === 'deck.B.load') return loadSelectedToDeck('B')
    // Browse press — 선택 트랙 활성화/포커스 정도. 일단 no-op.
    if (action === 'browse.press') return
  }

  private handlePad(deckId: DeckId, padIdx: number, mode: PadMode): void {
    switch (mode) {
      case 'cue':
        triggerHotCue(deckId, padIdx)
        return
      case 'loop':
        setAutoLoop(deckId, PAD_LOOP_BEATS[padIdx] ?? 1)
        return
      case 'sampler':
        // SPEC 미정 — 일단 no-op
        return
      case 'fx':
        // Pad 1~3 = delay / reverb / flanger 토글, Pad 4 = delay time-div cycle
        if (padIdx === 0) return toggleFx(deckId, 'delay')
        if (padIdx === 1) return toggleFx(deckId, 'reverb')
        if (padIdx === 2) return toggleFx(deckId, 'flanger')
        if (padIdx === 3) return cycleFxTimeDivision(deckId)
        return
    }
  }

  private dispatchAbsolute(action: ActionKey, norm: number): void {
    // Faders
    if (action === 'deck.A.volume') return setDeckVolume('A', norm)
    if (action === 'deck.B.volume') return setDeckVolume('B', norm)
    if (action === 'mixer.crossfader') return setCrossfader(norm)
    // Pitch fader: -10% ~ +10% (SPEC §3.5 기본 범위, 50%=center)
    if (action === 'deck.A.pitch') return setPitchPercent('A', (norm - 0.5) * 20)
    if (action === 'deck.B.pitch') return setPitchPercent('B', (norm - 0.5) * 20)
    // Master / Headphone
    if (action === 'mixer.master') return setMasterVolume(norm)
    if (action === 'mixer.headphone.mix') return // TODO: cue mix
    // Level — 4단계 (a)에선 deck volume과 별도 트림 미구현, 무시
    if (action === 'deck.A.level' || action === 'deck.B.level') return
    // EQ
    if (action === 'deck.A.eq.high') return setEqBand('A', 'high', norm)
    if (action === 'deck.A.eq.low')  return setEqBand('A', 'low',  norm)
    if (action === 'deck.B.eq.high') return setEqBand('B', 'high', norm)
    if (action === 'deck.B.eq.low')  return setEqBand('B', 'low',  norm)
    // Filter
    if (action === 'deck.A.filter') return setFilter('A', norm)
    if (action === 'deck.B.filter') return setFilter('B', norm)
  }

  private dispatchRelative(action: ActionKey, dir: 1 | -1): void {
    if (action === 'deck.A.jog') return jogStep('A', dir)
    if (action === 'deck.B.jog') return jogStep('B', dir)
    if (action === 'browse.turn') return moveBrowseSelection(dir)
  }
}
