import { describe, it, expect } from 'vitest'
import { computeSyncRate } from '../midi/actions'

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
