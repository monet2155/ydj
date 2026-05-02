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
  private preVolumeTap: GainNode
  private eqLowNode: BiquadFilterNode
  private eqMidNode: BiquadFilterNode
  private eqHighNode: BiquadFilterNode
  private buffer: AudioBuffer | null = null
  private reverseBuffer: AudioBuffer | null = null

  // Tracking playback position
  private startOffset = 0       // position when play() was called
  private startTime = 0         // ctx.currentTime when play() was called
  private _isPlaying = false
  private _isReverse = false
  private _directionSwitching = false
  private _playbackRate = 1
  private _volume = 1
  private _onEnded: (() => void) | null = null

  // Loop
  private _loopStart: number | null = null
  private _loopEnd: number | null = null
  private _loopActive = false
  private loopRafId = 0
  private loopTimerId = 0

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
    // Pre-fader tap. PFL/cue 분기와 FX 체인의 종착점이 여기를 공유한다 (post-EQ post-FX, pre-fader).
    // gain 1로 고정 — 이 노드는 수정하지 말 것. 분기는 MixerEngine이 추가한다.
    this.preVolumeTap = ctx.createGain()

    // Chain: eq filters → preVolumeTap → fader (gain) → destination (mixer will re-route gain)
    this.eqLowNode.connect(this.eqMidNode)
    this.eqMidNode.connect(this.eqHighNode)
    this.eqHighNode.connect(this.preVolumeTap)
    this.preVolumeTap.connect(this.gainNode)
    this.gainNode.connect(ctx.destination)
  }

  // ── Public readonly state ──────────────────────────────────────────────────

  get isPlaying(): boolean {
    return this._isPlaying
  }

  get duration(): number {
    return this.buffer?.duration ?? 0
  }

  get isReverse(): boolean {
    return this._isReverse
  }

  get position(): number {
    if (!this._isPlaying) return this.startOffset
    const elapsed = (this.ctx.currentTime - this.startTime) * this._playbackRate
    if (this._isReverse) {
      return Math.max(0, this.startOffset - elapsed)
    }
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
    clearTimeout(this.loopTimerId)
    cancelAnimationFrame(this.loopRafId)
    this._loopStart = start
    this._loopEnd = end
    this._loopActive = true
    this._tickLoop()
  }

  deactivateLoop(): void {
    this._loopActive = false
    clearTimeout(this.loopTimerId)
    cancelAnimationFrame(this.loopRafId)
  }

  private _tickLoop(): void {
    if (!this._loopActive || this._loopStart === null || this._loopEnd === null) return

    const remaining = this._loopEnd - this.position
    if (remaining <= 0) {
      this.seek(this._loopStart)
      this.loopRafId = requestAnimationFrame(() => this._tickLoop())
      return
    }

    // Sleep until 50ms before loop end, then switch to rAF for precision
    const sleepMs = remaining * 1000 - 50
    if (sleepMs > 50) {
      this.loopTimerId = window.setTimeout(() => {
        this.loopRafId = requestAnimationFrame(() => this._tickLoop())
      }, sleepMs)
    } else {
      this.loopRafId = requestAnimationFrame(() => this._tickLoop())
    }
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

  /** Called when the track naturally finishes playing (not on pause/stop/seek) */
  set onEnded(cb: (() => void) | null) {
    this._onEnded = cb
  }

  // ── FX insert points (FxEngine rewires between these) ─────────────────────

  /** Signal source before the volume fader — FxEngine disconnects this from fxOutput */
  get fxInput(): BiquadFilterNode {
    return this.eqHighNode
  }

  /** FX chain's final output connects here. Also the pre-fader tap point used by
   *  MixerEngine for the cue (PFL) bus. Volume fader (gainNode) reads from here. */
  get fxOutput(): GainNode {
    return this.preVolumeTap
  }

  // ── Transport ──────────────────────────────────────────────────────────────

  load(buffer: AudioBuffer): void {
    this.stop()
    this.buffer = buffer
    this._isReverse = false
    this.startOffset = 0
    this.reverseBuffer = DeckEngine.createReverseBuffer(buffer)
  }

  /** Create a reversed copy of an AudioBuffer (channel data reversed in time). */
  private static createReverseBuffer(buffer: AudioBuffer): AudioBuffer {
    const reversed = new AudioBuffer({
      numberOfChannels: buffer.numberOfChannels,
      length: buffer.length,
      sampleRate: buffer.sampleRate
    })
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const src = buffer.getChannelData(c)
      const dst = reversed.getChannelData(c)
      for (let i = 0; i < src.length; i++) {
        dst[i] = src[src.length - 1 - i]
      }
    }
    return reversed
  }

  play(): void {
    if (!this.buffer || this._isPlaying) return

    const source = this.ctx.createBufferSource()
    if (this._isReverse && this.reverseBuffer) {
      // Play reverseBuffer from the mirrored position so audio travels backward.
      // reverseBuffer[0] corresponds to forward position duration, so:
      //   reverseBuffer offset = duration - startOffset
      source.buffer = this.reverseBuffer
      source.start(0, this.duration - this.startOffset)
    } else {
      source.buffer = this.buffer
      source.start(0, this.startOffset)
    }
    source.playbackRate.value = this._playbackRate
    source.connect(this.eqLowNode)
    this.source = source

    this.startTime = this.ctx.currentTime
    this._isPlaying = true

    // Capture source in closure — only update state if THIS source is still active.
    // Without this, a stale onended from an old source (e.g. mid-loop seek) would
    // reset _isPlaying on the newly started source.
    source.onended = () => {
      if (this.source === source && this._isPlaying) {
        this._isPlaying = false
        this.startOffset = 0
        if (this._isReverse) {
          // Reached position 0 during reverse playback — reset to forward mode.
          // Don't fire _onEnded: we hit the beginning, not the end of the track.
          this._isReverse = false
        } else {
          this._onEnded?.()
        }
      }
    }
  }

  /**
   * Switch playback direction with a brief gain crossfade to suppress click noise.
   * If direction is unchanged, only the rate is updated.
   */
  setDirection(reverse: boolean, rate: number): void {
    if (this._isReverse === reverse || this._directionSwitching) {
      // Same direction or switch already in progress — just update rate
      this.playbackRate = rate
      return
    }

    if (!this._isPlaying) {
      this._isReverse = reverse
      this._playbackRate = rate
      return
    }

    const currentPos = this.position
    const t = this.ctx.currentTime

    // Fade to silence, swap buffer, fade back in (≈15ms total)
    this._directionSwitching = true
    this.gainNode.gain.cancelScheduledValues(t)
    this.gainNode.gain.setTargetAtTime(0, t, 0.004)

    setTimeout(() => {
      this._isReverse = reverse
      this._playbackRate = rate
      this.startOffset = currentPos
      this._stop()
      this._isPlaying = false
      this.play()
      this._directionSwitching = false
      const t2 = this.ctx.currentTime
      this.gainNode.gain.cancelScheduledValues(t2)
      this.gainNode.gain.setTargetAtTime(this._volume, t2, 0.004)
    }, 15)
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
    this._isReverse = false
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
