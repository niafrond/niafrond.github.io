import {
  W, CANNON_Y, BASE, CHAMPION_CHARGE, MAX_BLUE,
  generateLevel, createGame, step, canLaunchChampion, starsFor,
  generateBonusLevel, bonusRewardFor, bonusUnlockLevel, BONUS_EVERY,
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

describe('RPG : compétences, armes, héros', () => {
  test('sans loadout, le comportement est identique au canon standard', () => {
    const g = createGame(generateLevel(1));
    expect(g.fireRate).toBe(9);
    expect(g.championCharge).toBe(CHAMPION_CHARGE);
    expect(g.cannonHpMax).toBe(g.cfg.cannonHp);
  });

  test('les compétences modifient la cadence, la charge et les PV de canon', () => {
    const g = createGame(generateLevel(1), { perks: ['cadence', 'charge', 'blindage'] });
    expect(g.fireRate).toBeCloseTo(9 * 1.15);
    expect(g.championCharge).toBeLessThan(CHAMPION_CHARGE);
    expect(g.cannonHpMax).toBe(g.cfg.cannonHp + 2);
    expect(g.cannonHp).toBe(g.cannonHpMax);
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
