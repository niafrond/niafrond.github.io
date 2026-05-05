export const PLAYERS_KEY       = 'pyramide_players';
export const R2_BUZZ_DELAY_KEY = 'pyramide_r2_buzz_delay';
export const CLICK_COOLDOWN    = 400;
export const MIN_PLAYERS       = 2;

export const TEAMS_META = [
  { color: 'var(--volcan)', label: 'Équipe Rouge' },
  { color: 'var(--lagon)',  label: 'Équipe Bleue'  },
];

export const GAMEPLAY_SCREENS = new Set([
  'screen-pre-round',
  'screen-turn',
  'screen-turn-end',
  'screen-bidding',
  'screen-timer',
  'screen-final',
]);

export const state = {
  playerNames: [],
  teams: [],         // [{ name, color, players, score }]
  currentTeam: 0,    // 0=A 1=B

  currentRound: 0,   // 1,2,3,4,5(final)
  currentPhase: 'setup',

  wordSets: {
    round1: { teamA: [], teamB: [] },
    round2: { shared: [] },
    round3: { theme: '', words: [] },
    round4: { teamA: { theme:'', words:[] }, teamB: { theme:'', words:[] } },
    final:  { words: [] }
  },

  // Round 1
  r1SubTeam: 0,
  r1PhraseSets: [],         // 5 phrase options shown to the current team
  r1SelectedSet: null,      // { phrase, words[] } — the option picked by clue giver
  r1WordIdx: 0,
  r1ClueBudget: 13,         // shared clue budget for the sub-turn
  r1CommittedClues: 0,      // clues committed for the current word
  r1CluesGiven: 0,          // clues given so far for the current word
  r1FoundWords: [],         // words successfully guessed (revealed in link phase)

  // Round 2
  r2WordIdx: 0,
  r2BricksLeft: 13,
  r2Giver: 0,
  r2ClueGiven: false,
  r2BuzzDelay: 15,      // seconds before buzz in ping-pong (configurable)
  r2BuzzTimeoutId: null,

  // Round 3
  r3WordIdx: 0,
  r3BidA: null,
  r3BidB: null,
  r3BidPhase: 'A',  // 'A' | 'B' | 'resolve'
  r3Giver: null,
  r3MaxBricks: 3,
  r3BricksLeft: 0,
  r3ClueCount: 0,

  // Round 4
  r4SubTeam: 0,
  r4WordIdx: 0,
  r4FoundCount: 0,
  r4FoundCounts: [0, 0],    // per-team R4 word counts (tiebreaker for Final)
  r4TimeRemaining: 30,
  r4TimerInterval: null,

  // Final
  finalWordIdx: 0,
  finalTimer: 60,
  finalTimerInterval: null,
  finalBonusUsed: false,
  finalBestTeam: null,      // index of team that plays the Final
  finalCanJackpot: true,    // false if any word was skipped
};

export function withCooldown(fn) {
  let last = 0;
  return function(...args) {
    const now = Date.now();
    if (now - last < CLICK_COOLDOWN) return;
    last = now;
    fn.apply(this, args);
  };
}
