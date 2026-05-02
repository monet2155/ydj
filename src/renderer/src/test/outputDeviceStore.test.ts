import { describe, it, expect, beforeEach } from 'vitest'
import { pickFallbackDeviceId, findDeviceIdByLabel, STORAGE_KEY } from '../store/outputDeviceStore'

describe('pickFallbackDeviceId', () => {
  it("returns the same id when device is still present", () => {
    const devs = [{ deviceId: 'abc' }, { deviceId: 'def' }] as MediaDeviceInfo[]
    expect(pickFallbackDeviceId('abc', devs)).toBe('abc')
  })

  it("returns 'default' when device is missing", () => {
    const devs = [{ deviceId: 'abc' }] as MediaDeviceInfo[]
    expect(pickFallbackDeviceId('missing', devs)).toBe('default')
  })

  it("'default' is always considered present", () => {
    expect(pickFallbackDeviceId('default', [])).toBe('default')
  })
})

describe('outputDeviceStore — persistence', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })

  it('storage key is namespaced and versioned', () => {
    expect(STORAGE_KEY).toMatch(/^ydj\.audioOutputs\./)
  })
})

describe('findDeviceIdByLabel', () => {
  const devs = [
    { deviceId: '1', label: 'MacBook Pro Speakers' },
    { deviceId: '2', label: 'Numark Party Mix MKII' },
    { deviceId: '3', label: 'AirPods Pro' }
  ] as MediaDeviceInfo[]

  it('case-insensitive match by substring', () => {
    expect(findDeviceIdByLabel(devs, 'party mix')).toBe('2')
    expect(findDeviceIdByLabel(devs, 'AIRPODS')).toBe('3')
  })

  it('returns null when no match', () => {
    expect(findDeviceIdByLabel(devs, 'pioneer')).toBeNull()
  })
})
