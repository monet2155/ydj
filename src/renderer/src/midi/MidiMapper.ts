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
  cycleFxTimeDivision,
  browsePress,
  jogTouchStart,
  jogTouchEnd
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
    const entry = { action: k as ActionKey, binding: b }
    map.set(indexKey(b.type, b.channel, b.data1), entry)
    // jog-touch: NoteOn(터치 다운)과 NoteOff(터치 업) 둘 다 같은 액션으로 라우트
    if (b.value.kind === 'jog-touch' && b.type === 0x90) {
      map.set(indexKey(0x80, b.channel, b.data1), entry)
    }
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
        // Party Mix MKII jog/browse는 sign-magnitude:
        //   1~63 = +N, 64~127 = -(128-N).
        // 한 detent에서 여러 step을 보낼 수 있어 magnitude를 그대로 사용.
        let signedSteps = 0
        if (d2 === 0) signedSteps = 0
        else if (d2 < 64) signedSteps = d2
        else signedSteps = d2 - 128  // e.g. 127 → -1, 120 → -8
        if (signedSteps === 0) return
        const dir = signedSteps > 0 ? 1 : -1
        const count = Math.min(8, Math.abs(signedSteps))
        for (let i = 0; i < count; i++) {
          this.dispatchRelative(action, dir as 1 | -1)
        }
        return
      }
      case 'mode-echo': {
        if (type === 0x90 && d2 > 0) {
          useMidiStore.getState().setPadMode(binding.value.deck, binding.value.mode)
        }
        return
      }
      case 'jog-touch': {
        const isDown = type === 0x90 && d2 > 0
        if (isDown) jogTouchStart(binding.value.deck)
        else jogTouchEnd(binding.value.deck)
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

    // PFL/Cue Monitor — 헤드폰 모니터링이 엔진에 미구현. 별도 트랙(MIDI_PLAN).
    if (action === 'deck.A.cueMonitor' || action === 'deck.B.cueMonitor') return

    // Load — 현재 선택된 라이브러리 트랙을 그 덱에 로드
    if (action === 'deck.A.load') return loadSelectedToDeck('A')
    if (action === 'deck.B.load') return loadSelectedToDeck('B')
    // Browse press — 라이브러리 패널 토글
    if (action === 'browse.press') return browsePress()
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
    // Headphone Mix — cue bus 미구현. 별도 트랙(MIDI_PLAN).
    if (action === 'mixer.headphone.mix') return
    // Level — pre-fader trim 미구현. 별도 트랙(MIDI_PLAN).
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
