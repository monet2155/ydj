import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Web Audio API (not available in jsdom)
const mockGainNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 1, setValueAtTime: vi.fn() }
}

vi.stubGlobal('AudioContext', vi.fn(() => ({
  state: 'running',
  currentTime: 0,
  resume: vi.fn().mockResolvedValue(undefined),
  createGain: vi.fn(() => ({ ...mockGainNode })),
  createBufferSource: vi.fn(() => ({
    connect: vi.fn(), disconnect: vi.fn(),
    start: vi.fn(), stop: vi.fn(),
    playbackRate: { value: 1, setValueAtTime: vi.fn() },
    buffer: null, loop: false, onended: null
  })),
  destination: { connect: vi.fn() },
  decodeAudioData: vi.fn()
})))

// Mock electronAPI
vi.stubGlobal('electronAPI', {
  youtube: {
    download: vi.fn().mockResolvedValue({ success: false, error: 'mock' }),
    onProgress: vi.fn(() => () => {})
  },
  audio: {
    readFile: vi.fn().mockResolvedValue(null)
  }
})
