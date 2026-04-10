import type { DeckEngine } from './DeckEngine.js'

/**
 * MixerEngine — connects two decks to master output
 *
 * Graph:
 *   DeckA.outputNode → masterGainA ─┐
 *                                    → ctx.destination
 *   DeckB.outputNode → masterGainB ─┘
 */
export class MixerEngine {
  private ctx: AudioContext
  private masterGainA: GainNode
  private masterGainB: GainNode
  private masterGain: GainNode

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.masterGainA = ctx.createGain()
    this.masterGainB = ctx.createGain()
    this.masterGain = ctx.createGain()

    this.masterGainA.connect(this.masterGain)
    this.masterGainB.connect(this.masterGain)
    this.masterGain.connect(ctx.destination)
  }

  connectDeck(deck: DeckEngine, side: 'A' | 'B'): void {
    const target = side === 'A' ? this.masterGainA : this.masterGainB
    // Disconnect deck from default destination, connect to mixer
    deck.outputNode.disconnect()
    deck.outputNode.connect(target)
  }

  /**
   * crossfader: 0 = full A, 0.5 = equal, 1 = full B
   * Constant-power (cos/sin) curve — no center dip
   */
  setCrossfader(value: number): void {
    const v = Math.max(0, Math.min(1, value))
    const angle = v * Math.PI / 2
    this.masterGainA.gain.value = Math.cos(angle)
    this.masterGainB.gain.value = Math.sin(angle)
  }

  setMasterVolume(value: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, value))
  }
}
