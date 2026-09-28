import {
  W, CANNON_Y, BASE, CHAMPION_CHARGE, MAX_BLUE,
  generateLevel, createGame, step, canLaunchChampion, starsFor,
  generateBonusLevel, bonusRewardFor, bonusUnlockLevel, BONUS_EVERY,
  PERKS, perkLevel, perkUpgradeCost,
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
});

describe('step', () => {
  test('une porte ×3 triple une unité, une seule fois', () => {
    const cfg = generateLevel(1);
    cfg.gates = [{ id: 0, x: W / 2, y: 400, w: 200, h: 14, op: { type: 'mul', n: 3 }, vx: 0, minX: 0, maxX: W }];
    cfg.spawnInterval = 1e9;
    cfg.waveEvery = 1e9;
    const g = createGame(cfg);
    g.blue.push({ x: W / 2, y: 410, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    run(g, 0.2, {});
    expect(g.blue).toHaveLength(3);
    expect(g.blue.every(u => u.mask & 1)).toBe(true);
    run(g, 0.2, {});
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

  test('le niveau 1 se gagne en tirant sur la meilleure porte', () => {
    const g = createGame(generateLevel(1));
    const best = [...g.gates].sort((a, b) => b.y - a.y)[0];
    run(g, 120, gg => ({ firing: true, targetX: best.x, champion: true }));
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
    g.blue.push({ x: 300, y: 410, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
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

  test('une unité déjà alignée passe normalement, sans être bloquée', () => {
    const cfg = {
      ...generateLevel(1),
      gates: [{ id: 0, x: W / 2, y: 400, w: 200, h: 14, op: { type: 'mul', n: 2 }, vx: 0, minX: 0, maxX: W }],
      spawnInterval: 1e9, waveEvery: 1e9,
    };
    const g = createGame(cfg);
    g.blue.push({ x: W / 2, y: 410, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    run(g, 0.2, {});
    expect(g.blue).toHaveLength(2);
    expect(g.blue.every(u => u.mask & 1)).toBe(true);
  });
});

describe('Séquence de châteaux (mini-châteaux puis grand château final)', () => {
  test('un niveau simple (peu avancé) n’a qu’un seul château', () => {
    const lvl = generateLevel(1);
    expect(lvl.castles).toEqual([lvl.baseHp]);
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

  test('détruire le dernier château termine le niveau', () => {
    const cfg = { ...generateLevel(1), castles: [10, 30], baseHp: 40, gates: [], spawnInterval: 1e9, waveEvery: 1e9 };
    const g = createGame(cfg);
    g.blue.push({ x: BASE.x, y: BASE.y, vx: 0, vy: 0, hp: 40, r: 5, mask: 0, champ: false });
    step(g, DT, {});
    expect(g.status).toBe('won');
    expect(g.events.some(e => e.type === 'castleDown' && e.final === true)).toBe(true);
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
    g.blue.push({ x: W / 2, y: 410, vx: 0, vy: -170, hp: 1, r: 5, mask: 0, champ: false });
    run(g, 0.2, {});
    expect(g.blue).toHaveLength(1);
    expect(g.blue[0].hp).toBe(1);
  });

  test('un héros au bonus de clonage démultiplie plus le champion dans une porte ×', () => {
    const cfg = {
      ...generateLevel(1),
      gates: [{ id: 0, x: W / 2, y: 400, w: 200, h: 14, op: { type: 'mul', n: 3 }, vx: 0, minX: 0, maxX: W }],
      spawnInterval: 1e9, waveEvery: 1e9,
    };
    const standard = createGame(cfg, { hero: 'champion' });
    standard.blue.push({ x: W / 2, y: 410, vx: 0, vy: -170, hp: 25, r: 13, mask: 0, champ: true });
    run(standard, 0.2, {});
    const colosse = createGame(cfg, { hero: 'colosse' });
    colosse.blue.push({ x: W / 2, y: 410, vx: 0, vy: -170, hp: 45, r: 13, mask: 0, champ: true });
    run(colosse, 0.2, {});
    expect(colosse.blue.length).toBeLessThan(standard.blue.length);
  });

  test('generateBonusLevel est déterministe et plus dur que le niveau principal équivalent', () => {
    expect(generateBonusLevel(2)).toEqual(generateBonusLevel(2));
    const bonus = generateBonusLevel(2);
    const main = generateLevel(bonusUnlockLevel(2));
    expect(bonus.baseHp).toBeGreaterThan(main.baseHp);
    expect(bonus.bonus).toBe(true);
  });

  test('bonusRewardFor renvoie une récompense stable par index', () => {
    expect(bonusRewardFor(1)).toEqual(bonusRewardFor(1));
    expect(bonusUnlockLevel(1)).toBe(BONUS_EVERY);
  });
});
