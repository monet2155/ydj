import { useDeckStore, type DeckId } from '../store/deckStore'
import { useMixerStore } from '../store/mixerStore'
import { useFxStore } from '../store/fxStore'
import { useLibraryStore } from '../store/libraryStore'
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

// ─── FX mode pad toggles ─────────────────────────────────────

const FX_TIME_DIVISIONS = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8] as const

/** Pure: 현재 param에서 다음 time-division으로 순환했을 때의 새 param */
export function nextFxTimeDivision(currentParam: number): number {
  const idx = FX_TIME_DIVISIONS.findIndex((v) => Math.abs(v - currentParam) < 1e-6)
  const nextIdx = ((idx < 0 ? 0 : idx) + 1) % FX_TIME_DIVISIONS.length
  return FX_TIME_DIVISIONS[nextIdx]
}

export function toggleFx(deckId: DeckId, slot: 'delay' | 'reverb' | 'flanger'): void {
  const current = useFxStore.getState().fx[deckId][slot]
  const setter = slot === 'delay'  ? useFxStore.getState().setDelay
              : slot === 'reverb' ? useFxStore.getState().setReverb
                                  : useFxStore.getState().setFlanger
  setter(deckId, { enabled: !current.enabled })
}

/** Pad 4 in FX mode: cycle delay slot's time division (param) */
export function cycleFxTimeDivision(deckId: DeckId): void {
  const current = useFxStore.getState().fx[deckId].delay.param
  useFxStore.getState().setDelay(deckId, { param: nextFxTimeDivision(current) })
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

// ─── Library / Browse / Load ─────────────────────────────────

// React 컴포넌트에서 mount 시 등록. MIDI Load 액션이 이 콜백으로 위임.
type LoadCallback = (
  filePath: string,
  meta: { title: string; duration: number; videoId: string },
  deckId: DeckId
) => void

let loadCallback: LoadCallback | null = null

export function registerLibraryLoadCallback(fn: LoadCallback | null): void {
  loadCallback = fn
}

export function moveBrowseSelection(direction: 1 | -1): void {
  useLibraryStore.getState().moveSelection(direction)
}

let browsePressCallback: (() => void) | null = null

export function registerBrowsePressCallback(fn: (() => void) | null): void {
  browsePressCallback = fn
}

export function browsePress(): void {
  browsePressCallback?.()
}

export function loadSelectedToDeck(deckId: DeckId): void {
  if (!loadCallback) return
  const { tracks, selectedId } = useLibraryStore.getState()
  const track = tracks.find((t) => t.videoId === selectedId)
  if (!track) return
  loadCallback(track.filePath, {
    title: track.title,
    duration: track.duration,
    videoId: track.videoId
  }, deckId)
}

// ─── Jog: scratch via the same engine path as the UI vinyl ───
//
// 기존 useDeckScratch 훅과 동일한 엔진 동작을 모듈 스코프로 재구성.
// 차이점: MIDI jog는 이산적인 ±1 tick만 보내므로 세션을 자동 시작/종료.
//   - 첫 tick: scratch 세션 진입 (재생 중이면 playbackRate=0으로 freeze)
//   - 매 tick: deltaSec/timeDeltaSec → rate, 또는 seek
//   - idle 150ms: 세션 종료 (rate 복원, 재생 재개)
const JOG_TICK_SEC = 0.03    // tick당 오디오 위치 변화량 — UI 잡 드래그와 비슷한 체감
const JOG_IDLE_MS = 150
const JOG_MAX_RATE = 8

interface JogSession {
  wasPlaying: boolean
  lastTickTime: number   // performance.now()
  idleTimer: ReturnType<typeof setTimeout> | null
}

const jogSessions: Record<DeckId, JogSession | null> = { A: null, B: null }

function endJogSession(deckId: DeckId): void {
  const session = jogSessions[deckId]
  if (!session) return
  if (session.idleTimer) clearTimeout(session.idleTimer)
  jogSessions[deckId] = null

  const engine = getDeckEngine(deckId)
  if (session.wasPlaying) {
    const restoreRate = useDeckStore.getState().decks[deckId].playbackRate
    if (engine.isReverse) engine.setDirection(false, restoreRate)
    else engine.playbackRate = restoreRate
    if (!engine.isPlaying) engine.play()
    useDeckStore.getState().setPlaying(deckId, true)
  } else {
    useDeckStore.getState().setPlaying(deckId, false)
  }
  useDeckStore.getState().setPosition(deckId, engine.position)
}

export function jogStep(deckId: DeckId, direction: 1 | -1): void {
  const deck = useDeckStore.getState().decks[deckId]
  if (!deck.track) return
  const engine = getDeckEngine(deckId)
  const now = performance.now()

  let session = jogSessions[deckId]
  if (!session) {
    session = { wasPlaying: engine.isPlaying, lastTickTime: now, idleTimer: null }
    jogSessions[deckId] = session
    if (session.wasPlaying) engine.playbackRate = 0
  }

  const timeDeltaSec = Math.max(0.001, (now - session.lastTickTime) / 1000)
  session.lastTickTime = now
  const deltaSec = direction * JOG_TICK_SEC

  if (session.wasPlaying) {
    const rate = deltaSec / timeDeltaSec
    if (rate >= 0) engine.setDirection(false, Math.min(JOG_MAX_RATE, rate))
    else engine.setDirection(true, Math.min(JOG_MAX_RATE, Math.abs(rate)))
    useDeckStore.getState().setPosition(deckId, engine.position)
  } else {
    const next = Math.max(0, Math.min(deck.track.duration, deck.position + deltaSec))
    engine.seek(next)
    useDeckStore.getState().setPosition(deckId, next)
  }

  if (session.idleTimer) clearTimeout(session.idleTimer)
  session.idleTimer = setTimeout(() => endJogSession(deckId), JOG_IDLE_MS)
}
