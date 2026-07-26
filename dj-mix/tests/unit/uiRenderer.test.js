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
  relayIncomingStatus = null,
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
    getRelayIncomingStatus: () => relayIncomingStatus,
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

  test('titre et artiste sont rendus dans des blocs séparés (SPEC-14.2.6)', () => {
    const track = makeTrack({ name: 'Titre Test', artist: 'Artiste Test', genre: null, bpm: null });
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
      getDjMode: () => 'music',
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
    expect(trackArtistA.innerHTML).toContain('<div class="deck-track-title">Titre Test</div>');
    expect(trackArtistA.innerHTML).toContain('<div class="deck-track-artist-name">Artiste Test</div>');
    expect(trackArtistA.innerHTML).not.toContain(' • ');
  });
});

describe('buildQueueHTML — file "incoming" du relais (SPEC-9.5)', () => {
  test('aucune ligne incoming quand getRelayIncomingStatus ne renvoie rien', () => {
    const tracks = [makeTrack({ id: 't1' })];
    const { buildQueueHTML } = makeRenderer({ queue: tracks, relayIncomingStatus: null });
    const html = buildQueueHTML();
    expect(html).not.toContain('queue-incoming-row');
  });

  test('slot "Lire maintenant" inséré juste après l\'item courant, teinte --now', () => {
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })];
    const { buildQueueHTML } = makeRenderer({
      queue: tracks,
      currentTrackId: 't1',
      currentIndexOverride: 0,
      relayIncomingStatus: {
        now: { name: 'Incoming Now', artist: 'DJ X', artUrl: '' },
        next: [],
      },
    });
    const html = buildQueueHTML();
    // Ordre : item courant (index 0) → ligne incoming "now" → item suivant (index 1)
    const currentPos = html.indexOf('data-index="0"');
    const incomingPos = html.indexOf('queue-incoming-row--now');
    const nextPos = html.indexOf('data-index="1"');
    expect(currentPos).toBeGreaterThanOrEqual(0);
    expect(incomingPos).toBeGreaterThan(currentPos);
    expect(nextPos).toBeGreaterThan(incomingPos);
    expect(html).toContain('Incoming Now');
    expect(html).toContain('Lire maintenant');
  });

  test('slots "Ajouter en suivant" affichés dans l\'ordre FIFO, teinte --next', () => {
    const tracks = [makeTrack({ id: 't1' })];
    const { buildQueueHTML } = makeRenderer({
      queue: tracks,
      currentTrackId: 't1',
      currentIndexOverride: 0,
      relayIncomingStatus: {
        now: null,
        next: [
          { name: 'First', artist: 'A1', artUrl: '', ready: false },
          { name: 'Second', artist: 'A2', artUrl: '', ready: true },
        ],
      },
    });
    const html = buildQueueHTML();
    expect(html.indexOf('First')).toBeLessThan(html.indexOf('Second'));
    expect(html).toContain('queue-incoming-row--next');
    expect(html).toContain('Ajouter ensuite');
  });

  test('slot "next" ready=true affiche le statut --ready (pas --loading)', () => {
    const tracks = [makeTrack({ id: 't1' })];
    const { buildQueueHTML } = makeRenderer({
      queue: tracks,
      currentTrackId: 't1',
      currentIndexOverride: 0,
      relayIncomingStatus: {
        now: null,
        next: [{ name: 'Ready track', artist: '', artUrl: '', ready: true }],
      },
    });
    const html = buildQueueHTML();
    expect(html).toContain('queue-incoming-status--ready');
    expect(html).not.toContain('queue-incoming-status--loading');
  });

  test('les lignes incoming n\'ont ni data-index ni la classe queue-item (pas de branchement DnD)', () => {
    const tracks = [makeTrack({ id: 't1' })];
    const { buildQueueHTML } = makeRenderer({
      queue: tracks,
      currentTrackId: 't1',
      currentIndexOverride: 0,
      relayIncomingStatus: {
        now: { name: 'Incoming', artist: '', artUrl: '' },
        next: [],
      },
    });
    const html = buildQueueHTML();
    const incomingBlock = html.slice(html.indexOf('queue-incoming-row--now'));
    const incomingRowHtml = incomingBlock.slice(0, incomingBlock.indexOf('</div></div>') + 12);
    expect(incomingRowHtml).not.toContain('data-index');
    expect(incomingRowHtml).not.toMatch(/class="[^"]*\bqueue-item\b/);
  });

  test('placeholders en tête de liste quand aucune piste n\'est en cours (currentIndex < 0)', () => {
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })];
    const { buildQueueHTML } = makeRenderer({
      queue: tracks,
      currentTrackId: null,
      currentIndexOverride: -1,
      relayIncomingStatus: {
        now: { name: 'Incoming', artist: '', artUrl: '' },
        next: [],
      },
    });
    const html = buildQueueHTML();
    expect(html.indexOf('queue-incoming-row--now')).toBeLessThan(html.indexOf('data-index="0"'));
  });

  test('SPEC-9.5.5 — la ligne incoming se repositionne quand currentIndex avance entre deux rendus', () => {
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' }), makeTrack({ id: 't3' })];
    const relayIncomingStatus = {
      now: null,
      next: [{ name: 'Pending', artist: '', artUrl: '', ready: false }],
    };
    const { buildQueueHTML } = makeRenderer({
      queue: tracks,
      currentTrackId: 't1',
      currentIndexOverride: 0,
      relayIncomingStatus,
    });
    const htmlBefore = buildQueueHTML();
    expect(htmlBefore.indexOf('data-index="0"')).toBeLessThan(htmlBefore.indexOf('queue-incoming-row--next'));
    expect(htmlBefore.indexOf('queue-incoming-row--next')).toBeLessThan(htmlBefore.indexOf('data-index="1"'));

    // La piste courante avance (t1 → t2) sans que le slot "next" ait fini de télécharger.
    const { buildQueueHTML: buildQueueHTMLAfter } = makeRenderer({
      queue: tracks,
      currentTrackId: 't2',
      currentIndexOverride: 1,
      relayIncomingStatus,
    });
    const htmlAfter = buildQueueHTMLAfter();
    expect(htmlAfter.indexOf('data-index="1"')).toBeLessThan(htmlAfter.indexOf('queue-incoming-row--next'));
    expect(htmlAfter.indexOf('queue-incoming-row--next')).toBeLessThan(htmlAfter.indexOf('data-index="2"'));
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

  test('SPEC-13.3.2 — convertit toute artUrl en data URI (blob: ou https://)', async () => {
    const dataUri = 'data:image/jpeg;base64,ZmFrZQ==';
    const mockBlob = { type: 'image/jpeg' };
    const origFetch = global.fetch;
    const origFileReader = global.FileReader;

    global.fetch = async () => ({ ok: true, blob: async () => mockBlob });
    global.FileReader = class {
      readAsDataURL() {
        this.result = dataUri;
        if (this.onload) this.onload();
      }
    };

    const playing = makeTrack({ id: 'art', name: 'Art Track', artUrl: 'https://cdn.example.com/art.jpg' });
    const renderer = makeNowPlayingRenderer({ focusDeck: 'A', queue: [playing] });

    renderer.updateNowPlaying(playing, 'A');

    // Attendre la résolution asynchrone
    await new Promise((resolve) => setTimeout(resolve, 0));

    const artwork = navigator.mediaSession.metadata?.artwork;
    expect(Array.isArray(artwork)).toBe(true);
    expect(artwork[0].src).toBe(dataUri);
    expect(artwork[0].type).toBe('image/jpeg');

    global.fetch = origFetch;
    global.FileReader = origFileReader;
  });
});
