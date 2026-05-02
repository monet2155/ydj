# Headphone Monitoring — Implementation Plan

Spec: `docs/HEADPHONE_MONITORING_SPEC.md`. Read first.

## Dependency Graph (vertical slices)

```
            [T1: Engine — preFaderTap + cueBus + cueOut]
                 │
                 ▼
            [T2: mixerStore cue state] ──► [T3: store→engine bridge]
                                                 │
                                                 ▼
            [T4: outputDeviceStore + Settings + setSinkId routing]
                 │                                │
                 ▼                                ▼
            [T5: Mixer UI — PFL/CueGain/CueMix sliders]
                 │
                 ▼
            [T6: MIDI wire — PFL toggle + Cue Gain knob]
                 │
                 ▼
            [T7: devicechange + default fallback + toast]
                 │
                 ▼
            [T8: controller-detect recommend-master toast]
```

T1, T2 are independent foundations and can be done in parallel.
T3 unblocks T5/T6. T4 depends on T1's cueOut. T7 depends on T4. T8 depends on T4+T7.

---

## Code-side findings (read-only investigation)

### Pre-fader split point doesn't exist yet
`DeckEngine.gainNode` is **both** the volume fader and the FX chain termination point. To get PFL pre-fader, T1 must insert a new GainNode (`preVolumeTap`, fixed gain 1) **between** the FX output and `gainNode`:

```
eqLow → eqMid → eqHigh → preVolumeTap → gainNode(volume) → master
                              │
                              └→ cueSend (per deck) → cueBus → cueOut MediaStream
```

`fxOutput` getter changes to return `preVolumeTap` (FxEngine's chain termination follows automatically because it derefs `deck.fxOutput`). Master path is structurally unchanged.

### MixerEngine signal graph after T1
```
deck.preVolumeTap ─┬→ ctx.destination ... [fader+master path unchanged]
                   └→ cueSendA → ─┐
deck.preVolumeTap ─┬→ ...          ├→ cueBus → cueGain → cueOutDest (MediaStreamAudioDestinationNode)
                   └→ cueSendB → ─┘
                                  ↑
            masterGain ─→ masterToCueGain ─┘   (Cue Mix knob: 0=cue only, 1=master only)
```

`cueOutDest.stream` is assigned to a hidden `<audio>` element whose `sinkId` is the headphone device.

### Conventional defaults (the user is non-DJ)
- Both PFLs off at startup.
- `cueGain = 1.0` (full).
- `cueMix = 0.5` (50/50 in headphone — common neutral default).
- Output dropdowns default to system `'default'`.

---

## Tasks

### T1 — DeckEngine pre-fader tap + MixerEngine cue bus + cueOut MediaStream
**Outcome.** Audio graph supports PFL; cueOut MediaStream exists and can be played via a hidden audio element. No store/UI yet.

**Files.**
- `src/renderer/src/engine/DeckEngine.ts` — add private `preVolumeTap`; insert in chain before `gainNode`; have `fxOutput` getter return `preVolumeTap`.
- `src/renderer/src/engine/MixerEngine.ts` — add `cueSendA`, `cueSendB`, `cueBus`, `cueGain`, `masterToCueGain`, `cueOutDest: MediaStreamAudioDestinationNode`. Update `connectDeck` to also tap `deck.fxOutput` (= preVolumeTap) into the deck's `cueSend`. Expose `setCueEnabled(side, on)`, `setCueGain(0..1)`, `setCueMix(0..1)`, getter `cueStream`.

**Acceptance.**
- `pnpm lint` green.
- DevTools: `getMixerEngine().setCueEnabled('A', true); getMixerEngine().setCueGain(1)` and route stream to a temp `<audio>` set to `default` sinkId — deck A is audible in cue (manual sanity).
- Master path unchanged (compare master sound with PFL on vs off — no perceptible difference).
- No regressions in existing vitest suite.

**Verification of hard requirements.**
- Master invariance: code review check that the master signal path (preVolumeTap → gainNode → masterGainSide → masterGain → destination) is **not** altered by any cue node connection. Document with a comment.
- Pre-fader: cueSend taps **before** gainNode. Visible in code; verify in T5 manually with volume fader at 0.

**Dependencies.** None.

---

### T2 — mixerStore additions + unit tests
**Outcome.** Store holds cue state with sane defaults and clamped setters.

**Files.**
- `src/renderer/src/store/mixerStore.ts` — add fields `cueEnabled: { A: boolean; B: boolean }`, `cueGain: number`, `cueMix: number`. Setters: `setCueEnabled(deckId, on)`, `setCueGain(0..1 clamped)`, `setCueMix(0..1 clamped)`, `toggleCueEnabled(deckId)`.
- `src/renderer/src/test/mixerStore.test.ts` (new) — defaults, clamping, toggle.

**Acceptance.**
- New tests pass; existing pass.
- `pnpm lint` green.

**Dependencies.** None (parallel with T1).

---

### T3 — Store → engine bridge
**Outcome.** Store changes drive `MixerEngine` cue state in real time.

**Files.**
- `src/renderer/src/components/Mixer/MixerPanel.tsx` — three new `useEffect` hooks subscribing to `cueEnabled.A`, `cueEnabled.B`, `cueGain`, `cueMix` (mirrors existing `crossfader` / `masterVolume` pattern).

**Acceptance.**
- Manual: in DevTools, `useMixerStore.getState().setCueEnabled('A', true)` → engine's `cueSendA.gain.value === 1`.
- Toggling PFL while master plays does not change master output (record short clip if needed).

**Dependencies.** T1, T2.

---

### Checkpoint A — After T3
Engine + state + bridging are wired. Audio doesn't reach a separate device yet (no setSinkId), but graph is complete. Sanity-test by temporarily routing `cueStream` to a `<audio>` with default sinkId and toggling PFL.

Commit boundary; do not merge to main until A passes.

---

### T4 — outputDeviceStore + Settings modal + setSinkId routing
**Outcome.** User selects master/headphone outputs; both routings active. Selections persist across restarts.

**Files.**
- `src/renderer/src/store/outputDeviceStore.ts` (new):
  - `availableDevices: MediaDeviceInfo[]`
  - `masterDeviceId: string` (default `'default'`)
  - `headphoneDeviceId: string` (default `'default'`)
  - `refreshDevices()`, `setMasterDeviceId(id)`, `setHeadphoneDeviceId(id)`
  - localStorage persistence at `ydj.audioOutputs.v1` (only IDs, not the full MediaDeviceInfo).
- `src/renderer/src/test/outputDeviceStore.test.ts` (new) — defaults, persistence round-trip, setter clamping unknown IDs to `'default'`.
- `src/renderer/src/components/Settings/AudioSettings.tsx` (new) — modal with two `<select>` dropdowns; opens via header gear button.
- `src/renderer/src/components/Settings/SettingsButton.tsx` (new) — small gear next to MidiStatus.
- `src/renderer/src/App.tsx` — mount modal; on mount, `refreshDevices()` + apply persisted IDs.
- `src/renderer/src/engine/MixerEngine.ts` — add `setMasterSinkId(id)` (calls `audioContext.setSinkId(id)`), `setHeadphoneSinkId(id)` (sets the hidden audio element's sinkId).
- `src/renderer/src/engine/AudioEngine.ts` — surface `setSinkId(id)` for master.

**Acceptance.**
- Settings modal opens from header, lists `audiooutput` devices.
- Selecting a device switches output within ~100 ms (audible).
- Selecting same device for both works without crash; small inline warning shown.
- Restart app → previous selections restored; if a stored device is no longer present, fall back to `'default'`.
- Unit tests for the store pass.

**Dependencies.** T1 (cueStream).

---

### T5 — Mixer UI: PFL toggles + Cue Gain + Cue Mix sliders
**Outcome.** Manual mouse control of all cue features.

**Files.**
- `src/renderer/src/components/Mixer/MixerPanel.tsx` — small icon-style PFL toggle next to each deck section in EqChannel; two new compact sliders below master volume (Cue Gain, Cue Mix) with small labels.

**Acceptance.**
- PFL toggle UI matches existing button style; clicking flips state.
- With deck A volume fader at 0 and PFL A on, headphone outputs deck A audio (pre-fader verified).
- Cue Mix at 0 → headphone is cue only; at 1 → headphone is master only; at 0.5 → equal mix.
- Master output unaffected by any cue control.

**Dependencies.** T1, T2, T3, T4.

---

### Checkpoint B — After T5
Full feature usable without a controller. Verify the two hard requirements end-to-end:
- Master invariance under PFL toggling.
- Pre-fader audibility with channel volume at 0.

---

### T6 — MIDI wire-up
**Outcome.** Party Mix MKII PFL buttons toggle cue; Cue Gain knob (originally measured as `mixer.headphone.mix`) drives `cueGain`. Rename binding key for clarity.

**Files.**
- `src/renderer/src/midi/types.ts` — replace `mixer.headphone.mix` ActionKey with `mixer.cueGain` (the binding bytes are unchanged; this is just a name refactor — call out in commit).
- `src/renderer/src/midi/presets/partyMix2.ts` — rename binding entry.
- `src/renderer/src/midi/actions.ts` — `toggleCue(deckId)`, `setCueGain(value)`. Remove the no-op for headphone/cue.
- `src/renderer/src/midi/MidiMapper.ts` — wire `deck.A.cueMonitor` / `deck.B.cueMonitor` → `toggleCue`; `mixer.cueGain` → `setCueGain`.

**Acceptance.**
- Manual: PFL A button on controller toggles UI PFL state.
- Manual: Cue Gain knob updates store `cueGain` and is reflected in the slider.
- Existing midiActions.test.ts passes.

**Dependencies.** T2 (state), T3 (engine wiring).

---

### T7 — devicechange handling + default fallback + toast
**Outcome.** When the active master/headphone device disappears mid-session, output silently falls back to `'default'` and a small toast notifies the user.

**Files.**
- `src/renderer/src/components/Toast.tsx` (new) — minimal toast container + `showToast(message, kind?)` API. Auto-dismiss after ~4 s. Click-to-dismiss.
- `src/renderer/src/store/outputDeviceStore.ts` — `mediaDevices.devicechange` listener (added in `App.tsx` mount): on event, refresh device list; for each role (master/headphone), if its current ID is no longer present, reset to `'default'` and call `showToast`.
- `src/renderer/src/App.tsx` — mount Toast container, register devicechange.
- Unit tests: pure helper `pickFallback(currentId, devices)` returns `'default'` when missing, else `currentId`.

**Acceptance.**
- Manual: unplug USB headphone → audio continues on system default; toast displayed.
- `pickFallback` unit tests pass.

**Dependencies.** T4.

---

### T8 — controller-detect recommendation toast
**Outcome.** When Party Mix MKII (or any preset-matched device) connects, a non-blocking toast suggests setting it as master output. One-shot per session; "Use" applies, dismiss does nothing further.

**Files.**
- `src/renderer/src/midi/MidiManager.ts` — on first appearance of a device matching a known preset name, fire a one-shot callback (registry pattern, like `registerLibraryLoadCallback`).
- `src/renderer/src/App.tsx` — register handler that calls `showToast` with an action button "Set as Master".
- Helper in `outputDeviceStore`: `findAudioOutputByName(substring)` to map controller name (`Party Mix MKII`) to the `audiooutput` device with the matching label.

**Acceptance.**
- Plug controller (or restart while plugged) → toast appears once. Dismiss → nothing changes. Accept → master sinkId switches to controller's audio output.
- Toast does not re-appear within the same session.

**Dependencies.** T4, T7 (toast component).

---

### Checkpoint C — After T8
Feature complete. Run full lint + test suite. Manual end-to-end smoke:
1. Plug controller. Toast appears. Accept.
2. Settings → headphone = laptop speakers (sanity check).
3. Load tracks on both decks. Play deck A.
4. Toggle PFL B. Hear nothing in headphone.
5. Play deck B silently (volume fader at 0). Toggle PFL B → audible in headphone.
6. Adjust Cue Mix → blend with master.
7. Unplug controller. Toast about device fallback. Master continues from system default.
8. Reload app. Settings persisted.

---

## Hard requirements traceability

| Requirement | Verified in |
|---|---|
| Master output unchanged by PFL state | T1 (code review + comment), T5 (manual A/B), Checkpoint B |
| PFL pre-fader (volume=0 still audible in headphone) | T5 (explicit manual test), Checkpoint B |
| Output device choices persist across restarts | T4 (unit test + manual restart) |
| `pnpm lint` green throughout | every task ends with lint check |
| Existing tests not broken | every task runs `pnpm test` |
| New store-level tests | T2 (mixerStore), T4 (outputDeviceStore), T7 (pickFallback) |

---

## Ambiguities flagged for confirmation during implementation

1. **Cue Gain MIDI binding rename** (T6). Currently `mixer.headphone.mix`; should be `mixer.cueGain`. Plan assumes rename; if user wants to keep the old name, note as alias in types.

2. **Cue Mix has no MIDI on MKII** (intentional). UI-only slider with default 0.5. If a future controller exposes a real Cue Mix knob, add a separate ActionKey then — don't conflate.

3. **Settings entry point** — proposed: small gear icon in header, right of MidiStatus. Header is already crowded; alternative is a slash command or a button in the Library bar. Confirm visually during T4.

4. **First-run cue routing** — even before user opens Settings, the hidden `<audio>` element gets sinkId `'default'` so PFL "just works". This is implicit in T4. Calling out so it's not missed.

5. **AudioContext.setSinkId behavior** in Electron 31 — if it transiently breaks the master output for >50 ms, user will hear a click. If observed during T4 manual testing, wrap with a brief gain ramp to suppress click. Otherwise leave as-is.

6. **macOS aggregate device for Party Mix MKII's 4-channel USB** — explicitly out of scope (per spec §6). If MKII shows up as one 4-channel device, only channels 1–2 are reachable from a normal stereo `audiooutput`. User can build an Aggregate Device in macOS Audio MIDI Setup if they want both stereo pairs. Document this limitation in the Settings modal as a small footnote.
