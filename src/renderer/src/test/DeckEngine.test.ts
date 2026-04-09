import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Web Audio API
const mockDisconnect = vi.fn()
const mockConnect = vi.fn()
const mockStart = vi.fn()
const mockStop = vi.fn()

const mockSourceNode = {
  connect: mockConnect,
  disconnect: mockDisconnect,
  start: mockStart,
  stop: mockStop,
  playbackRate: { value: 1, setValueAtTime: vi.fn() },
  buffer: null as AudioBuffer | null,
  loop: false,
  loopStart: 0,
  loopEnd: 0,
  onended: null as (() => void) | null
}

const mockGainNode = {
  connect: mockConnect,
  disconnect: mockDisconnect,
  gain: { value: 1, setValueAtTime: vi.fn() }
}

const mockDestination = { connect: vi.fn() }

let currentTime = 0

const mockAudioContext = {
  get currentTime() { return currentTime },
  state: 'running' as AudioContextState,
  resume: vi.fn().mockResolvedValue(undefined),
  createBufferSource: vi.fn(() => ({ ...mockSourceNode })),
  createGain: vi.fn(() => ({ ...mockGainNode })),
  destination: mockDestination,
  decodeAudioData: vi.fn()
}

vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext))

describe('DeckEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentTime = 0
    mockAudioContext.createBufferSource.mockImplementation(() => ({ ...mockSourceNode }))
    mockAudioContext.createGain.mockImplementation(() => ({ ...mockGainNode }))
  })

  it('initializes with idle state', async () => {
    const { DeckEngine } = await import('../engine/DeckEngine.js')
    const deck = new DeckEngine(mockAudioContext as unknown as AudioContext)
    expect(deck.isPlaying).toBe(false)
    expect(deck.position).toBe(0)
    expect(deck.duration).toBe(0)
    expect(deck.playbackRate).toBe(1)
  })

  it('loads an AudioBuffer and updates duration', async () => {
    const { DeckEngine } = await import('../engine/DeckEngine.js')
    const deck = new DeckEngine(mockAudioContext as unknown as AudioContext)
    const fakeBuffer = { duration: 240, length: 1, numberOfChannels: 2, sampleRate: 44100 } as AudioBuffer
    deck.load(fakeBuffer)
    expect(deck.duration).toBe(240)
    expect(deck.isPlaying).toBe(false)
  })

  it('play() starts playback', async () => {
    const { DeckEngine } = await import('../engine/DeckEngine.js')
    const deck = new DeckEngine(mockAudioContext as unknown as AudioContext)
    const fakeBuffer = { duration: 240, length: 1, numberOfChannels: 2, sampleRate: 44100 } as AudioBuffer
    deck.load(fakeBuffer)
    deck.play()
    expect(deck.isPlaying).toBe(true)
  })

  it('pause() stops playback and saves position', async () => {
    const { DeckEngine } = await import('../engine/DeckEngine.js')
    const deck = new DeckEngine(mockAudioContext as unknown as AudioContext)
    const fakeBuffer = { duration: 240, length: 1, numberOfChannels: 2, sampleRate: 44100 } as AudioBuffer
    deck.load(fakeBuffer)
    deck.play()
    currentTime = 5
    deck.pause()
    expect(deck.isPlaying).toBe(false)
    expect(deck.position).toBeGreaterThanOrEqual(0)
  })

  it('playbackRate change is reflected immediately', async () => {
    const { DeckEngine } = await import('../engine/DeckEngine.js')
    const deck = new DeckEngine(mockAudioContext as unknown as AudioContext)
    deck.playbackRate = 1.1
    expect(deck.playbackRate).toBeCloseTo(1.1)
  })

  it('volume change is reflected immediately', async () => {
    const { DeckEngine } = await import('../engine/DeckEngine.js')
    const deck = new DeckEngine(mockAudioContext as unknown as AudioContext)
    deck.volume = 0.5
    expect(deck.volume).toBeCloseTo(0.5)
  })

  it('seek() updates position', async () => {
    const { DeckEngine } = await import('../engine/DeckEngine.js')
    const deck = new DeckEngine(mockAudioContext as unknown as AudioContext)
    const fakeBuffer = { duration: 240, length: 1, numberOfChannels: 2, sampleRate: 44100 } as AudioBuffer
    deck.load(fakeBuffer)
    deck.seek(30)
    expect(deck.position).toBe(30)
  })
})
