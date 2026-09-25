/**
 * engine.js — Logique pure de Mob Rush (aucune dépendance DOM).
 *
 * Monde logique fixe W×H (portrait). Le canon du joueur est en bas, la base
 * ennemie en haut. Les unités bleues montent, traversent des portes qui les
 * multiplient, et détruisent la base. Les unités rouges descendent vers le canon.
 */

export const W = 360;
export const H = 640;
export const CANNON_Y = 590;
export const CANNON_MIN_X = 24;
export const CANNON_MAX_X = W - 24;
export const BASE = { x: W / 2, y: 64, w: 130, h: 56 };

export const MAX_BLUE = 650;
export const FIRE_RATE = 9;            // tirs / seconde
export const CHAMPION_CHARGE = 40;     // tirs nécessaires pour charger le champion
const BLUE_SPEED = 170;
const CHAMP_SPEED = 105;
const RED_SPEED = 62;
const BRUTE_SPEED = 42;
const CANNON_SPEED = 900;
const GATE_H = 14;

// Équilibrage (réglé par simulation d'un bot sur les niveaux 1–30)
export const T = {
  BASE_HP_0: 200, BASE_HP_K: 75, CHAIN_CAP: 140, LEVEL_K: 0.02,
  SPAWN_0: 0.8, SPAWN_K: 0.02, SPAWN_MIN: 0.25, GROUP_EVERY: 4,
  WAVE_0: 8, WAVE_K: 2.5, RAMP: 40,
};

// ─── RNG déterministe ────────────────────────────────────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ─── Génération de niveau ────────────────────────────────────────────────────
/**
 * Génère la configuration d'un niveau (déterministe : même numéro → même niveau).
 */
export function generateLevel(n) {
  const level = Math.max(1, Math.floor(n));
  const rng = mulberry32(level * 9973 + 17);
  const pick = arr => arr[Math.floor(rng() * arr.length)];

  const rows = 2 + Math.min(2, Math.floor((level - 1) / 4));
  const top = 190;
  const bottom = 500;
  const gates = [];

  for (let r = 0; r < rows; r++) {
    const y = rows === 1 ? (top + bottom) / 2 : bottom - (r * (bottom - top)) / (rows - 1);
    const twoGates = level >= 2 && rng() < 0.55;
    const slots = twoGates ? [W * 0.27, W * 0.73] : [W * (0.3 + rng() * 0.4)];

    slots.forEach((x, i) => {
      let op;
      if (twoGates && i === 1 && level >= 3 && rng() < 0.45) {
        op = { type: 'div', n: 2 };
      } else {
        const muls = level < 4 ? [2, 2, 3] : level < 10 ? [2, 2, 3, 3, 4] : [2, 3, 3, 4, 5];
        op = { type: 'mul', n: pick(muls) };
      }
      const w = twoGates ? 88 + rng() * 22 : 100 + rng() * 40;
      const moving = level >= 2 && rng() < Math.min(0.6, 0.2 + level * 0.04);
      const vx = moving ? (30 + rng() * 40) * (rng() < 0.5 ? -1 : 1) : 0;
      // Couloir de déplacement : tout le terrain, ou une moitié si deux portes sur la rangée
      const laneL = twoGates && i === 1 ? W / 2 : 0;
      const laneR = twoGates && i === 0 ? W / 2 : W;
      gates.push({ id: gates.length, x, y, w, h: GATE_H, op, vx, minX: laneL + w / 2 + 4, maxX: laneR - w / 2 - 4 });
    });
  }
  // Garantit minX <= maxX
  for (const g of gates) {
    if (g.minX > g.maxX) { const m = (g.minX + g.maxX) / 2; g.minX = g.maxX = m; g.vx = 0; }
    g.x = clamp(g.x, g.minX, g.maxX);
  }

  // PV de la base proportionnels au meilleur enchaînement de portes possible,
  // pour que les niveaux à gros multiplicateurs ne se gagnent pas en 5 secondes.
  const rowsY = [...new Set(gates.map(g => g.y))];
  const bestChain = rowsY.reduce((acc, y) =>
    acc * Math.max(1, ...gates.filter(g => g.y === y && g.op.type === 'mul').map(g => g.op.n)), 1);

  return {
    level,
    bestChain,
    baseHp: Math.round((T.BASE_HP_0 + T.BASE_HP_K * Math.min(bestChain, T.CHAIN_CAP)) * (1 + level * T.LEVEL_K)),
    cannonHp: 10,
    spawnInterval: Math.max(T.SPAWN_MIN, T.SPAWN_0 - level * T.SPAWN_K),
    spawnGroup: 1 + Math.floor(level / T.GROUP_EVERY),
    waveEvery: Math.max(6, 12 - level * 0.3),
    waveSize: T.WAVE_0 + Math.floor(level * T.WAVE_K),
    bruteChance: level >= 4 ? Math.min(0.22, (level - 3) * 0.025) : 0,
    seed: level * 7919 + 3,
    gates,
  };
}

// ─── État de partie ──────────────────────────────────────────────────────────
export function createGame(levelConfig) {
  return {
    cfg: levelConfig,
    rng: mulberry32(levelConfig.seed),
    time: 0,
    status: 'playing',           // 'playing' | 'won' | 'lost'
    cannonX: W / 2,
    cannonHp: levelConfig.cannonHp,
    baseHp: levelConfig.baseHp,
    fireAcc: 0,
    charge: 0,
    spawnAcc: 0,
    waveAcc: 0,
    gates: levelConfig.gates.map(g => ({ ...g, op: { ...g.op }, flash: 0 })),
    blue: [],
    red: [],
    events: [],
    stats: { shots: 0, kills: 0, peak: 0, gateHits: 0 },
  };
}

function makeBlue(x, y, mask, champ = false) {
  return champ
    ? { x, y, vx: 0, vy: -CHAMP_SPEED, hp: 25, r: 13, mask, champ: true }
    : { x, y, vx: 0, vy: -BLUE_SPEED, hp: 1, r: 5, mask, champ: false };
}

function spawnRed(g, brute) {
  const x = BASE.x + (g.rng() - 0.5) * (BASE.w - 20);
  const y = BASE.y + BASE.h / 2 + 6;
  g.red.push(brute
    ? { x, y, vx: 0, vy: BRUTE_SPEED, hp: 6, r: 10, brute: true }
    : { x, y, vx: 0, vy: RED_SPEED, hp: 1, r: 5, brute: false });
}

export function canLaunchChampion(g) {
  return g.status === 'playing' && g.charge >= CHAMPION_CHARGE;
}

export function starsFor(g) {
  if (g.status !== 'won') return 0;
  const ratio = g.cannonHp / g.cfg.cannonHp;
  return ratio >= 1 ? 3 : ratio >= 0.5 ? 2 : 1;
}

/**
 * Avance la simulation de dt secondes.
 * input = { firing: bool, targetX: number|null, champion: bool }
 */
export function step(g, dt, input = {}) {
  if (g.status !== 'playing') return g;
  dt = Math.min(dt, 0.05);
  g.time += dt;

  // Canon
  if (input.targetX != null) {
    const tx = clamp(input.targetX, CANNON_MIN_X, CANNON_MAX_X);
    const d = tx - g.cannonX;
    const maxMove = CANNON_SPEED * dt;
    g.cannonX += Math.abs(d) <= maxMove ? d : Math.sign(d) * maxMove;
  }

  // Tir
  if (input.firing) {
    g.fireAcc += dt * FIRE_RATE;
    while (g.fireAcc >= 1) {
      g.fireAcc -= 1;
      if (g.blue.length < MAX_BLUE) {
        const u = makeBlue(g.cannonX + (g.rng() - 0.5) * 6, CANNON_Y - 22, 0);
        u.vx = (g.rng() - 0.5) * 24;
        g.blue.push(u);
        g.stats.shots++;
        g.charge = Math.min(CHAMPION_CHARGE, g.charge + 1);
      }
    }
  } else {
    g.fireAcc = Math.min(g.fireAcc, 0.99);
  }

  if (input.champion && canLaunchChampion(g)) {
    g.blue.push(makeBlue(g.cannonX, CANNON_Y - 26, 0, true));
    g.charge = 0;
    g.events.push({ type: 'champion', x: g.cannonX, y: CANNON_Y - 26 });
  }

  // Ennemis
  g.spawnAcc += dt * (1 + g.time / T.RAMP);   // la pression monte avec le temps
  while (g.spawnAcc >= g.cfg.spawnInterval) {
    g.spawnAcc -= g.cfg.spawnInterval;
    for (let i = 0; i < g.cfg.spawnGroup; i++) spawnRed(g, g.rng() < g.cfg.bruteChance);
  }
  g.waveAcc += dt;
  if (g.waveAcc >= g.cfg.waveEvery) {
    g.waveAcc = 0;
    for (let i = 0; i < g.cfg.waveSize; i++) spawnRed(g, false);
    g.events.push({ type: 'wave' });
  }

  // Portes mobiles
  for (const gate of g.gates) {
    if (gate.flash > 0) gate.flash = Math.max(0, gate.flash - dt);
    if (!gate.vx) continue;
    gate.x += gate.vx * dt;
    if (gate.x < gate.minX) { gate.x = gate.minX; gate.vx = Math.abs(gate.vx); }
    if (gate.x > gate.maxX) { gate.x = gate.maxX; gate.vx = -Math.abs(gate.vx); }
  }

  // Unités bleues
  const newBlue = [];
  for (const u of g.blue) {
    const prevY = u.y;
    if (u.y < 300) {
      const dx = BASE.x - u.x;
      const want = Math.sign(dx) * Math.min(Math.abs(dx) * 2.2, 150);
      u.vx += (want - u.vx) * Math.min(1, dt * 5);
    } else {
      u.vx *= 1 - Math.min(1, dt * 0.8);
    }
    u.x = clamp(u.x + u.vx * dt, u.r, W - u.r);
    u.y += u.vy * dt;

    for (const gate of g.gates) {
      const bit = 1 << gate.id;
      if (u.mask & bit) continue;
      if (prevY > gate.y && u.y <= gate.y && Math.abs(u.x - gate.x) <= gate.w / 2) {
        u.mask |= bit;
        gate.flash = 0.15;
        g.stats.gateHits++;
        if (gate.op.type === 'mul') {
          const clones = u.champ ? (gate.op.n - 1) * 4 : gate.op.n - 1;
          for (let k = 0; k < clones; k++) {
            if (g.blue.length + newBlue.length >= MAX_BLUE) break;
            const c = makeBlue(clamp(u.x + (g.rng() - 0.5) * gate.w * 0.8, 5, W - 5), gate.y - 2 - g.rng() * 8, u.mask);
            c.vx = (g.rng() - 0.5) * 50;
            newBlue.push(c);
          }
          g.events.push({ type: 'gate', x: u.x, y: gate.y });
        } else if (gate.op.type === 'div') {
          if (u.champ) u.hp = Math.max(1, Math.ceil(u.hp / gate.op.n));
          else if (g.rng() < 1 - 1 / gate.op.n) u.hp = 0;
        }
      }
    }
  }
  if (newBlue.length) g.blue.push(...newBlue);

  // Unités rouges
  for (const e of g.red) {
    const want = clamp((g.cannonX - e.x) * 0.35, -35, 35);
    e.vx += (want - e.vx) * Math.min(1, dt * 2);
    e.x = clamp(e.x + e.vx * dt, e.r, W - e.r);
    e.y += e.vy * dt;
  }

  resolveCombat(g);

  // Impacts base / canon
  const baseBottom = BASE.y + BASE.h / 2;
  for (const u of g.blue) {
    if (u.hp <= 0) continue;
    if (u.y - u.r <= baseBottom && Math.abs(u.x - BASE.x) <= BASE.w / 2 + u.r) {
      g.baseHp -= u.hp;
      g.events.push({ type: 'baseHit', x: u.x, y: baseBottom, big: u.champ });
      u.hp = 0;
    } else if (u.y < -20) {
      u.hp = 0;
    }
  }
  for (const e of g.red) {
    if (e.hp <= 0) continue;
    if (e.y + e.r >= CANNON_Y - 8) {
      g.cannonHp -= e.brute ? 3 : 1;
      g.events.push({ type: 'cannonHit', x: e.x, y: CANNON_Y });
      e.hp = 0;
    }
  }

  g.blue = g.blue.filter(u => u.hp > 0);
  g.red = g.red.filter(e => e.hp > 0);
  if (g.blue.length > g.stats.peak) g.stats.peak = g.blue.length;

  if (g.baseHp <= 0) {
    g.baseHp = 0;
    g.status = 'won';
    g.events.push({ type: 'won' });
  } else if (g.cannonHp <= 0) {
    g.cannonHp = 0;
    g.status = 'lost';
    g.events.push({ type: 'lost' });
  }
  return g;
}

// ─── Combat (grille spatiale) ────────────────────────────────────────────────
const CELL = 24;
function resolveCombat(g) {
  if (!g.red.length || !g.blue.length) return;
  const grid = new Map();
  for (const u of g.blue) {
    if (u.hp <= 0) continue;
    const key = Math.floor(u.x / CELL) + Math.floor(u.y / CELL) * 64;
    let cell = grid.get(key);
    if (!cell) grid.set(key, (cell = []));
    cell.push(u);
  }
  for (const e of g.red) {
    const cx = Math.floor(e.x / CELL);
    const cy = Math.floor(e.y / CELL);
    for (let oy = -1; oy <= 1 && e.hp > 0; oy++) {
      for (let ox = -1; ox <= 1 && e.hp > 0; ox++) {
        const cell = grid.get(cx + ox + (cy + oy) * 64);
        if (!cell) continue;
        for (const u of cell) {
          if (u.hp <= 0) continue;
          const dx = u.x - e.x;
          const dy = u.y - e.y;
          const rr = u.r + e.r;
          if (dx * dx + dy * dy > rr * rr) continue;
          const d = Math.min(u.hp, e.hp);
          u.hp -= d;
          e.hp -= d;
          if (e.hp <= 0) {
            g.stats.kills++;
            g.events.push({ type: 'kill', x: e.x, y: e.y, big: e.brute });
            break;
          }
        }
      }
    }
  }
}
