import { describe, it, expect } from 'vitest'
import { computeSyncRate, computeFilterFromKnob, nextFxTimeDivision } from '../midi/actions'

describe('computeSyncRate', () => {
  it('matches master effective BPM (master at 120, this at 100, rate 1) → 1.2', () => {
    expect(computeSyncRate(100, 120, 1)).toBeCloseTo(1.2, 5)
  })

  it('respects master playbackRate (master 120 @1.05 = 126, this 100) → 1.26', () => {
    expect(computeSyncRate(100, 120, 1.05)).toBeCloseTo(1.26, 5)
  })

  it('returns null when this BPM unknown', () => {
    expect(computeSyncRate(null, 120, 1)).toBeNull()
  })

  it('returns null when master BPM unknown', () => {
    expect(computeSyncRate(100, null, 1)).toBeNull()
  })

  it('returns 1 when BPMs already equal at master rate 1', () => {
    expect(computeSyncRate(128, 128, 1)).toBeCloseTo(1, 5)
  })
})

describe('computeFilterFromKnob', () => {
  it('center → disabled', () => {
    expect(computeFilterFromKnob(0.5).enabled).toBe(false)
  })

  it('within deadzone of center → disabled', () => {
    expect(computeFilterFromKnob(0.51).enabled).toBe(false)
    expect(computeFilterFromKnob(0.49).enabled).toBe(false)
  })

  it('left half → LPF, right half → HPF', () => {
    expect(computeFilterFromKnob(0.2).mode).toBe('lpf')
    expect(computeFilterFromKnob(0.8).mode).toBe('hpf')
  })

  it('full left/right → param=0 (max filter), enabled', () => {
    expect(computeFilterFromKnob(0)).toMatchObject({ enabled: true, mode: 'lpf', param: 0 })
    expect(computeFilterFromKnob(1)).toMatchObject({ enabled: true, mode: 'hpf', param: 0 })
  })

  it('quarter from center → param ≈ 0.5', () => {
    expect(computeFilterFromKnob(0.25).param).toBeCloseTo(0.5, 5)
    expect(computeFilterFromKnob(0.75).param).toBeCloseTo(0.5, 5)
  })
})

describe('nextFxTimeDivision', () => {
  it('cycles 1/16 → 1/8 → 1/4 → 1/2 → 1 → 2 → 4 → 8 → 1/16', () => {
    expect(nextFxTimeDivision(1 / 16)).toBe(1 / 8)
    expect(nextFxTimeDivision(1 / 8)).toBe(1 / 4)
    expect(nextFxTimeDivision(8)).toBe(1 / 16)
  })

  it('falls back to 1/8 (next from 1/16) when current is unknown', () => {
    expect(nextFxTimeDivision(0.123456)).toBe(1 / 8)
  })
})
