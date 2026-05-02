# Headphone Monitoring — Todo

Phase order is mandatory. Within a phase, tasks marked **‖** can run in parallel.

## Phase 1 — Foundation
- [ ] **T1** DeckEngine `preVolumeTap` + MixerEngine cue bus + `cueOut` MediaStream  ‖
- [ ] **T2** mixerStore: `cueEnabled / cueGain / cueMix` + tests  ‖

## Phase 2 — Bridge
- [ ] **T3** Store → MixerEngine bridge (useEffect mirror, like crossfader)
- [ ] **Checkpoint A** code review + manual sanity (cue stream temporarily routed to default)

## Phase 3 — Routing
- [ ] **T4** outputDeviceStore + Settings modal + `setSinkId` on master & cue (+ persistence + tests)

## Phase 4 — UI + MIDI
- [ ] **T5** Mixer UI: PFL toggles + Cue Gain + Cue Mix sliders
- [ ] **Checkpoint B** verify hard requirements end-to-end (master invariance, pre-fader)
- [ ] **T6** MIDI: PFL toggle, Cue Gain knob (rename binding `mixer.headphone.mix` → `mixer.cueGain`)

## Phase 5 — Polish
- [ ] **T7** devicechange listener + default fallback + Toast component
- [ ] **T8** controller-detect "Set as Master" recommendation toast
- [ ] **Checkpoint C** full smoke; commit; update `MIDI_PLAN.md` to mark cueMonitor / cue gain done

## Cross-cutting per task
After every task: `pnpm lint`, `pnpm test`, commit with descriptive message.

## Out of scope (do NOT do)
- Split Cue, Talkover
- Cue bus recording
- macOS Aggregate Device automation
- Per-deck cue volume
- Bluetooth latency compensation
