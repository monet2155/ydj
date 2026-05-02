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

// ─── Jog: Serato-style touch-to-freeze + scratch / pitch-bend ──
//
// Party Mix MKII가 보내는 메시지:
//   NoteOn  ch=N d1=6 = 잡 위 터치 다운
//   NoteOff ch=N d1=6 = 터치 업
//   CC      ch=N d1=6 = 회전 tick (sign-magnitude d2)
//
// 동작:
//   터치 다운        → scratch 세션 시작. 재생 중이면 즉시 rate=0 (음악 정지).
//   터치 중 회전     → scratch. 마지막 tick 후 ~80ms 무동작이면 rate=0으로 복귀(그 자리에 멈춤).
//   터치 업          → 세션을 곧장 끝내지 않고 "released" 표시. 회전이 계속되면 scratch 유지.
//   터치 업 + 무동작 → ~400ms 뒤 세션 종료, 원래 rate/play 복원.
//   터치 다시 다운   → "released" 해제, 다시 freeze.
//   터치 없이 회전   → 가벼운 pitch bend.
const JOG_TICK_SEC = 0.03
const JOG_FREEZE_AFTER_MS = 80    // 터치 중 무동작 → rate=0
const JOG_END_AFTER_MS = 400      // 터치 떼고 회전도 멈춘 뒤 → 세션 종료
const JOG_MAX_RATE = 8
const PITCH_BEND_AMOUNT = 0.04
const PITCH_BEND_DECAY_MS = 120

interface JogSession {
  wasPlaying: boolean
  released: boolean
  lastTickTime: number
  freezeTimer: ReturnType<typeof setTimeout> | null  // 터치 중 무동작 → rate=0
  endTimer: ReturnType<typeof setTimeout> | null    // 떼고 무동작 → 세션 종료
}

const jogSessions: Record<DeckId, JogSession | null> = { A: null, B: null }
const bendTimers: Record<DeckId, ReturnType<typeof setTimeout> | null> = { A: null, B: null }
const bendBaseline: Record<DeckId, number> = { A: 1, B: 1 }

function clearJogTimers(s: JogSession): void {
  if (s.freezeTimer) clearTimeout(s.freezeTimer)
  if (s.endTimer) clearTimeout(s.endTimer)
  s.freezeTimer = null
  s.endTimer = null
}

function endJogSession(deckId: DeckId): void {
  const session = jogSessions[deckId]
  if (!session) return
  clearJogTimers(session)
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

function scheduleFreezeAfterIdle(deckId: DeckId, session: JogSession): void {
  if (session.freezeTimer) clearTimeout(session.freezeTimer)
  session.freezeTimer = setTimeout(() => {
    getDeckEngine(deckId).playbackRate = 0
    session.freezeTimer = null
  }, JOG_FREEZE_AFTER_MS)
}

function scheduleEndAfterIdle(deckId: DeckId, session: JogSession): void {
  if (session.endTimer) clearTimeout(session.endTimer)
  session.endTimer = setTimeout(() => endJogSession(deckId), JOG_END_AFTER_MS)
}

export function jogTouchStart(deckId: DeckId): void {
  const existing = jogSessions[deckId]
  if (existing) {
    clearJogTimers(existing)
    existing.released = false
    if (existing.wasPlaying) getDeckEngine(deckId).playbackRate = 0
    return
  }
  const engine = getDeckEngine(deckId)
  const wasPlaying = engine.isPlaying
  jogSessions[deckId] = {
    wasPlaying,
    released: false,
    lastTickTime: performance.now(),
    freezeTimer: null,
    endTimer: null
  }
  if (wasPlaying) engine.playbackRate = 0
}

export function jogTouchEnd(deckId: DeckId): void {
  const session = jogSessions[deckId]
  if (!session) return
  session.released = true
  scheduleEndAfterIdle(deckId, session)
}

function pitchBendTick(deckId: DeckId, direction: 1 | -1): void {
  const baseline = useDeckStore.getState().decks[deckId].playbackRate
  if (bendTimers[deckId] === null) bendBaseline[deckId] = baseline
  const bent = bendBaseline[deckId] * (1 + direction * PITCH_BEND_AMOUNT)
  getDeckEngine(deckId).playbackRate = bent
  if (bendTimers[deckId]) clearTimeout(bendTimers[deckId]!)
  bendTimers[deckId] = setTimeout(() => {
    getDeckEngine(deckId).playbackRate = bendBaseline[deckId]
    bendTimers[deckId] = null
  }, PITCH_BEND_DECAY_MS)
}

export function jogStep(deckId: DeckId, direction: 1 | -1): void {
  const deck = useDeckStore.getState().decks[deckId]
  if (!deck.track) return

  const session = jogSessions[deckId]
  if (!session) {
    if (deck.isPlaying) pitchBendTick(deckId, direction)
    return
  }

  const engine = getDeckEngine(deckId)
  const now = performance.now()
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

  scheduleFreezeAfterIdle(deckId, session)
  if (session.released) scheduleEndAfterIdle(deckId, session)
}
