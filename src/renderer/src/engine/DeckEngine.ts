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
  private buffer: AudioBuffer | null = null

  // Tracking playback position
  private startOffset = 0       // position when play() was called
  private startTime = 0         // ctx.currentTime when play() was called
  private _isPlaying = false
  private _playbackRate = 1
  private _volume = 1

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.gainNode = ctx.createGain()
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
    this.source.connect(this.gainNode)
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
