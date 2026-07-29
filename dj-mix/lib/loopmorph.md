Transition Name:
Progressive Loop Morph

Goal:
Transform Track A into Track B by progressively reducing a beat-aligned loop while morphing the audio from one deck to the other.

=========================================
GENERAL RULES
=========================================

- Total transition = 8 phases.
- Every phase has the same duration (configurable).
- Loop boundaries must always align to the beat grid.
- Beat phase and bar phase must remain synchronized.
- Loop changes occur only on beat boundaries.
- Apply 5–10 ms crossfades whenever the loop length changes to eliminate clicks.
- Use Equal-Power gain curves instead of linear fades.
- The user crossfader remains unchanged; only internal deck gains are automated.

=========================================
INITIAL STATE
=========================================

Deck 1
- Playing normally
- Gain = 100%
- HP Filter = 0%
- Echo = Off

Deck 2
- Loaded
- Stopped
- Gain = 0%

=========================================
PHASE 1 (revised — see note below)
=========================================

Deck 1
- Create 4-beat loop
- Repeat twice

Deck Gains
Deck1 = 100%
Deck2 = 0%

Effects
None

=========================================
PHASE 2
=========================================

Deck 1
Loop:
4 → 2 beats

Repeat twice

Effects
HP Filter = 5%

=========================================
PHASE 3
=========================================

Deck 1
Loop:
2 → 1 beat

Repeat twice

Effects
HP Filter = 12%

=========================================
PHASE 4 (revised — see note below)
=========================================

Deck 1
Loop:
1 → 1/2 beat

Repeat once

Effects
HP Filter = 20%

=========================================
PHASE 5 (revised — see note below)
=========================================

Deck 1
Loop:
holds at 1/2 beat (no further shrink from phase 4)

Repeat once

Effects
HP Filter = 35%
Deck1 Gain = 95%

NOTE (compressed timing, current values): phases 1-5's beat lengths and repeat counts were
tightened from the original 8→4→2→1→1/2 (2,2,2,2,4 reps) progression to the shorter one above —
phase 4→5 now holds the same 1/2-beat length instead of continuing to shrink. `MAIN_PHASES` in
`lib/loopMorphEngine.js` is the literal source of truth for these numbers.

=========================================
PHASE 6 (revised — see note below)
=========================================

Deck 1

Loop sequence

1/4
↓

1/4
↓

1/4
↓

1/16

Repeat each subdivision enough times to create acceleration. (Compressed from the original
1/2 → 1/4 → 1/8 → 1/16 smooth halving: holds at 1/4 beat three times, then drops straight to
the floor — `PHASE6_SUBDIVISION_BEATS` in `lib/loopMorphEngine.js` is the literal source of
truth.)

NOTE (2026-07-29 user feedback): at these cycle lengths, simply looping the raw audio buffer
continuously (one flat sustained gain) reads as a chaotic buzz/drone, not rhythmic drumming —
below a certain cycle length a loop stops sounding like separate repeats and starts sounding
like a continuous tone. Each cycle short enough to trigger that (below
`PERCUSSIVE_GATE_THRESHOLD_SEC`) is now re-attacked and decayed individually — see
`LoopMorphEngine#run` — so it reads as discrete percussive hits instead.

Effects

HP Filter = 60%

Deck1 Gain = 90%

Echo Send = 20%

Deck 2 (revised 2026-07-29 — see note below)

- Seek to transition cue (bar-aligned)
- Keep playing normally, at its own native tempo — no BPM sync, no loop
- Gain remains 0%

Deck1's own loop keeps running through this phase at its OWN tempo — the retune below only
kicks in once phase 7 starts.

=========================================
PHASE 7 (revised 2026-07-29 — see note below)
=========================================

Deck1

Still repeating its own loop, but retuned: at the instant this phase starts, the loop's
playback rate snaps to Deck2's native BPM — "as if it's just the beat of the other song".

Deck2

Playing normally (not looped), at its own native tempo, gain rising.

Deck Gains

Deck1
90 → 40%

Deck2
0 → 60%

Effects

Deck1

HP Filter
60 → 90%

Echo
20 → 45%

Deck2

Gradually restore bass frequencies.

Result

The listener hears Deck1's loop already beating in time with Deck2's real track fading in
underneath it — the loop's retuned tempo is what makes the incoming BPM feel inevitable rather
than announced.

=========================================
PHASE 8
=========================================

Deck1

Gain
40 → 0%

Echo
45 → 60%

Disable loop

Continue playback silently for 200 ms

Stop playback

Deck2

Gain
60 → 100%

Continue playing normally (never was looped)

HP Filter
Return to normal.

NOTE (2026-07-29 user feedback): originally Deck2 synced ITS tempo to Deck1 in phase 6, then
looped identically alongside Deck1 through phases 6-7 before resolving to normal playback in
phase 8. Reversed: Deck2 never bends and never loops — it just plays its real track normally,
seeked to the transition cue, fading up in volume across phases 7-8. Instead Deck1's own
short loop — already running since phase 1 — retunes to Deck2's tempo the instant phase 7
starts, so the rhythmic texture the listener has been hearing already matches Deck2's beat by
the time Deck2's real audio becomes audible. This makes the BPM choice feel discovered, not
imposed.

=========================================
END STATE
=========================================

Deck1
Stopped

Deck2
Playing normally

No loop

No transition effects

Ready for the next transition.

