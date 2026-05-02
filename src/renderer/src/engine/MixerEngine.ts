import type { DeckEngine } from './DeckEngine.js'

/**
 * MixerEngine — connects two decks to master output, plus a cue (PFL) bus
 *
 * Master path (unchanged from earlier design):
 *   DeckA.outputNode → masterGainA ─┐
 *                                    ├→ masterGain → ctx.destination
 *   DeckB.outputNode → masterGainB ─┘
 *
 * Cue path (added):
 *   DeckA.fxOutput (preVolumeTap) → cueSendA ─┐
 *   DeckB.fxOutput (preVolumeTap) → cueSendB ─┤
 *   masterGain output            → masterToCue ─┤── cueBus → cueGain → cueOutDest (MediaStream)
 *
 * cueSend{A,B}.gain ∈ {0, 1} reflects per-deck PFL state.
 * masterToCue.gain  ∈ [0,1] is the cue mix (0 = cue only, 1 = master only).
 * cueGain.gain      ∈ [0,1] is the headphone master volume.
 *
 * cueOutDest.stream is meant to be assigned to a hidden <audio> element with
 * setSinkId(headphoneDeviceId).
 *
 * Master output is structurally invariant of any cue node state — cue nodes only
 * tap signal; they do not modify the master path.
 */
export class MixerEngine {
  private ctx: AudioContext
  private masterGainA: GainNode
  private masterGainB: GainNode
  private masterGain: GainNode

  // ── Cue (PFL) bus ────────────────────────────────────────────
  private cueSendA: GainNode
  private cueSendB: GainNode
  private masterToCue: GainNode
  private cueBus: GainNode
  private cueGainNode: GainNode
  private cueOutDest: MediaStreamAudioDestinationNode

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.masterGainA = ctx.createGain()
    this.masterGainB = ctx.createGain()
    this.masterGain = ctx.createGain()

    this.masterGainA.connect(this.masterGain)
    this.masterGainB.connect(this.masterGain)
    this.masterGain.connect(ctx.destination)

    // Cue bus
    this.cueSendA = ctx.createGain()
    this.cueSendB = ctx.createGain()
    this.cueSendA.gain.value = 0
    this.cueSendB.gain.value = 0
    this.masterToCue = ctx.createGain()
    this.masterToCue.gain.value = 0.5  // default cue mix
    this.cueBus = ctx.createGain()
    this.cueGainNode = ctx.createGain()
    this.cueGainNode.gain.value = 1  // default cue volume
    this.cueOutDest = ctx.createMediaStreamDestination()

    this.cueSendA.connect(this.cueBus)
    this.cueSendB.connect(this.cueBus)
    this.masterGain.connect(this.masterToCue)
    this.masterToCue.connect(this.cueBus)
    this.cueBus.connect(this.cueGainNode)
    this.cueGainNode.connect(this.cueOutDest)
  }

  connectDeck(deck: DeckEngine, side: 'A' | 'B'): void {
    const target = side === 'A' ? this.masterGainA : this.masterGainB
    const cueSend = side === 'A' ? this.cueSendA : this.cueSendB

    // Master path: deck's post-fader output to its master gain.
    deck.outputNode.disconnect()
    deck.outputNode.connect(target)

    // Cue path: deck's pre-fader tap (post-EQ post-FX) to its cue send.
    // Note: deck.fxOutput is the preVolumeTap. It already feeds the volume fader
    // (gainNode) inside DeckEngine; adding another connection here just taps it,
    // it does NOT alter the master path.
    deck.fxOutput.connect(cueSend)
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

  // ── Cue controls ─────────────────────────────────────────────

  setCueEnabled(side: 'A' | 'B', on: boolean): void {
    const node = side === 'A' ? this.cueSendA : this.cueSendB
    node.gain.value = on ? 1 : 0
  }

  /** 0..1 — overall headphone volume */
  setCueGain(value: number): void {
    this.cueGainNode.gain.value = Math.max(0, Math.min(1, value))
  }

  /** 0 = cue only in headphone, 1 = master only in headphone */
  setCueMix(value: number): void {
    this.masterToCue.gain.value = Math.max(0, Math.min(1, value))
  }

  /** MediaStream that should be played through the headphone output device. */
  get cueStream(): MediaStream {
    return this.cueOutDest.stream
  }
}
