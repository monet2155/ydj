/**
 * FxEngine — 4-slot FX chain inserted between DeckEngine's EQ output and volume fader.
 *
 * Chain:
 *   deck.fxInput → [filter] → [delay] → [reverb] → [flanger] → deck.fxOutput
 *
 * Each slot uses wet/dry mixing so disabling an FX is a pure pass-through.
 */
import type { DeckEngine } from './DeckEngine.js'

export type FilterMode = 'lpf' | 'hpf'

/** Wet/dry parallel wrapper around any AudioNode */
class FxSlot {
  readonly input: GainNode
  readonly output: GainNode
  private readonly dryGain: GainNode
  private readonly wetGain: GainNode

  constructor(ctx: AudioContext, fxNode: AudioNode) {
    this.input = ctx.createGain()
    this.output = ctx.createGain()
    this.dryGain = ctx.createGain()
    this.wetGain = ctx.createGain()
    this.dryGain.gain.value = 1
    this.wetGain.gain.value = 0

    this.input.connect(this.dryGain)
    this.input.connect(fxNode)
    this.dryGain.connect(this.output)
    fxNode.connect(this.wetGain)
    this.wetGain.connect(this.output)
  }

  apply(ctx: AudioContext, enabled: boolean, wet: number): void {
    const w = enabled ? Math.max(0, Math.min(1, wet)) : 0
    const t = ctx.currentTime
    this.wetGain.gain.setTargetAtTime(w, t, 0.008)
    this.dryGain.gain.setTargetAtTime(1 - w, t, 0.008)
  }
}

function generateReverbIR(ctx: AudioContext, decaySeconds: number): AudioBuffer {
  const rate = ctx.sampleRate
  const length = Math.floor(rate * Math.max(0.3, Math.min(5, decaySeconds)))
  const impulse = ctx.createBuffer(2, length, rate)
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3)
    }
  }
  return impulse
}

export class FxEngine {
  private ctx: AudioContext

  // Filter
  private filterSlot: FxSlot
  private filterNode: BiquadFilterNode

  // Delay
  private delaySlot: FxSlot
  private delayNode: DelayNode
  private delayFeedback: GainNode

  // Reverb
  private reverbSlot: FxSlot
  private reverbNode: ConvolverNode

  // Flanger
  private flangerSlot: FxSlot
  private flangerDelay: DelayNode
  private flangerLfo: OscillatorNode
  private flangerLfoGain: GainNode
  private flangerFeedback: GainNode

  constructor(ctx: AudioContext, deck: DeckEngine) {
    this.ctx = ctx

    // ── Filter ──────────────────────────────────────────────────────────────
    this.filterNode = ctx.createBiquadFilter()
    this.filterNode.type = 'lowpass'
    this.filterNode.frequency.value = 20000
    this.filterNode.Q.value = 0.7
    this.filterSlot = new FxSlot(ctx, this.filterNode)

    // ── Delay / Echo ────────────────────────────────────────────────────────
    this.delayNode = ctx.createDelay(1.0)
    this.delayNode.delayTime.value = 0.3
    this.delayFeedback = ctx.createGain()
    this.delayFeedback.gain.value = 0.35
    this.delayNode.connect(this.delayFeedback)
    this.delayFeedback.connect(this.delayNode)
    this.delaySlot = new FxSlot(ctx, this.delayNode)

    // ── Reverb ───────────────────────────────────────────────────────────────
    this.reverbNode = ctx.createConvolver()
    this.reverbNode.buffer = generateReverbIR(ctx, 2.0)
    this.reverbSlot = new FxSlot(ctx, this.reverbNode)

    // ── Flanger ──────────────────────────────────────────────────────────────
    this.flangerDelay = ctx.createDelay(0.02)
    this.flangerDelay.delayTime.value = 0.005
    this.flangerLfo = ctx.createOscillator()
    this.flangerLfo.type = 'sine'
    this.flangerLfo.frequency.value = 0.3
    this.flangerLfoGain = ctx.createGain()
    this.flangerLfoGain.gain.value = 0.003
    this.flangerFeedback = ctx.createGain()
    this.flangerFeedback.gain.value = 0.7
    this.flangerLfo.connect(this.flangerLfoGain)
    this.flangerLfoGain.connect(this.flangerDelay.delayTime)
    this.flangerDelay.connect(this.flangerFeedback)
    this.flangerFeedback.connect(this.flangerDelay)
    this.flangerLfo.start()
    this.flangerSlot = new FxSlot(ctx, this.flangerDelay)

    // ── Wire chain into deck ─────────────────────────────────────────────────
    deck.fxInput.disconnect(deck.fxOutput)
    deck.fxInput.connect(this.filterSlot.input)
    this.filterSlot.output.connect(this.delaySlot.input)
    this.delaySlot.output.connect(this.reverbSlot.input)
    this.reverbSlot.output.connect(this.flangerSlot.input)
    this.flangerSlot.output.connect(deck.fxOutput)
  }

  setFilter(enabled: boolean, wet: number, param: number, mode: FilterMode): void {
    this.filterNode.type = mode === 'lpf' ? 'lowpass' : 'highpass'
    // param 0→1: LPF sweeps 200Hz→20kHz, HPF sweeps 8kHz→200Hz
    const freq = mode === 'lpf'
      ? 200 * Math.pow(100, param)
      : 8000 * Math.pow(1 / 40, param)
    this.filterNode.frequency.setTargetAtTime(Math.max(20, freq), this.ctx.currentTime, 0.008)
    this.filterSlot.apply(this.ctx, enabled, wet)
  }

  setDelay(enabled: boolean, wet: number, param: number): void {
    // param 0→1 → delay 0.1→0.8s
    const delayTime = 0.1 + param * 0.7
    this.delayNode.delayTime.setTargetAtTime(delayTime, this.ctx.currentTime, 0.05)
    this.delaySlot.apply(this.ctx, enabled, wet)
  }

  setReverb(enabled: boolean, wet: number, param: number): void {
    // param 0→1 → room size 0.5→4.5s (only recreates IR, no automation)
    if (enabled) {
      const decaySeconds = 0.5 + param * 4
      this.reverbNode.buffer = generateReverbIR(this.ctx, decaySeconds)
    }
    this.reverbSlot.apply(this.ctx, enabled, wet)
  }

  setFlanger(enabled: boolean, wet: number, param: number): void {
    // param 0→1 → LFO rate 0.1→6Hz
    const rate = 0.1 + param * 5.9
    this.flangerLfo.frequency.setTargetAtTime(rate, this.ctx.currentTime, 0.05)
    this.flangerSlot.apply(this.ctx, enabled, wet)
  }
}
