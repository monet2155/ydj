import { useDeckStore, type DeckId } from '../store/deckStore'
import { useMixerStore } from '../store/mixerStore'
import { useFxStore } from '../store/fxStore'
import { getAudioEngine, getDeckEngine, getMixerEngine } from '../hooks/useAudio'
import type { FilterMode } from '../engine/FxEngine'

// ─── Transport ───────────────────────────────────────────────

export async function togglePlay(deckId: DeckId): Promise<void> {
  const deck = useDeckStore.getState().decks[deckId]
  if (!deck.track) return
  await getAudioEngine().resume()
  const engine = getDeckEngine(deckId)
  if (deck.isPlaying) {
    engine.pause()
    useDeckStore.getState().setPlaying(deckId, false)
  } else {
    engine.play()
    useDeckStore.getState().setPlaying(deckId, true)
  }
}

export function cueDeck(deckId: DeckId): void {
  // Serato 식 동작: 정지 상태에서 누르면 현재 위치를 임시 cue로, 재생 중이면 cue로 점프 후 정지
  // SPEC §3.2의 "큐 버튼"과 단순 구현 — 일단 cue=0(트랙 시작) 점프로 근사
  // (정식 임시 cue 포인트 저장은 추후 별도 구현)
  const engine = getDeckEngine(deckId)
  engine.seek(0)
  useDeckStore.getState().setPosition(deckId, 0)
  useDeckStore.getState().setPlaying(deckId, false)
}

/** Pure: master의 effective BPM에 맞추기 위한 deckId의 새 playbackRate */
export function computeSyncRate(
  thisBpm: number | null,
  masterBpm: number | null,
  masterRate: number
): number | null {
  if (!thisBpm || !masterBpm) return null
  return (masterBpm * masterRate) / thisBpm
}

export function syncDeck(deckId: DeckId): void {
  const masterId: DeckId = deckId === 'A' ? 'B' : 'A'
  const decks = useDeckStore.getState().decks
  const rate = computeSyncRate(decks[deckId].bpm, decks[masterId].bpm, decks[masterId].playbackRate)
  if (rate === null) return
  getDeckEngine(deckId).playbackRate = rate
  useDeckStore.getState().setPlaybackRate(deckId, rate)
}

// ─── Hot Cue ─────────────────────────────────────────────────

export function triggerHotCue(deckId: DeckId, slot: number): void {
  // slot: 0~7 (현재 컨트롤러는 0~3만 발사)
  const deck = useDeckStore.getState().decks[deckId]
  if (!deck.track) return
  const pos = deck.hotCues[slot]
  if (pos !== null && pos !== undefined) {
    // 점프
    getDeckEngine(deckId).seek(pos)
    useDeckStore.getState().setPosition(deckId, pos)
    if (!deck.isPlaying) {
      getDeckEngine(deckId).play()
      useDeckStore.getState().setPlaying(deckId, true)
    }
  } else {
    // 빈 슬롯이면 현재 위치를 저장
    const slots = [...deck.hotCues]
    slots[slot] = deck.position
    useDeckStore.getState().setHotCue(deckId, slot, deck.position)
    const videoId = deck.track.videoId
    if (videoId) {
      window.electronAPI.hotcues.save(videoId, slots).catch(console.error)
    }
  }
}

// ─── Auto Loop ───────────────────────────────────────────────

export function setAutoLoop(deckId: DeckId, beats: number): void {
  const deck = useDeckStore.getState().decks[deckId]
  if (!deck.track || !deck.bpm) return
  const secondsPerBeat = 60 / (deck.bpm * deck.playbackRate)
  const length = secondsPerBeat * beats
  const start = deck.position
  const end = start + length
  // 동일 패드를 다시 누르면 루프 해제 (Serato 식 토글). 다른 길이를 누르면 새 루프로 갱신.
  if (deck.loop.active && deck.loop.start === start && deck.loop.end === end) {
    getDeckEngine(deckId).deactivateLoop()
    useDeckStore.getState().setLoop(deckId, { active: false, start: null, end: null })
    return
  }
  getDeckEngine(deckId).activateLoop(start, end)
  useDeckStore.getState().setLoop(deckId, { active: true, start, end })
}

// ─── Volume / EQ / Filter ────────────────────────────────────

export function setDeckVolume(deckId: DeckId, value: number): void {
  // value: 0..1
  const v = Math.max(0, Math.min(1, value))
  getDeckEngine(deckId).volume = v
  useDeckStore.getState().setVolume(deckId, v)
}

export function setEqBand(deckId: DeckId, band: 'low' | 'high', value: number): void {
  // value: 0..1 (0 = -40dB cut, 0.5 = 0dB, 1 = +6dB)
  const db = value <= 0.5 ? -40 + value * 80 : (value - 0.5) * 12
  getDeckEngine(deckId).setEq(band, db)
  useDeckStore.getState().setEq(deckId, band, db)
}

/**
 * Pure: Filter knob (norm 0..1) → fxStore filter patch.
 * 중앙(0.5)=off / 좌측 절반=LPF / 우측 절반=HPF.
 * FxEngine의 param 의미: 1=neutral, 0=full filter. center에서 param=1, 끝에서 param=0.
 */
const FILTER_DEADZONE = 0.04

export function computeFilterFromKnob(norm: number): {
  enabled: boolean
  mode: FilterMode
  param: number
  wet: number
} {
  const distance = Math.abs(norm - 0.5) * 2  // 0 at center, 1 at extremes
  if (distance < FILTER_DEADZONE) {
    return { enabled: false, mode: 'lpf', param: 1, wet: 1 }
  }
  const mode: FilterMode = norm < 0.5 ? 'lpf' : 'hpf'
  return { enabled: true, mode, param: 1 - distance, wet: 1 }
}

export function setFilter(deckId: DeckId, value: number): void {
  useFxStore.getState().setFilter(deckId, computeFilterFromKnob(value))
}

export function setCrossfader(value: number): void {
  // 0=A, 0.5=center, 1=B
  useMixerStore.getState().setCrossfader(Math.max(0, Math.min(1, value)))
}

export function setMasterVolume(value: number): void {
  useMixerStore.getState().setMasterVolume(Math.max(0, Math.min(1, value)))
  // engine은 store 구독으로 갱신됨
  void getMixerEngine
}

// ─── Pitch ───────────────────────────────────────────────────

export function setPitchPercent(deckId: DeckId, percent: number): void {
  // -10 ~ +10 (SPEC §3.5 기본 범위)
  const clamped = Math.max(-10, Math.min(10, percent))
  const rate = 1 + clamped / 100
  getDeckEngine(deckId).playbackRate = rate
  useDeckStore.getState().setPlaybackRate(deckId, rate)
}

// ─── Jog: scratch (정지 중) / pitch bend (재생 중) ───────────

const BEND_AMOUNT = 0.04   // ±4% temporary speed
const BEND_DECAY_MS = 120  // 마지막 jog 입력 후 N ms 뒤 원래 속도로 복귀
const SCRATCH_STEP_SEC = 0.01

const bendTimers: Record<DeckId, ReturnType<typeof setTimeout> | null> = { A: null, B: null }
const baselineRate: Record<DeckId, number> = { A: 1, B: 1 }

export function jogStep(deckId: DeckId, direction: 1 | -1): void {
  const deck = useDeckStore.getState().decks[deckId]
  if (!deck.track) return
  if (deck.isPlaying) {
    // pitch bend
    const baseline = useDeckStore.getState().decks[deckId].playbackRate
    if (bendTimers[deckId] === null) baselineRate[deckId] = baseline
    const bent = baselineRate[deckId] * (1 + direction * BEND_AMOUNT)
    getDeckEngine(deckId).playbackRate = bent
    if (bendTimers[deckId]) clearTimeout(bendTimers[deckId]!)
    bendTimers[deckId] = setTimeout(() => {
      getDeckEngine(deckId).playbackRate = baselineRate[deckId]
      bendTimers[deckId] = null
    }, BEND_DECAY_MS)
  } else {
    // scratch (단순 step seek)
    const next = Math.max(0, Math.min(deck.track.duration, deck.position + direction * SCRATCH_STEP_SEC))
    getDeckEngine(deckId).seek(next)
    useDeckStore.getState().setPosition(deckId, next)
  }
}
