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
PHASE 1
=========================================

Deck 1
- Create 8-beat loop
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
8 → 4 beats

Repeat twice

Effects
HP Filter = 5%

=========================================
PHASE 3
=========================================

Deck 1
Loop:
4 → 2 beats

Repeat twice

Effects
HP Filter = 12%

=========================================
PHASE 4
=========================================

Deck 1
Loop:
2 → 1 beat

Repeat twice

Effects
HP Filter = 20%

=========================================
PHASE 5
=========================================

Deck 1
Loop:
1 → 1/2 beat

Repeat four times

Effects
HP Filter = 35%
Deck1 Gain = 95%

=========================================
PHASE 6
=========================================

Deck 1

Loop sequence

1/2
↓

1/4
↓

1/8
↓

1/16

Repeat each subdivision enough times to create acceleration.

Effects

HP Filter = 60%

Deck1 Gain = 90%

Echo Send = 20%

Deck 2

- Synchronize BPM
- Synchronize beat phase
- Synchronize bar phase
- Seek to transition cue
- Start playback internally
- Enable identical 1/16 loop
- Gain remains 0%

At the end of this phase both decks are already perfectly synchronized.

=========================================
PHASE 7
=========================================

Both decks

Both repeat the same 1/16 loop.

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

The listener perceives Track A dissolving while Track B emerges from the same rhythm.

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

Disable loop

Resume normal playback

Restore original tempo if Sync was temporary.

HP Filter
Return to normal.

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

