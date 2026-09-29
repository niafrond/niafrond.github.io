import {
  W, CANNON_Y, BASE, CHAMPION_CHARGE, MAX_BLUE, ROW_FRONT, ROW_BACK, T,
  generateLevel, createGame, step, canLaunchChampion, starsFor, xpFor, mobilityFor, isGateOpen,
  generateBonusLevel, bonusRefLevel, bonusXpReward, BONUS_EVERY,
  PERKS, WEAPONS, HEROES, perkLevel, perkUpgradeCost,
} from '../../engine.js';

const DT = 1 / 60;

function run(g, seconds, input) {
  for (let t = 0; t < seconds && g.status === 'playing'; t += DT) {
    step(g, DT, typeof input === 'function' ? input(g) : input);
    g.events.length = 0;
  }
  return g;
}

describe('generateLevel', () => {
  test('est déterministe', () => {
    expect(generateLevel(7)).toEqual(generateLevel(7));
  });

  test('les portes restent dans le terrain', () => {
    for (let n = 1; n <= 40; n++) {
      for (const g of generateLevel(n).gates) {
        expect(g.minX).toBeLessThanOrEqual(g.maxX);
        expect(g.x - g.w / 2).toBeGreaterThanOrEqual(0);
        expect(g.x + g.w / 2).toBeLessThanOrEqual(W);
      }
    }
  });

  test('la difficulté augmente', () => {
    expect(generateLevel(20).spawnInterval).toBeLessThan(generateLevel(1).spawnInterval);
    expect(generateLevel(20).baseHp).toBeGreaterThan(generateLevel(1).baseHp);
  });

  test('chaque niveau se décompose en 2 à 4 phases, jamais moins ni plus', () => {
    for (let n = 1; n <= 30; n++) {
      const count = generateLevel(n).castles.length;
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  test('la difficulté adaptative augmente la pression ennemie sans changer le terrain', () => {
    const base = generateLevel(5, 0);
    const hard = generateLevel(5, 1);
    expect(hard.waveSize).toBeGreaterThan(base.waveSize);
    expect(hard.spawnGroup).toBeGreaterThanOrEqual(base.spawnGroup);
    expect(hard.gates).toEqual(base.gates);
    expect(hard.castles).toEqual(base.castles);
  });
});

describe('step', () => {
  test('une porte ×3 triple une unité, une seule fois', () => {
    const cfg = generateLevel(1);
    cfg.gates = [{ id: 0, x: W / 2, y: 400, w: 200, h: 14, op: { type: 'mul', n: 3 }, vx: 0, minX: 0, maxX: W }];
    cfg.spawnInterval = 1e9;
    cfg.waveEvery = 1e9;
    const g = createGame(cfg);
    g.blue.push({ x: W / 2, y: 450, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    run(g, 0.35, {});
    expect(g.blue).toHaveLength(3);
    expect(g.blue.every(u => u.mask & 1)).toBe(true);
    run(g, 0.35, {});
    expect(g.blue).toHaveLength(3);
  });

  test('bleu et rouge s’annulent au contact', () => {
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg);
    g.blue.push({ x: 100, y: 300, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    g.red.push({ x: 100, y: 296, vx: 0, vy: 62, hp: 1, r: 5, brute: false });
    step(g, DT, {});
    expect(g.blue).toHaveLength(0);
    expect(g.red).toHaveLength(0);
    expect(g.stats.kills).toBe(1);
  });

  test('le champion se charge en tirant', () => {
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg);
    expect(canLaunchChampion(g)).toBe(false);
    run(g, CHAMPION_CHARGE / 9 + 0.2, { firing: true, targetX: W / 2 });
    expect(canLaunchChampion(g)).toBe(true);
    step(g, DT, { champion: true });
    expect(g.charge).toBe(0);
    expect(g.blue.some(u => u.champ)).toBe(true);
  });

  test('le nombre d’unités bleues est plafonné', () => {
    const cfg = generateLevel(1);
    cfg.gates = [{ id: 0, x: W / 2, y: 500, w: W, h: 14, op: { type: 'mul', n: 5 }, vx: 0, minX: W / 2, maxX: W / 2 }];
    cfg.baseHp = 1e9;
    const g = createGame(cfg);
    run(g, 20, { firing: true, targetX: W / 2 });
    expect(g.stats.peak).toBeLessThanOrEqual(MAX_BLUE);
  });

  test('les ennemis qui atteignent le canon font perdre', () => {
    const g = createGame(generateLevel(5));
    run(g, 300, {});
    expect(g.status).toBe('lost');
    expect(starsFor(g)).toBe(0);
  });

  test('le niveau 1 se gagne en tirant sur la meilleure porte (même à travers un changement de terrain et le boss)', () => {
    const g = createGame(generateLevel(1));
    run(g, 200, gg => {
      const best = [...gg.gates].sort((a, b) => b.y - a.y)[0];
      return { firing: true, targetX: best.x, champion: true };
    });
    expect(g.status).toBe('won');
    expect(g.baseHp).toBe(0);
    expect(starsFor(g)).toBeGreaterThanOrEqual(1);
  });
});

test('constantes cohérentes', () => {
  expect(BASE.y).toBeLessThan(CANNON_Y);
});

describe('Couloirs : les rangées sans porte ouverte forment un mur', () => {
  test('une unité mal alignée est bloquée puis déviée vers le couloir ouvert', () => {
    const cfg = {
      ...generateLevel(1),
      gates: [{ id: 0, x: 50, y: 400, w: 40, h: 14, op: { type: 'mul', n: 2 }, vx: 0, minX: 50, maxX: 50 }],
      spawnInterval: 1e9, waveEvery: 1e9,
    };
    const g = createGame(cfg);
    g.blue.push({ x: 300, y: 450, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    // Sans mur, cette unité (loin de la porte) la traverserait sans effet.
    run(g, 0.05, {});
    expect(g.blue).toHaveLength(1);
    expect(g.blue[0].mask & 1).toBe(0);
    expect(g.blue[0].y).toBeGreaterThanOrEqual(400);
    // Laissée courir, elle est déviée dans le couloir et finit par passer la porte
    // (on s'arrête dès que ça arrive, avant qu'elle n'atteigne la base).
    let passed = false;
    for (let t = 0; t < 3 && g.status === 'playing' && !passed; t += DT) {
      step(g, DT, {});
      g.events.length = 0;
      passed = g.blue.some(u => u.mask & 1);
    }
    expect(passed).toBe(true);
    expect(g.blue.length).toBeGreaterThan(1);
  });

  test('une unité bloquée par un mur bute contre sa surface au lieu de s’enfoncer dedans', () => {
    const cfg = {
      ...generateLevel(1),
      gates: [{ id: 0, x: 50, y: 400, w: 40, h: 14, op: { type: 'mul', n: 2 }, vx: 0, minX: 50, maxX: 50 }],
      spawnInterval: 1e9, waveEvery: 1e9,
    };
    const g = createGame(cfg);
    // Loin du couloir ouvert (x=300 vs porte en x=50), et loin au sud de la
    // rangée pour laisser le temps à la collision de s'enclencher.
    g.blue.push({ x: 300, y: 470, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    for (let t = 0; t < 0.3; t += DT) {
      step(g, DT, {});
      g.events.length = 0;
      // À aucun instant l'unité ne doit franchir la surface avant du mur
      // (elle glisse dessus, jamais à travers ni dedans).
      expect(g.blue[0].y).toBeGreaterThanOrEqual(400 + ROW_FRONT + 5 - 0.001);
    }
    // Elle vient se coller pile contre la surface, pas plus loin.
    expect(g.blue[0].y).toBeCloseTo(400 + ROW_FRONT + 5, 5);
  });

  test('une unité déjà alignée passe normalement, sans être bloquée', () => {
    const cfg = {
      ...generateLevel(1),
      gates: [{ id: 0, x: W / 2, y: 400, w: 200, h: 14, op: { type: 'mul', n: 2 }, vx: 0, minX: 0, maxX: W }],
      spawnInterval: 1e9, waveEvery: 1e9,
    };
    const g = createGame(cfg);
    g.blue.push({ x: W / 2, y: 450, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    run(g, 0.35, {});
    expect(g.blue).toHaveLength(2);
    expect(g.blue.every(u => u.mask & 1)).toBe(true);
  });
});

describe('Portes originales : verrouillées (sacrifice) et pulsées (intervalle)', () => {
  test('isGateOpen : normale toujours ouverte, verrouillée selon locked, pulsée selon active', () => {
    expect(isGateOpen({ kind: 'normal' })).toBe(true);
    expect(isGateOpen({ kind: 'lock', locked: true })).toBe(false);
    expect(isGateOpen({ kind: 'lock', locked: false })).toBe(true);
    expect(isGateOpen({ kind: 'pulse', active: true })).toBe(true);
    expect(isGateOpen({ kind: 'pulse', active: false })).toBe(false);
  });

  test('une porte verrouillée sacrifie les unités jusqu’à céder, puis émet gateUnlocked et reste ouverte', () => {
    const cfg = {
      ...generateLevel(1),
      gates: [{ id: 0, x: W / 2, y: 400, w: 200, h: 14, op: { type: 'mul', n: 3 }, vx: 0, minX: 0, maxX: W, kind: 'lock', locked: true, hits: 0, lockHits: 2 }],
      spawnInterval: 1e9, waveEvery: 1e9,
    };
    const g = createGame(cfg);
    g.blue.push({ x: W / 2, y: 450, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    let unlocked = null;
    for (let t = 0; t < 0.35 && !unlocked; t += DT) {
      step(g, DT, {});
      unlocked = g.events.find(e => e.type === 'gateUnlocked') || null;
      g.events.length = 0;
    }
    // lockHits=2 : un seul sacrifice ne suffit pas encore.
    expect(unlocked).toBeNull();
    expect(g.gates[0].locked).toBe(true);
    expect(g.gates[0].hits).toBe(1);
    expect(g.blue).toHaveLength(0); // l'unité s'est sacrifiée contre le mur

    g.blue.push({ x: W / 2, y: 450, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    for (let t = 0; t < 0.35 && !unlocked; t += DT) {
      step(g, DT, {});
      unlocked = g.events.find(e => e.type === 'gateUnlocked') || null;
      g.events.length = 0;
    }
    expect(unlocked).not.toBeNull();
    expect(g.gates[0].locked).toBe(false);
  });

  test('une fois déverrouillée, la porte se comporte comme une porte × normale', () => {
    const cfg = {
      ...generateLevel(1),
      gates: [{ id: 0, x: W / 2, y: 400, w: 200, h: 14, op: { type: 'mul', n: 3 }, vx: 0, minX: 0, maxX: W, kind: 'lock', locked: false, hits: 2, lockHits: 2 }],
      spawnInterval: 1e9, waveEvery: 1e9,
    };
    const g = createGame(cfg);
    g.blue.push({ x: W / 2, y: 450, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    run(g, 0.35, {});
    expect(g.blue).toHaveLength(3);
    expect(g.blue.every(u => u.mask & 1)).toBe(true);
  });

  test('une porte pulsée bloque pendant sa phase fermée et laisse passer une fois rouverte', () => {
    const cfg = {
      ...generateLevel(1),
      gates: [{ id: 0, x: W / 2, y: 400, w: 200, h: 14, op: { type: 'mul', n: 2 }, vx: 0, minX: 0, maxX: W, kind: 'pulse', pulseOn: 1, pulseOff: 1, pulseT: 1, active: false }],
      spawnInterval: 1e9, waveEvery: 1e9,
    };
    const g = createGame(cfg);
    g.blue.push({ x: W / 2, y: 450, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    // Phase fermée initiale : l'unité vient buter contre le mur et attend.
    run(g, 0.3, {});
    expect(g.blue).toHaveLength(1);
    expect(g.blue[0].mask & 1).toBe(0);

    // Un cycle complet plus tard (pulseOn+pulseOff=2s), une phase ouverte a
    // forcément eu lieu : l'unité qui attendait contre le mur en a profité.
    run(g, 2.2, {});
    expect(g.blue.some(u => u.mask & 1)).toBe(true);
  });

  test('les portes verrouillées/pulsées n’apparaissent que sur des portes ×, jamais ÷', () => {
    for (let n = 4; n <= 25; n++) {
      for (const g of generateLevel(n).gates) {
        if (g.kind === 'lock' || g.kind === 'pulse') expect(g.op.type).toBe('mul');
      }
    }
  });

  test('au plus une porte spéciale par rangée', () => {
    for (let n = 4; n <= 25; n++) {
      const byY = new Map();
      for (const g of generateLevel(n).gates) {
        if (!byY.has(g.y)) byY.set(g.y, []);
        byY.get(g.y).push(g);
      }
      for (const row of byY.values()) {
        const specials = row.filter(g => g.kind === 'lock' || g.kind === 'pulse').length;
        expect(specials).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('Séquence de châteaux (2 à 4 phases, puis un grand château final)', () => {
  test('même le niveau 1 se décompose en au moins deux phases', () => {
    const lvl = generateLevel(1);
    expect(lvl.castles.length).toBeGreaterThanOrEqual(2);
    expect(lvl.castles.reduce((a, b) => a + b, 0)).toBe(lvl.baseHp);
  });

  test('un niveau avancé a plusieurs châteaux, dont un dernier plus gros, dont la somme fait le total', () => {
    const lvl = generateLevel(10);
    expect(lvl.castles.length).toBeGreaterThan(1);
    expect(lvl.castles.reduce((a, b) => a + b, 0)).toBe(lvl.baseHp);
    expect(lvl.castles[lvl.castles.length - 1]).toBeGreaterThan(lvl.castles[0]);
  });

  test('détruire un mini-château fait progresser castleIndex sans terminer le niveau', () => {
    const cfg = { ...generateLevel(1), castles: [10, 10, 50], baseHp: 70, gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg);
    g.blue.push({ x: BASE.x, y: BASE.y, vx: 0, vy: 0, hp: 15, r: 5, mask: 0, champ: false });
    step(g, DT, {});
    expect(g.castleIndex).toBe(1);
    expect(g.castleHp).toBe(5);
    expect(g.status).toBe('playing');
    expect(g.events.some(e => e.type === 'castleDown' && e.index === 1 && e.final === false)).toBe(true);
  });

  test('un niveau avancé a un terrain distinct par mini-château', () => {
    const lvl = generateLevel(10);
    expect(lvl.terrains.length).toBe(lvl.castles.length);
    // Les terrains ont des identifiants de portes propres (0..k-1 chacun),
    // mais leurs dispositions ne sont pas toutes identiques.
    const layouts = lvl.terrains.map(t => JSON.stringify(t.map(({ x, y, op }) => [x, y, op])));
    expect(new Set(layouts).size).toBeGreaterThan(1);
  });

  test('détruire un mini-château change la configuration du terrain (portes)', () => {
    const lvl = generateLevel(10);
    const g = createGame(lvl);
    const initialGates = JSON.stringify(g.gates.map(({ x, y, op }) => [x, y, op]));
    // Force la destruction du premier mini-château.
    g.blue.push({ x: BASE.x, y: BASE.y, vx: 0, vy: 0, hp: g.castleHp, r: 5, mask: 0, champ: false });
    step(g, DT, {});
    expect(g.castleIndex).toBe(1);
    const ev = g.events.find(e => e.type === 'castleDown' && e.index === 1);
    expect(ev.terrainChanged).toBe(true);
    const newGates = JSON.stringify(g.gates.map(({ x, y, op }) => [x, y, op]));
    expect(newGates).not.toBe(initialGates);
    expect(newGates).toBe(JSON.stringify(lvl.terrains[1].map(({ x, y, op }) => [x, y, op])));
  });

  test('les unités déjà en jeu perdent leur progression de portes au changement de terrain', () => {
    const lvl = generateLevel(10);
    const g = createGame(lvl);
    const flying = { x: BASE.x, y: 350, vx: 0, vy: 0, hp: 1, r: 5, mask: 0b111, champ: false };
    g.blue.push(flying);
    g.blue.push({ x: BASE.x, y: BASE.y, vx: 0, vy: 0, hp: g.castleHp, r: 5, mask: 0, champ: false });
    step(g, DT, {});
    expect(g.castleIndex).toBe(1);
    expect(flying.mask).toBe(0);
  });
});

describe('Mur d’affrontement (SPECS.md §4)', () => {
  test('un rouge de mur vivant bloque physiquement une unité bleue : elle ne dépasse jamais un mur qu’elle ne peut vaincre', () => {
    // Sans porte ni mur de terrain (`gates: []`), seul le mur d’affrontement
    // peut empêcher l’unité d’atteindre la base — un test isolé de la
    // mécanique, indépendant des portes.
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg);
    g.walls.push({ id: 0, total: 1, alive: 1, cleared: false });
    g.red.push({ x: BASE.x, y: 250, vx: 0, vy: 0, hp: 99, r: 5, brute: false, wallId: 0 });
    g.blue.push({ x: BASE.x, y: 400, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    run(g, 2, {});
    expect(g.blue).toHaveLength(0);            // consommée au contact du mur
    expect(g.baseHp).toBe(cfg.baseHp);          // jamais atteint la base
    expect(g.walls[0].cleared).toBe(false);     // le rouge de mur (99 PV) a survécu
  });

  test('le blocage s’applique aussi à un champion à PV élevés (aucune exemption)', () => {
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg);
    g.walls.push({ id: 0, total: 1, alive: 1, cleared: false });
    g.red.push({ x: BASE.x, y: 250, vx: 0, vy: 0, hp: 99, r: 5, brute: false, wallId: 0 });
    g.blue.push({ x: BASE.x, y: 400, vx: 0, vy: -68, hp: 25, r: 13, mask: 0, champ: true });
    run(g, 3, {});
    expect(g.baseHp).toBe(cfg.baseHp);
  });

  test('la mort du dernier membre d’un mur émet wallCleared et lève le blocage', () => {
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg);
    g.walls.push({ id: 0, total: 1, alive: 1, cleared: false });
    g.red.push({ x: BASE.x, y: 250, vx: 0, vy: 0, hp: 1, r: 5, brute: false, wallId: 0 });
    g.blue.push({ x: BASE.x, y: 250, vx: 0, vy: -170, hp: 2, r: 5, mask: 0, champ: false });
    step(g, DT, {});
    expect(g.events.some(e => e.type === 'wallCleared' && e.id === 0)).toBe(true);
    expect(g.walls[0].cleared).toBe(true);
    expect(g.walls[0].alive).toBe(0);
    expect(g.blue).toHaveLength(1);
    expect(g.blue[0].hp).toBe(1); // a survécu au combat, libre de continuer vers la base
  });

  test('une vague crée un mur bloquant tant que le quota de murs du château n’est pas atteint', () => {
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 1e9, waveEvery: 1, waveSize: 6, wallsPerCastle: 1 };
    const g = createGame(cfg);
    let sawWallWave = false;
    for (let t = 0; t < 1.05; t += DT) {
      step(g, DT, {});
      if (g.events.some(e => e.type === 'wave' && e.wall === true)) sawWallWave = true;
      g.events.length = 0;
    }
    expect(sawWallWave).toBe(true);
    expect(g.walls).toHaveLength(1);
    expect(g.walls[0].cleared).toBe(false);
    expect(g.red).toHaveLength(6);
    expect(g.red.every(e => e.wallId === 0)).toBe(true);
  });

  test('au-delà du quota de murs du château, une vague redevient un flux classique non bloquant', () => {
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 1e9, waveEvery: 1, waveSize: 3, wallsPerCastle: 1 };
    const g = createGame(cfg);
    g.wallsSpawnedThisCastle = 1; // quota déjà atteint pour ce château
    run(g, 1.05, {});
    expect(g.walls).toHaveLength(0);
    expect(g.red).toHaveLength(3);
    expect(g.red.every(e => e.wallId === undefined)).toBe(true);
  });

  test('le flux continu rejoint le mur actif plutôt que d’en ouvrir un second', () => {
    const cfg = { ...generateLevel(1), gates: [], waveEvery: 1e9, spawnInterval: 0.1, spawnGroup: 1 };
    const g = createGame(cfg);
    g.walls.push({ id: 0, total: 1, alive: 1, cleared: false });
    g.red.push({ x: BASE.x, y: 250, vx: 0, vy: 0, hp: 1, r: 5, brute: false, wallId: 0 });
    run(g, 0.5, {});
    expect(g.red.length).toBeGreaterThan(1);
    expect(g.red.every(e => e.wallId === 0)).toBe(true);
    expect(g.walls).toHaveLength(1); // toujours un seul mur, jamais un second
  });

  test('changer de château (mini-château détruit) réinitialise le quota de murs', () => {
    const cfg = { ...generateLevel(1), castles: [10, 10, 50], baseHp: 70, gates: [], spawnInterval: 1e9, waveEvery: 1e9, wallsPerCastle: 2 };
    const g = createGame(cfg);
    g.wallsSpawnedThisCastle = 2;
    g.blue.push({ x: BASE.x, y: BASE.y, vx: 0, vy: 0, hp: 15, r: 5, mask: 0, champ: false });
    step(g, DT, {});
    expect(g.castleIndex).toBe(1);
    expect(g.wallsSpawnedThisCastle).toBe(0);
  });

  test('wallsPerCastle est borné entre 1 et 3 et croît avec le niveau', () => {
    expect(generateLevel(1).wallsPerCastle).toBe(1);
    expect(generateLevel(6).wallsPerCastle).toBeGreaterThan(generateLevel(1).wallsPerCastle);
    for (let n = 1; n <= 40; n++) {
      const w = generateLevel(n).wallsPerCastle;
      expect(w).toBeGreaterThanOrEqual(1);
      expect(w).toBeLessThanOrEqual(3);
    }
  });
});

describe('Engagement généralisé (SPECS.md §5)', () => {
  test('un rouge isolé (hors mur) bloque aussi une unité bleue : elle doit d’abord le tuer avant d’atteindre la base', () => {
    // Rouge "libre" : ni wallId, ni entrée dans g.walls — seule la portée
    // d'engagement généralisée (§5) peut donc expliquer un blocage ici.
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg);
    g.red.push({ x: BASE.x, y: 250, vx: 0, vy: 0, hp: 99, r: 5, brute: false });
    g.blue.push({ x: BASE.x, y: 300, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    run(g, 2, {});
    expect(g.blue).toHaveLength(0);      // consommée au contact du rouge isolé
    expect(g.baseHp).toBe(cfg.baseHp);   // jamais atteint la base
  });

  test('une unité bleue cible activement le rouge vivant le plus proche plutôt que le centre du château', () => {
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg);
    // Rouge décalé sur le côté mais à portée (ENGAGE_RANGE) : sans ciblage
    // actif, l'unité (alignée avec BASE.x, y >= 300) n'aurait aucune raison
    // de dévier de sa trajectoire.
    g.red.push({ x: BASE.x - 60, y: 260, vx: 0, vy: 0, hp: 99, r: 5, brute: false });
    g.blue.push({ x: BASE.x, y: 300, vx: 0, vy: -20, hp: 1, r: 5, mask: 0, champ: false });
    step(g, DT, {});
    expect(g.blue[0].vx).toBeLessThan(0); // dévie vers la gauche, en direction du rouge
  });

  test('sans cible à portée, le comportement par défaut (pilotage vers le château) reprend', () => {
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg);
    // Aucun rouge sur le terrain : rien à engager.
    g.blue.push({ x: BASE.x - 60, y: 200, vx: 0, vy: -20, hp: 1, r: 5, mask: 0, champ: false });
    step(g, DT, {});
    expect(g.blue[0].vx).toBeGreaterThan(0); // se recentre vers BASE.x (à droite)
  });
});

describe('Rouges bloqués par les murs/portes (SPECS.md §6)', () => {
  test('un rouge non aligné glisse vers la porte la plus proche au contact d’un mur plein', () => {
    const cfg = generateLevel(1);
    cfg.gates = [{ id: 0, x: W - 40, y: 300, w: 60, h: 14, op: { type: 'mul', n: 2 }, vx: 0, minX: W - 40, maxX: W - 40 }];
    cfg.spawnInterval = 1e9;
    cfg.waveEvery = 1e9;
    const g = createGame(cfg);
    // Juste au bord de la bande de blocage (row.y - ROW_BACK - r), loin de
    // la porte (à droite) : rien ne devrait le laisser passer tout droit.
    g.red.push({ x: 60, y: 300 - ROW_BACK - 5, vx: 0, vy: 40, hp: 1, r: 5, brute: false });
    step(g, DT, {});
    expect(g.red[0].vx).toBeGreaterThan(0);              // glisse vers la droite, vers la porte
    expect(g.red[0].y).toBeLessThanOrEqual(300 - ROW_BACK - 5 + 0.01); // n'a pas traversé le mur
  });

  test('sans mur ni porte sur son chemin, un rouge isolé continue normalement vers le canon', () => {
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg);
    g.red.push({ x: BASE.x, y: 250, vx: 0, vy: 40, hp: 1, r: 5, brute: false });
    run(g, 2, {});
    expect(g.red[0].y).toBeGreaterThan(250 + 40); // a bien progressé vers le canon
  });

  test('un rouge franchit librement une porte verrouillée encore fermée (le sacrifice reste réservé aux bleues)', () => {
    const cfg = generateLevel(1);
    cfg.gates = [{
      id: 0, x: W / 2, y: 300, w: 200, h: 14, op: { type: 'mul', n: 2 }, vx: 0, minX: W / 2, maxX: W / 2,
      kind: 'lock', locked: true, hits: 0, lockHits: 3,
    }];
    cfg.spawnInterval = 1e9;
    cfg.waveEvery = 1e9;
    const g = createGame(cfg);
    g.red.push({ x: W / 2, y: 250, vx: 0, vy: 40, hp: 1, r: 5, brute: false });
    run(g, 2, {});
    expect(g.red[0].y).toBeGreaterThan(300);   // a bien franchi la rangée malgré le verrou
    expect(g.gates[0].locked).toBe(true);      // la porte reste verrouillée : aucun sacrifice déclenché
  });

  test('le niveau 1 reste gagnable en tirant sur la meilleure porte, rouges bloqués par les murs compris', () => {
    // Non-régression : SPEC-6 ne doit jamais empêcher les rouges d'atteindre
    // le canon quand le joueur ne défend pas (ex. cul-de-sac verrouillé sans
    // aucun bleu envoyé pour le déverrouiller).
    const g = createGame(generateLevel(5));
    run(g, 300, {});
    expect(g.status).toBe('lost');
  });
});

describe('Le mur d’affrontement ne grossit jamais à l’infini', () => {
  test('un mur cesse d’être renforcé une fois son plafond atteint (WALL_MAX_MEMBERS = 40)', () => {
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 0.05, spawnGroup: 3, waveEvery: 1e9 };
    const g = createGame(cfg);
    g.walls.push({ id: 0, total: 1, alive: 1, cleared: false });
    g.red.push({ x: BASE.x, y: 250, vx: 0, vy: 0, hp: 1e9, r: 5, brute: false, wallId: 0 });
    run(g, 10, {});
    expect(g.walls[0].total).toBeLessThanOrEqual(40);
    expect(g.walls[0].cleared).toBe(false); // toujours bloquant, juste plus renforcé
  });
});

describe('Combat de boss (après le dernier château)', () => {
  test('détruire le dernier château démarre un combat de boss, sans terminer le niveau', () => {
    const cfg = { ...generateLevel(1), castles: [10, 30], baseHp: 40, gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg);
    g.blue.push({ x: BASE.x, y: BASE.y, vx: 0, vy: 0, hp: 40, r: 5, mask: 0, champ: false });
    step(g, DT, {});
    expect(g.baseHp).toBe(0);
    expect(g.status).toBe('playing');
    expect(g.boss).toEqual({ wavesLeft: T.BOSS_WAVES, wavesTotal: T.BOSS_WAVES });
    expect(g.events.some(e => e.type === 'bossStart' && e.wavesTotal === T.BOSS_WAVES)).toBe(true);
    expect(g.events.some(e => e.type === 'won')).toBe(false);
  });

  test('survivre aux vagues de boss termine enfin le niveau', () => {
    const cfg = { ...generateLevel(1), castles: [10, 30], baseHp: 40, gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg);
    g.blue.push({ x: BASE.x, y: BASE.y, vx: 0, vy: 0, hp: 40, r: 5, mask: 0, champ: false });
    step(g, DT, {}); // détruit le dernier château, démarre le boss
    expect(g.status).toBe('playing');
    g.boss.wavesLeft = 0; // simule les vagues de boss survécues
    step(g, DT, {});
    expect(g.status).toBe('won');
    expect(g.events.some(e => e.type === 'won')).toBe(true);
  });

  test('le canon peut quand même tomber pendant le combat de boss', () => {
    const cfg = { ...generateLevel(1), castles: [10, 30], baseHp: 40, gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg);
    g.boss = { wavesLeft: 2, wavesTotal: 3 };
    g.baseHp = 0;
    g.cannonHp = 0;
    step(g, DT, {});
    expect(g.status).toBe('lost');
  });

  test('un combat de boss double la taille des vagues d’ennemis', () => {
    const cfg = { ...generateLevel(1), castles: [10, 30], baseHp: 40, gates: [], spawnInterval: 1e9, waveEvery: 1e9, waveSize: 4, bruteChance: 0 };
    const normal = createGame(cfg);
    normal.waveAcc = normal.cfg.waveEvery; // force le déclenchement immédiat
    step(normal, DT, {});
    const normalCount = normal.red.length;
    expect(normalCount).toBeGreaterThan(0);

    const boss = createGame(cfg);
    boss.boss = { wavesLeft: 3, wavesTotal: 3 };
    boss.waveAcc = boss.cfg.waveEvery;
    step(boss, DT, {});
    expect(boss.red.length).toBe(normalCount * 2);
  });
});

describe('Progression : XP et difficulté adaptative', () => {
  test('xpFor récompense la progression même en cas de défaite', () => {
    const g = createGame(generateLevel(5));
    g.castleIndex = 1;
    g.stats.kills = 20;
    g.status = 'lost';
    expect(xpFor(g)).toBeGreaterThan(0);
  });

  test('xpFor donne un bonus supplémentaire à la victoire', () => {
    const g = createGame(generateLevel(5));
    g.castleIndex = 1;
    g.stats.kills = 20;
    g.status = 'playing';
    const lost = xpFor({ ...g, status: 'lost' });
    const won = xpFor({ ...g, status: 'won' });
    expect(won).toBeGreaterThan(lost);
  });

  test('un joueur qui ne bouge jamais le canon a une mobilité nulle', () => {
    const g = createGame(generateLevel(1));
    run(g, 1, { firing: true });
    expect(mobilityFor(g)).toBe(0);
  });

  test('mobilityFor mesure le déplacement moyen du canon par seconde', () => {
    const g = createGame(generateLevel(1));
    run(g, 1, { targetX: 0 });
    expect(mobilityFor(g)).toBeGreaterThan(0);
  });
});

describe('RPG : compétences, armes, héros', () => {
  test('sans loadout, le comportement est identique au canon standard', () => {
    const g = createGame(generateLevel(1));
    expect(g.fireRate).toBe(9);
    expect(g.championCharge).toBe(CHAMPION_CHARGE);
    expect(g.cannonHpMax).toBe(g.cfg.cannonHp);
  });

  test('les compétences modifient la cadence, la charge et les PV de canon', () => {
    const g = createGame(generateLevel(1), { perks: { cadence: 1, charge: 1, blindage: 1 } });
    expect(g.fireRate).toBeCloseTo(9 * 1.1);
    expect(g.championCharge).toBeLessThan(CHAMPION_CHARGE);
    expect(g.cannonHpMax).toBe(g.cfg.cannonHp + 2);
    expect(g.cannonHp).toBe(g.cannonHpMax);
  });

  test('les compétences sont évolutives : un niveau plus élevé renforce l’effet', () => {
    const lvl1 = createGame(generateLevel(1), { perks: { cadence: 1 } });
    const lvl3 = createGame(generateLevel(1), { perks: { cadence: 3 } });
    expect(lvl3.fireRate).toBeGreaterThan(lvl1.fireRate);
    expect(perkLevel({ cadence: 3 }, 'cadence')).toBe(3);
    // Le niveau est plafonné à maxLevel même si la sauvegarde en dit plus.
    expect(perkLevel({ cadence: 99 }, 'cadence')).toBe(PERKS.cadence.maxLevel);
    // Plus de niveau disponible une fois au maximum.
    expect(perkUpgradeCost('cadence', PERKS.cadence.maxLevel)).toBeUndefined();
    expect(perkUpgradeCost('cadence', 0)).toBe(PERKS.cadence.costPerLevel[0]);
  });

  test('l’arme perforante fait ignorer les portes ÷', () => {
    const cfg = {
      ...generateLevel(1),
      gates: [{ id: 0, x: W / 2, y: 400, w: 200, h: 14, op: { type: 'div', n: 2 }, vx: 0, minX: 0, maxX: W }],
      spawnInterval: 1e9, waveEvery: 1e9,
    };
    const g = createGame(cfg, { weapon: 'perforant' });
    g.blue.push({ x: W / 2, y: 450, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    run(g, 0.35, {});
    expect(g.blue).toHaveLength(1);
    expect(g.blue[0].hp).toBe(1);
  });

  test('le canon lourd tire des unités qui encaissent plusieurs PV', () => {
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg, { weapon: 'lourd' });
    run(g, 0.3, { firing: true, targetX: W / 2 });
    expect(g.blue.length).toBeGreaterThan(0);
    expect(g.blue.every(u => u.hp === WEAPONS.lourd.shotHp)).toBe(true);
  });

  test('le canon jumeau tire toujours un nombre pair d’unités par cadence', () => {
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg, { weapon: 'jumeau' });
    run(g, 0.3, { firing: true, targetX: W / 2 });
    expect(g.blue.length).toBeGreaterThan(0);
    expect(g.blue.length % 2).toBe(0);
  });

  test('le héros gardien accorde des PV de canon supplémentaires', () => {
    const g = createGame(generateLevel(1), { hero: 'gardien' });
    expect(g.cannonHpMax).toBe(g.cfg.cannonHp + HEROES.gardien.cannonHpBonus);
  });

  test('la sentinelle charge le champion plus vite par tir', () => {
    const cfg = { ...generateLevel(1), gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const std = createGame(cfg, { hero: 'champion' });
    run(std, 0.2, { firing: true, targetX: W / 2 });
    const sent = createGame(cfg, { hero: 'sentinelle' });
    run(sent, 0.2, { firing: true, targetX: W / 2 });
    expect(sent.charge).toBeGreaterThan(std.charge);
  });

  test('un héros au bonus de clonage démultiplie plus le champion dans une porte ×', () => {
    const cfg = {
      ...generateLevel(1),
      gates: [{ id: 0, x: W / 2, y: 400, w: 200, h: 14, op: { type: 'mul', n: 3 }, vx: 0, minX: 0, maxX: W }],
      spawnInterval: 1e9, waveEvery: 1e9,
    };
    const standard = createGame(cfg, { hero: 'champion' });
    standard.blue.push({ x: W / 2, y: 450, vx: 0, vy: -170, hp: 25, r: 13, mask: 0, champ: true });
    run(standard, 0.35, {});
    const colosse = createGame(cfg, { hero: 'colosse' });
    colosse.blue.push({ x: W / 2, y: 450, vx: 0, vy: -170, hp: 45, r: 13, mask: 0, champ: true });
    run(colosse, 0.35, {});
    expect(colosse.blue.length).toBeLessThan(standard.blue.length);
  });

  test('generateBonusLevel est déterministe, toujours plus dur que le niveau principal équivalent', () => {
    expect(generateBonusLevel(2)).toEqual(generateBonusLevel(2));
    const bonus = generateBonusLevel(2);
    const main = generateLevel(bonusRefLevel(2));
    expect(bonus.baseHp).toBeGreaterThan(main.baseHp);
    expect(bonus.bonus).toBe(true);
  });

  test('bonusXpReward augmente avec le palier, bonusRefLevel est stable', () => {
    expect(bonusXpReward(2)).toBeGreaterThan(bonusXpReward(1));
    expect(bonusRefLevel(1)).toBe(BONUS_EVERY);
  });
});
