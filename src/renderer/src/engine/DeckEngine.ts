/**
 * DeckEngine — per-deck Web Audio node graph
 *
 * Graph:
 *   AudioBufferSourceNode (playbackRate)
 *     → GainNode (volume)
 *     → [MixerEngine input]
 */
export class DeckEngine {
  private ctx: AudioContext
  private source: AudioBufferSourceNode | null = null
  private gainNode: GainNode
  private eqLowNode: BiquadFilterNode
  private eqMidNode: BiquadFilterNode
  private eqHighNode: BiquadFilterNode
  private buffer: AudioBuffer | null = null

  // Tracking playback position
  private startOffset = 0       // position when play() was called
  private startTime = 0         // ctx.currentTime when play() was called
  private _isPlaying = false
  private _playbackRate = 1
  private _volume = 1

  // Loop
  private _loopStart: number | null = null
  private _loopEnd: number | null = null
  private _loopActive = false
  private loopRafId = 0

  constructor(ctx: AudioContext) {
    this.ctx = ctx

    this.eqLowNode = ctx.createBiquadFilter()
    this.eqLowNode.type = 'lowshelf'
    this.eqLowNode.frequency.value = 80

    this.eqMidNode = ctx.createBiquadFilter()
    this.eqMidNode.type = 'peaking'
    this.eqMidNode.frequency.value = 1000
    this.eqMidNode.Q.value = 0.5

    this.eqHighNode = ctx.createBiquadFilter()
    this.eqHighNode.type = 'highshelf'
    this.eqHighNode.frequency.value = 10000

    this.gainNode = ctx.createGain()

    // Chain: eq filters → gain → destination (mixer will re-route gain)
    this.eqLowNode.connect(this.eqMidNode)
    this.eqMidNode.connect(this.eqHighNode)
    this.eqHighNode.connect(this.gainNode)
    this.gainNode.connect(ctx.destination)
  }

  // ── Public readonly state ──────────────────────────────────────────────────

  get isPlaying(): boolean {
    return this._isPlaying
  }

  get duration(): number {
    return this.buffer?.duration ?? 0
  }

  get position(): number {
    if (!this._isPlaying) return this.startOffset
    const elapsed = (this.ctx.currentTime - this.startTime) * this._playbackRate
    return Math.min(this.startOffset + elapsed, this.duration)
  }

  // ── Mutable properties ─────────────────────────────────────────────────────

  get playbackRate(): number {
    return this._playbackRate
  }

  set playbackRate(rate: number) {
    if (this._isPlaying) {
      // Save current position before changing rate
      this.startOffset = this.position
      this.startTime = this.ctx.currentTime
    }
    this._playbackRate = rate
    if (this.source) {
      this.source.playbackRate.value = rate
    }
  }

  get volume(): number {
    return this._volume
  }

  set volume(v: number) {
    this._volume = v
    this.gainNode.gain.value = v
  }

  // ── Loop ───────────────────────────────────────────────────────────────────

  get loopActive(): boolean { return this._loopActive }
  get loopStart(): number | null { return this._loopStart }
  get loopEnd(): number | null { return this._loopEnd }

  setLoop(start: number, end: number): void {
    this._loopStart = start
    this._loopEnd = end
  }

  activateLoop(start: number, end: number): void {
    this._loopStart = start
    this._loopEnd = end
    this._loopActive = true
    this._tickLoop()
  }

  deactivateLoop(): void {
    this._loopActive = false
    cancelAnimationFrame(this.loopRafId)
  }

  private _tickLoop(): void {
    if (!this._loopActive || this._loopStart === null || this._loopEnd === null) return
    if (this.position >= this._loopEnd) {
      this.seek(this._loopStart)
    }
    this.loopRafId = requestAnimationFrame(() => this._tickLoop())
  }

  // ── EQ ─────────────────────────────────────────────────────────────────────

  setEq(band: 'low' | 'mid' | 'high', db: number): void {
    const node = band === 'low' ? this.eqLowNode : band === 'mid' ? this.eqMidNode : this.eqHighNode
    node.gain.value = Math.max(-40, Math.min(6, db))
  }

  setEqKill(band: 'low' | 'mid' | 'high', kill: boolean): void {
    this.setEq(band, kill ? -40 : 0)
  }

  // ── Output node (for MixerEngine to connect to) ───────────────────────────

  get outputNode(): GainNode {
    return this.gainNode
  }

  // ── Transport ──────────────────────────────────────────────────────────────

  load(buffer: AudioBuffer): void {
    this.stop()
    this.buffer = buffer
    this.startOffset = 0
  }

  play(): void {
    if (!this.buffer || this._isPlaying) return

    this.source = this.ctx.createBufferSource()
    this.source.buffer = this.buffer
    this.source.playbackRate.value = this._playbackRate
    this.source.connect(this.eqLowNode)
    this.source.start(0, this.startOffset)

    this.startTime = this.ctx.currentTime
    this._isPlaying = true

    this.source.onended = () => {
      // Only update state if this source is still the active one
      if (this._isPlaying) {
        this._isPlaying = false
        this.startOffset = 0
      }
    }
  }

  pause(): void {
    if (!this._isPlaying) return
    this.startOffset = this.position
    this._stop()
    this._isPlaying = false
  }

  stop(): void {
    this.startOffset = 0
    this._stop()
    this._isPlaying = false
  }

  seek(seconds: number): void {
    const wasPlaying = this._isPlaying
    if (wasPlaying) this._stop()
    this.startOffset = Math.max(0, Math.min(seconds, this.duration))
    this._isPlaying = false
    if (wasPlaying) this.play()
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _stop(): void {
    if (this.source) {
      try { this.source.stop() } catch { /* already stopped */ }
      this.source.disconnect()
      this.source = null
    }
  }
}
