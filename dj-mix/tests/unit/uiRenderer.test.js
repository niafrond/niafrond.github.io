/**
 * uiRenderer.test.js — Tests unitaires pour createDjMixRenderer / buildQueueHTML
 *
 * On instancie le renderer avec des stubs minimaux et on vérifie le HTML généré
 * par buildQueueHTML dans les différents états de la file d'attente.
 */

import { createDjMixRenderer } from '../../lib/uiRenderer.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeTrack(overrides = {}) {
  return {
    id: 't1',
    name: 'Track One',
    artist: 'Artist One',
    artUrl: '',
    duration: 200000,
    bpm: null,
    genre: null,
    sourceState: 'idle',
    ...overrides,
  };
}

/**
 * Crée un renderer minimal pour les tests.
 * Tous les paramètres DOM sont null (on ne teste pas le rendu DOM direct).
 * Seul buildQueueHTML est utilisé.
 */
function makeRenderer({
  queue = [],
  currentTrackId = null,
  currentIndexOverride = null,
  isPlaying = false,
  deckBCueIndex = -1,
  deckCueDeck = null,
  deckDisplayItems = { A: null, B: null },
  djMode = 'music',
} = {}) {
  return createDjMixRenderer({
    // DOM elements — null, buildQueueHTML ne les touche pas
    deckAPanel: null, deckBPanel: null,
    deckAVol: null, deckBVol: null,
    deckAFill: null, deckBFill: null,
    deckATitle: null, deckBTitle: null,
    deckABpm: null, deckBBpm: null,
    deckABpmReset: null, deckBBpmReset: null,
    deckALaunchBtn: null, deckBLaunchBtn: null,
    queueList: null, emptyQueue: null,
    autoMixBtn: null,
    albumArt: null, artPlaceholder: null,
    nextAlbumArt: null, nextArtPlaceholder: null,
    trackArtist: null, trackArtistA: null, trackArtistB: null,

    // Getters d'état
    getQueue: () => queue,
    getDjMode: () => djMode,
    getCurrentIndex: () => (currentIndexOverride == null
      ? queue.findIndex((t) => t.id === currentTrackId)
      : currentIndexOverride),
    getCurrentTrackId: () => currentTrackId,
    getIsPlaying: () => isPlaying,
    getDeckBCueIndex: () => deckBCueIndex,
    getDeckCueDeck: () => deckCueDeck,
    getDeckDisplayItems: () => deckDisplayItems,
    getInactiveDeck: () => 'B',
    getFocusDeck: () => 'A',
    getLaunchPreviewState: () => ({ active: false }),
    getPrevIsCrossfading: () => false,
    setPrevIsCrossfading: () => {},
    getDeckMixRatio: () => 0,
    setDeckMixRatio: () => {},
    clampDeckMixRatio: (v) => v,
    updateDeckMixUI: () => {},
    updateDeckCueUI: () => {},
    getPlayer: () => null,
  });
}

function makeDomTextNode() {
  return {
    innerHTML: '',
    textContent: '',
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('buildQueueHTML', () => {
  test('file vide → chaîne vide', () => {
    const { buildQueueHTML } = makeRenderer({ queue: [] });
    expect(buildQueueHTML()).toBe('');
  });

  test('génère un élément par item avec data-index', () => {
    const tracks = [makeTrack({ id: 't1', name: 'Track A' }), makeTrack({ id: 't2', name: 'Track B' })];
    const { buildQueueHTML } = makeRenderer({ queue: tracks });
    const html = buildQueueHTML();
    expect(html).toContain('data-index="0"');
    expect(html).toContain('data-index="1"');
    expect(html).toContain('Track A');
    expect(html).toContain('Track B');
  });

  test('numérotation visible (1-based) quand aucun item ne joue', () => {
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })];
    const { buildQueueHTML } = makeRenderer({ queue: tracks });
    const html = buildQueueHTML();
    expect(html).toContain('>1<');
    expect(html).toContain('>2<');
  });

  test('is-current sur le bon item quand currentTrackId est défini', () => {
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })];
    const { buildQueueHTML } = makeRenderer({ queue: tracks, currentTrackId: 't2' });
    const html = buildQueueHTML();
    // Seul le 2e item doit avoir la classe is-current
    const parts = html.split('queue-item');
    // parts[0] = avant tout, parts[1..n] = les classes des items
    const firstItemClass = parts[1];
    const secondItemClass = parts[2];
    expect(firstItemClass).not.toContain('is-current');
    expect(secondItemClass).toContain('is-current');
  });

  test('playing-bars affichés sur le track courant en lecture', () => {
    const tracks = [makeTrack({ id: 't1' })];
    const { buildQueueHTML } = makeRenderer({ queue: tracks, currentTrackId: 't1', isPlaying: true });
    const html = buildQueueHTML();
    expect(html).toContain('playing-bars');
  });

  test('pas de playing-bars si isPlaying=false même avec currentTrackId', () => {
    const tracks = [makeTrack({ id: 't1' })];
    const { buildQueueHTML } = makeRenderer({ queue: tracks, currentTrackId: 't1', isPlaying: false });
    const html = buildQueueHTML();
    expect(html).not.toContain('playing-bars');
  });

  test('boutons cue présents pour chaque item', () => {
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })];
    const { buildQueueHTML } = makeRenderer({ queue: tracks });
    const html = buildQueueHTML();
    // 2 items → 2×2 boutons cue
    const cueMatches = html.match(/queue-cue/g) || [];
    expect(cueMatches.length).toBe(4);
  });

  test('cue sélectionné marqué is-selected sur le bon item et deck', () => {
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })];
    const { buildQueueHTML } = makeRenderer({ queue: tracks, deckBCueIndex: 1, deckCueDeck: 'B' });
    const html = buildQueueHTML();
    expect(html).toContain('is-selected');
    // is-selected doit apparaître dans les boutons du 2e item (index 1)
    const itemBlocks = html.split('data-index="').slice(1); // ['0"...', '1"...', '1"...cue...]
    // trouver les is-selected
    const selectedInIndex0 = itemBlocks.filter((b) => b.startsWith('0')).join('').includes('is-selected');
    const selectedInIndex1 = itemBlocks.filter((b) => b.startsWith('1')).join('').includes('is-selected');
    expect(selectedInIndex0).toBe(false);
    expect(selectedInIndex1).toBe(true);
  });

  test('badge deck A affiché quand item est sur platine A (deckDisplayItems)', () => {
    const t1 = makeTrack({ id: 't1' });
    const tracks = [t1, makeTrack({ id: 't2' })];
    const { buildQueueHTML } = makeRenderer({ queue: tracks, deckDisplayItems: { A: t1, B: null } });
    const html = buildQueueHTML();
    expect(html).toContain('queue-deck-badge');
    expect(html).toContain('platine 1');
  });

  test('badge DJ 1+2 quand même item sur les deux platines', () => {
    const t1 = makeTrack({ id: 't1' });
    const tracks = [t1];
    const { buildQueueHTML } = makeRenderer({ queue: tracks, deckDisplayItems: { A: t1, B: t1 } });
    const html = buildQueueHTML();
    expect(html).toContain('DJ 1+2');
  });

  test('bouton cue A désactivé si item déjà sur platine A', () => {
    const t1 = makeTrack({ id: 't1' });
    const tracks = [t1, makeTrack({ id: 't2' })];
    const { buildQueueHTML } = makeRenderer({ queue: tracks, deckDisplayItems: { A: t1, B: null } });
    const html = buildQueueHTML();
    // Le bouton Cue 1 de t1 doit être disabled
    expect(html).toContain('Déjà chargée sur platine 1');
  });

  test('pas de currentIndex ReferenceError — régression migration uiState', () => {
    // Ce test garantit que buildQueueHTML ne lève pas ReferenceError "currentIndex is not defined"
    // suite à la migration des variables vers uiState.
    const tracks = Array.from({ length: 5 }, (_, i) => makeTrack({ id: `t${i}`, name: `Track ${i}` }));
    const { buildQueueHTML } = makeRenderer({
      queue: tracks,
      currentTrackId: 't2',
      isPlaying: true,
      deckBCueIndex: 3,
      deckCueDeck: 'B',
      deckDisplayItems: { A: tracks[2], B: null },
    });
    // Ne doit pas throw
    expect(() => buildQueueHTML()).not.toThrow();
    const html = buildQueueHTML();
    expect(html).not.toBe('');
  });

  test("n'affiche que les 5 morceaux lus précédents et les grise", () => {
    const tracks = Array.from({ length: 10 }, (_, i) => makeTrack({
      id: `t${i}`,
      name: `Track ${i}`,
    }));
    const { buildQueueHTML } = makeRenderer({
      queue: tracks,
      currentTrackId: 't7',
      currentIndexOverride: 7,
    });

    const html = buildQueueHTML();

    expect(html).not.toContain('data-index="0"');
    expect(html).not.toContain('data-index="1"');
    expect(html).toContain('data-index="2"');
    expect(html).toContain('data-index="9"');
    expect(html).toContain('class="queue-item is-played" data-index="2"');
    expect(html).toContain('class="queue-item is-played" data-index="6"');
    expect(html).toContain('class="queue-item is-current" data-index="7"');
  });

  test('chips BPM et genre affichées en mode dance si présentes', () => {
    const track = makeTrack({ id: 't1', bpm: 128, genre: 'House' });
    const { buildQueueHTML } = makeRenderer({ queue: [track], djMode: 'dance' });
    const html = buildQueueHTML();
    expect(html).toContain('128 BPM');
    expect(html).toContain('House');
    expect(html).toContain('queue-chip');
  });

  test('pas de chips BPM et genre en mode music', () => {
    const track = makeTrack({ id: 't1', bpm: 128, genre: 'House' });
    const { buildQueueHTML } = makeRenderer({ queue: [track], djMode: 'music' });
    const html = buildQueueHTML();
    expect(html).not.toContain('128 BPM');
    expect(html).not.toContain('House');
    expect(html).not.toContain('queue-chip');
  });

  test('badge cache affiché si source restaurée prête', () => {
    const track = makeTrack({ id: 't1', sourceState: 'ready' });
    const { buildQueueHTML } = makeRenderer({ queue: [track] });
    const html = buildQueueHTML();
    expect(html).toContain('queue-cache-dot');
    expect(html).toContain('is-ready');
  });

  test('pas de chips si bpm et genre absents', () => {
    const track = makeTrack({ id: 't1', bpm: null, genre: null });
    const { buildQueueHTML } = makeRenderer({ queue: [track] });
    const html = buildQueueHTML();
    expect(html).not.toContain('queue-chip');
  });

  test('platine active affiche une pastille genre en mode dance', () => {
    const track = makeTrack({ name: 'Track A', artist: 'Artist A', genre: 'House', bpm: 128 });
    const trackArtistA = makeDomTextNode();
    const renderer = createDjMixRenderer({
      deckAPanel: null, deckBPanel: null,
      deckAVol: null, deckBVol: null,
      deckAFill: null, deckBFill: null,
      deckATitle: null, deckBTitle: null,
      deckABpm: null, deckBBpm: null,
      deckABpmReset: null, deckBBpmReset: null,
      deckALaunchBtn: null, deckBLaunchBtn: null,
      queueList: null, emptyQueue: null,
      autoMixBtn: null,
      albumArt: null, artPlaceholder: { style: { display: '' } },
      nextAlbumArt: null, nextArtPlaceholder: { style: { display: '' } },
      trackArtist: null, trackArtistA, trackArtistB: makeDomTextNode(),
      getQueue: () => [track],
      getDjMode: () => 'dance',
      getCurrentIndex: () => 0,
      getCurrentTrackId: () => null,
      getIsPlaying: () => false,
      getDeckBCueIndex: () => -1,
      getDeckCueDeck: () => null,
      getDeckDisplayItems: () => ({ A: track, B: null }),
      getInactiveDeck: () => 'B',
      getFocusDeck: () => 'A',
      getLaunchPreviewState: () => ({ active: false }),
      getPrevIsCrossfading: () => false,
      setPrevIsCrossfading: () => {},
      getDeckMixRatio: () => 0,
      setDeckMixRatio: () => {},
      clampDeckMixRatio: (value) => value,
      updateDeckMixUI: () => {},
      updateDeckCueUI: () => {},
      getPlayer: () => null,
    });

    renderer.refreshDeckMetaDisplays();
    expect(trackArtistA.innerHTML).toContain('House');
    expect(trackArtistA.innerHTML).toContain('queue-chip');
  });
});

describe('updateNowPlaying / notification système (mediaSession)', () => {
  function makeArtEl() {
    return { hidden: false, src: '', onerror: null, style: {} };
  }

  function makeNowPlayingRenderer({ focusDeck = 'A', queue = [], currentIndex = 0 } = {}) {
    return createDjMixRenderer({
      deckAPanel: null, deckBPanel: null,
      deckAVol: null, deckBVol: null,
      deckAFill: null, deckBFill: null,
      deckATitle: null, deckBTitle: null,
      deckABpm: null, deckBBpm: null,
      deckABpmReset: null, deckBBpmReset: null,
      deckALaunchBtn: null, deckBLaunchBtn: null,
      queueList: null, emptyQueue: null,
      autoMixBtn: null,
      albumArt: makeArtEl(), artPlaceholder: { style: {} },
      nextAlbumArt: makeArtEl(), nextArtPlaceholder: { style: {} },
      trackArtist: makeDomTextNode(), trackArtistA: makeDomTextNode(), trackArtistB: makeDomTextNode(),
      getQueue: () => queue,
      getDjMode: () => 'music',
      getCurrentIndex: () => currentIndex,
      getCurrentTrackId: () => queue[currentIndex]?.id ?? null,
      getIsPlaying: () => true,
      getDeckBCueIndex: () => -1,
      getDeckCueDeck: () => null,
      getDeckDisplayItems: () => ({ A: queue[0] || null, B: queue[1] || null }),
      getInactiveDeck: () => (focusDeck === 'A' ? 'B' : 'A'),
      getFocusDeck: () => focusDeck,
      getLaunchPreviewState: () => ({ active: false }),
      getPrevIsCrossfading: () => false,
      setPrevIsCrossfading: () => {},
      getDeckMixRatio: () => (focusDeck === 'A' ? 0 : 1),
      setDeckMixRatio: () => {},
      clampDeckMixRatio: (value) => value,
      updateDeckMixUI: () => {},
      updateDeckCueUI: () => {},
      getPlayer: () => null,
    });
  }

  beforeEach(() => {
    global.MediaMetadata = function MediaMetadataStub(init) {
      Object.assign(this, init);
    };
    Object.defineProperty(navigator, 'mediaSession', {
      value: { metadata: null, setActionHandler: () => {}, setPositionState: () => {} },
      writable: true,
      configurable: true,
    });
  });

  test('met à jour la notification système pour la piste du deck en focus (en cours de lecture)', () => {
    const playing = makeTrack({ id: 'now', name: 'Now Playing', artist: 'DJ Focus' });
    const renderer = makeNowPlayingRenderer({ focusDeck: 'A', queue: [playing] });

    renderer.updateNowPlaying(playing, 'A');

    expect(navigator.mediaSession.metadata.title).toBe('Now Playing');
    expect(navigator.mediaSession.metadata.artist).toBe('DJ Focus');
  });

  test('met à jour la notification même quand deck != focusDeck (crossfade entrant)', () => {
    // Pendant un crossfade, targetDeck est le deck inactif (ratio pas encore mis à jour).
    // updateNowPlaying doit quand même écrire la notification — c'est fetchAndStoreArtworkForItem
    // qui porte la responsabilité de ne pas appeler updateNowPlaying pour les préchargements.
    const playing = makeTrack({ id: 'now', name: 'Now Playing', artist: 'DJ Focus' });
    const renderer = makeNowPlayingRenderer({ focusDeck: 'A', queue: [playing] });

    // Simuler un appel crossfade : deck='B' alors que focusDeck est encore 'A'.
    renderer.updateNowPlaying(playing, 'B');

    expect(navigator.mediaSession.metadata.title).toBe('Now Playing');
    expect(navigator.mediaSession.metadata.artist).toBe('DJ Focus');
  });
});
