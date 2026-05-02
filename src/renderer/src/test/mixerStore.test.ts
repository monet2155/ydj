import { describe, it, expect, beforeEach } from 'vitest'
import { useMixerStore } from '../store/mixerStore'

describe('mixerStore — cue state', () => {
  beforeEach(() => {
    useMixerStore.setState({
      crossfader: 0.5,
      masterVolume: 1,
      cueEnabled: { A: false, B: false },
      cueGain: 1,
      cueMix: 0.5
    })
  })

  it('defaults: PFLs off, cueGain 1, cueMix 0.5', () => {
    const s = useMixerStore.getState()
    expect(s.cueEnabled).toEqual({ A: false, B: false })
    expect(s.cueGain).toBe(1)
    expect(s.cueMix).toBe(0.5)
  })

  it('setCueEnabled toggles only the addressed deck', () => {
    useMixerStore.getState().setCueEnabled('A', true)
    expect(useMixerStore.getState().cueEnabled).toEqual({ A: true, B: false })
    useMixerStore.getState().setCueEnabled('B', true)
    expect(useMixerStore.getState().cueEnabled).toEqual({ A: true, B: true })
  })

  it('toggleCueEnabled flips the addressed deck', () => {
    useMixerStore.getState().toggleCueEnabled('A')
    expect(useMixerStore.getState().cueEnabled.A).toBe(true)
    useMixerStore.getState().toggleCueEnabled('A')
    expect(useMixerStore.getState().cueEnabled.A).toBe(false)
  })

  it('setCueGain clamps to 0..1', () => {
    useMixerStore.getState().setCueGain(-0.2)
    expect(useMixerStore.getState().cueGain).toBe(0)
    useMixerStore.getState().setCueGain(1.5)
    expect(useMixerStore.getState().cueGain).toBe(1)
    useMixerStore.getState().setCueGain(0.42)
    expect(useMixerStore.getState().cueGain).toBeCloseTo(0.42, 5)
  })

  it('setCueMix clamps to 0..1', () => {
    useMixerStore.getState().setCueMix(-1)
    expect(useMixerStore.getState().cueMix).toBe(0)
    useMixerStore.getState().setCueMix(2)
    expect(useMixerStore.getState().cueMix).toBe(1)
  })
})
