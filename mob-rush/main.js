/**
 * main.js — UI, rendu canvas, entrées tactiles, sons et progression locale.
 */

import {
  W, H, CANNON_Y, BASE,
  generateLevel, createGame, step, canLaunchChampion, starsFor,
  PERKS, WEAPONS, HEROES,
  generateBonusLevel, bonusRewardFor, bonusUnlockLevel, BONUS_EVERY,
} from './engine.js';

// ─── Progression (localStorage) ──────────────────────────────────────────────
const STORE_KEY = 'mobrush.v1';

function loadSave() {
  const def = {
    unlocked: 1, stars: {}, sound: true, vibrate: true,
    // RPG : rien ne s'achète, tout se gagne en jouant.
    skillPoints: 0, skills: {}, claimed: {},
    unlockedWeapons: ['standard'], unlockedHeroes: ['champion'],
    equip: { weapon: 'standard', hero: 'champion' },
    bonusStars: {}, bonusClaimed: {},
  };
  try {
    return { ...def, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
  } catch {
    return def;
  }
}
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(save)); } catch { /* stockage indisponible */ }
}
const save = loadSave();
function currentLoadout() {
  return { weapon: save.equip.weapon, hero: save.equip.hero, perks: Object.keys(save.skills) };
}

// ─── DOM ─────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const screenMenu = $('screen-menu');
const screenGame = $('screen-game');
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const overlay = $('overlay');
const championBtn = $('btn-champion');
const championRing = $('champion-ring');

// ─── Son (WebAudio, synthétisé) ──────────────────────────────────────────────
let audio = null;
let lastSfx = {};
function sfx(kind) {
  if (!save.sound) return;
  const now = performance.now();
  const minGap = { shot: 70, gate: 60, kill: 45, base: 60 }[kind] || 0;
  if (now - (lastSfx[kind] || 0) < minGap) return;
  lastSfx[kind] = now;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime;
    const o = audio.createOscillator();
    const gn = audio.createGain();
    const presets = {
      shot:     ['square',   520, 380, 0.03, 0.04],
      gate:     ['triangle', 660, 990, 0.06, 0.08],
      kill:     ['sawtooth', 200, 90,  0.04, 0.05],
      base:     ['square',   140, 70,  0.08, 0.10],
      hurt:     ['sawtooth', 120, 50,  0.12, 0.25],
      champion: ['triangle', 220, 880, 0.10, 0.35],
      win:      ['triangle', 520, 1040, 0.12, 0.6],
      lose:     ['sawtooth', 300, 60,  0.12, 0.7],
    };
    const [type, f0, f1, vol, dur] = presets[kind];
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(audio.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* audio indisponible */ }
}
function buzz(ms) {
  if (save.vibrate && navigator.vibrate) navigator.vibrate(ms);
}

// ─── Menu ────────────────────────────────────────────────────────────────────
function renderMenu() {
  $('play-level').textContent = save.unlocked;
  const grid = $('level-grid');
  grid.innerHTML = '';
  const total = Math.max(20, Math.ceil((save.unlocked + 5) / 5) * 5);
  for (let i = 1; i <= total; i++) {
    const b = document.createElement('button');
    b.className = 'level-btn' + (i === save.unlocked ? ' current' : '');
    b.disabled = i > save.unlocked;
    const s = save.stars[i] || 0;
    b.innerHTML = `<span>${i}</span><span class="lv-stars">${'★'.repeat(s)}</span>`;
    b.addEventListener('click', () => startLevel(i));
    grid.appendChild(b);
  }
  $('opt-sound').checked = save.sound;
  $('opt-vibrate').checked = save.vibrate;
  renderBonusGrid();
  renderSkillList();
  renderArsenal();
}

function renderBonusGrid() {
  const grid = $('bonus-grid');
  grid.innerHTML = '';
  const total = Math.max(2, Math.ceil(save.unlocked / BONUS_EVERY) + 1);
  for (let i = 1; i <= total; i++) {
    const need = bonusUnlockLevel(i);
    const unlocked = save.unlocked >= need;
    const claimed = !!save.bonusClaimed[i];
    const reward = bonusRewardFor(i);
    const table = reward.type === 'weapon' ? WEAPONS : HEROES;
    const b = document.createElement('button');
    b.className = 'level-btn bonus-btn' + (claimed ? ' claimed' : '');
    b.disabled = !unlocked;
    const s = save.bonusStars[i] || 0;
    const rewardLabel = claimed ? `✓ ${table[reward.id].name}`
      : unlocked ? `🎁 ${table[reward.id].name}`
      : `🔒 niv. ${need}`;
    b.innerHTML = `<span>${i}</span><span class="lv-stars">${'★'.repeat(s)}</span><span class="bonus-reward">${rewardLabel}</span>`;
    b.addEventListener('click', () => startBonus(i));
    grid.appendChild(b);
  }
}

function renderSkillList() {
  const n = save.skillPoints;
  $('skill-points').textContent = `${n} compétence${n === 1 ? '' : 's'} disponible${n === 1 ? '' : 's'}`;
  const list = $('skill-list');
  list.innerHTML = '';
  for (const perk of Object.values(PERKS)) {
    const owned = !!save.skills[perk.id];
    const row = document.createElement('div');
    row.className = 'skill-row' + (owned ? ' owned' : '');
    row.innerHTML = `<div class="skill-info"><b>${perk.name}</b><span>${perk.desc}</span></div>` +
      (owned
        ? `<span class="skill-owned">✓ Acquis</span>`
        : `<button class="btn btn-secondary btn-sm skill-buy" data-id="${perk.id}" ${save.skillPoints < perk.cost ? 'disabled' : ''}>Débloquer (${perk.cost})</button>`);
    list.appendChild(row);
  }
  list.querySelectorAll('.skill-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const perk = PERKS[btn.dataset.id];
      if (!perk || save.skills[perk.id] || save.skillPoints < perk.cost) return;
      save.skillPoints -= perk.cost;
      save.skills[perk.id] = true;
      persist();
      renderSkillList();
    });
  });
}

function renderArsenal() {
  renderArsenalGroup('arsenal-weapons', WEAPONS, save.unlockedWeapons, save.equip.weapon,
    id => { save.equip.weapon = id; persist(); renderArsenal(); });
  renderArsenalGroup('arsenal-heroes', HEROES, save.unlockedHeroes, save.equip.hero,
    id => { save.equip.hero = id; persist(); renderArsenal(); });
}
function renderArsenalGroup(elId, table, unlockedIds, equippedId, onSelect) {
  const el = $(elId);
  el.innerHTML = '';
  for (const id of Object.keys(table)) {
    const item = table[id];
    const unlocked = unlockedIds.includes(id);
    const btn = document.createElement('button');
    btn.className = 'arsenal-item' + (equippedId === id ? ' equipped' : '') + (!unlocked ? ' locked' : '');
    btn.disabled = !unlocked;
    btn.innerHTML = unlocked
      ? `<b>${item.name}</b><span>${item.desc}</span>`
      : `<b>🔒 ???</b><span>À débloquer via un niveau bonus.</span>`;
    if (unlocked) btn.addEventListener('click', () => onSelect(id));
    el.appendChild(btn);
  }
}

$('btn-play').addEventListener('click', () => startLevel(save.unlocked));
$('opt-sound').addEventListener('change', e => { save.sound = e.target.checked; persist(); });
$('opt-vibrate').addEventListener('change', e => { save.vibrate = e.target.checked; persist(); });
$('btn-reset').addEventListener('click', () => {
  if (!confirm('Effacer toute la progression ?')) return;
  save.unlocked = 1;
  save.stars = {};
  save.claimed = {};
  save.skillPoints = 0;
  save.skills = {};
  save.unlockedWeapons = ['standard'];
  save.unlockedHeroes = ['champion'];
  save.equip = { weapon: 'standard', hero: 'champion' };
  save.bonusStars = {};
  save.bonusClaimed = {};
  persist();
  renderMenu();
});

// ─── Partie ──────────────────────────────────────────────────────────────────
let game = null;
let currentBonusIndex = null;
let paused = false;
let rafId = 0;
let lastT = 0;
let particles = [];
let floaters = [];
let shake = 0;
const input = { firing: false, targetX: null, champion: false };

function beginGame(cfg, label) {
  game = createGame(cfg, currentLoadout());
  particles = [];
  floaters = [];
  shake = 0;
  paused = false;
  input.firing = false;
  input.targetX = null;
  input.champion = false;
  screenMenu.hidden = true;
  screenGame.hidden = false;
  overlay.hidden = true;
  $('hud-level').textContent = label;
  lastHearts = '';
  lastCastleIndex = -1;
  resize();
  updateHud();
  cancelAnimationFrame(rafId);
  lastT = performance.now();
  rafId = requestAnimationFrame(loop);
}
function startLevel(n) {
  currentBonusIndex = null;
  beginGame(generateLevel(n), `Niveau ${n}`);
}
function startBonus(idx) {
  currentBonusIndex = idx;
  beginGame(generateBonusLevel(idx), `Bonus ${idx}`);
}

function showMenu() {
  cancelAnimationFrame(rafId);
  game = null;
  screenGame.hidden = true;
  screenMenu.hidden = false;
  renderMenu();
}

function pause() {
  if (!game || game.status !== 'playing' || paused) return;
  paused = true;
  input.firing = false;
  showOverlay('pause');
}
function resume() {
  paused = false;
  overlay.hidden = true;
  lastT = performance.now();
}

function showOverlay(kind) {
  overlay.hidden = false;
  const lvl = game.cfg.level;
  $('btn-resume').hidden = kind !== 'pause';
  $('btn-next').hidden = kind !== 'won' || currentBonusIndex != null;
  $('overlay-stars').innerHTML = '';
  $('overlay-stats').textContent = '';
  $('overlay-reward').textContent = '';
  if (kind === 'pause') {
    $('overlay-title').textContent = 'Pause';
    return;
  }
  const secs = Math.round(game.time);
  $('overlay-stats').innerHTML =
    `Temps : ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}<br>` +
    `Ennemis éliminés : ${game.stats.kills}<br>Armée max : ${game.stats.peak} unités`;
  if (kind === 'won') {
    const s = starsFor(game);
    $('overlay-title').textContent = 'Victoire !';
    $('overlay-stars').innerHTML = [1, 2, 3].map(i => `<span class="${i <= s ? '' : 'off'}">★</span>`).join('');
    if (currentBonusIndex != null) {
      $('overlay-reward').textContent = claimBonusReward(currentBonusIndex, s);
    } else {
      $('overlay-reward').textContent = claimLevelReward(lvl, s);
      save.unlocked = Math.max(save.unlocked, lvl + 1);
    }
    persist();
    renderMenu();
  } else {
    $('overlay-title').textContent = 'Défaite';
  }
}

// Récompenses RPG : uniquement à la première réussite d'un niveau (ou au
// premier ★★★), jamais en rejouant — le skill débloque, pas le grind.
function claimLevelReward(lvl, stars) {
  let gained = 0;
  if (!save.claimed[lvl]) { save.claimed[lvl] = true; gained += 1; }
  const prevStars = save.stars[lvl] || 0;
  if (stars === 3 && prevStars < 3) gained += 1;
  save.stars[lvl] = Math.max(prevStars, stars);
  save.skillPoints += gained;
  return gained ? `+${gained} compétence${gained > 1 ? 's' : ''} !` : '';
}
function claimBonusReward(idx, stars) {
  save.bonusStars[idx] = Math.max(save.bonusStars[idx] || 0, stars);
  if (save.bonusClaimed[idx]) return '';
  save.bonusClaimed[idx] = true;
  const reward = bonusRewardFor(idx);
  if (reward.type === 'weapon') { save.unlockedWeapons.push(reward.id); return `🎁 Nouvelle arme : ${WEAPONS[reward.id].name} !`; }
  save.unlockedHeroes.push(reward.id);
  return `🎁 Nouveau héros : ${HEROES[reward.id].name} !`;
}

$('btn-pause').addEventListener('click', pause);
$('btn-resume').addEventListener('click', resume);
$('btn-retry').addEventListener('click', () => (currentBonusIndex != null ? startBonus(currentBonusIndex) : startLevel(game.cfg.level)));
$('btn-next').addEventListener('click', () => startLevel(game.cfg.level + 1));
$('btn-menu').addEventListener('click', showMenu);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ─── Entrées ─────────────────────────────────────────────────────────────────
let view = { scale: 1, ox: 0, oy: 0 };
let activePointer = null;

function toWorldX(clientX) {
  const rect = canvas.getBoundingClientRect();
  return (clientX - rect.left - view.ox) / view.scale;
}

canvas.addEventListener('pointerdown', e => {
  if (!game || paused) return;
  activePointer = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  input.firing = true;
  input.targetX = toWorldX(e.clientX);
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== activePointer) return;
  input.targetX = toWorldX(e.clientX);
});
const release = e => {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  input.firing = false;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

championBtn.addEventListener('pointerdown', e => {
  e.stopPropagation();
  if (game && !paused && canLaunchChampion(game)) input.champion = true;
});

// ─── Rendu ───────────────────────────────────────────────────────────────────
let dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  const scale = Math.min(cw / W, ch / H);
  view = { scale, ox: (cw - W * scale) / 2, oy: (ch - H * scale) / 2 };
}
window.addEventListener('resize', () => { if (game) resize(); });

function loop(t) {
  rafId = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  if (!game) return;

  if (!paused && game.status === 'playing') {
    const shots = game.stats.shots;
    step(game, dt, input);
    input.champion = false;
    if (game.stats.shots > shots) sfx('shot');
    handleEvents();
    updateHud();
  }
  updateFx(dt);
  draw();
}

function handleEvents() {
  for (const ev of game.events) {
    switch (ev.type) {
      case 'gate':
        sfx('gate');
        if (floaters.length < 30) floaters.push({ x: ev.x, y: ev.y - 10, t: 0.6, text: '+', color: '#3ddc84' });
        break;
      case 'kill':
        sfx('kill');
        burst(ev.x, ev.y, ev.big ? 14 : 4, '#ff4d5e');
        break;
      case 'baseHit':
        sfx('base');
        burst(ev.x, ev.y, ev.big ? 20 : 3, '#3fa9ff');
        if (ev.big) { shake = 0.3; buzz(40); }
        break;
      case 'castleDown':
        sfx(ev.final ? 'win' : 'base');
        buzz(ev.final ? [30, 40, 30] : 50);
        burst(BASE.x, BASE.y, ev.final ? 40 : 24, '#ffc93c');
        shake = ev.final ? 0.4 : 0.3;
        floaters.push({ x: W / 2, y: 150, t: 1.1, text: ev.final ? 'CHÂTEAU FINAL !' : 'CHÂTEAU DÉTRUIT !', color: '#ffc93c', big: true });
        break;
      case 'cannonHit':
        sfx('hurt');
        burst(ev.x, ev.y, 10, '#ff4d5e');
        shake = 0.25;
        buzz(60);
        break;
      case 'champion':
        sfx('champion');
        buzz(30);
        break;
      case 'wave':
        floaters.push({ x: W / 2, y: 150, t: 1.2, text: 'VAGUE !', color: '#ff4d5e', big: true });
        break;
      case 'won':
        sfx('win');
        buzz([40, 60, 40]);
        burst(BASE.x, BASE.y, 60, '#ffc93c');
        setTimeout(() => game && showOverlay('won'), 700);
        break;
      case 'lost':
        sfx('lose');
        buzz(200);
        setTimeout(() => game && showOverlay('lost'), 700);
        break;
    }
  }
  game.events.length = 0;
}

function burst(x, y, n, color) {
  for (let i = 0; i < n && particles.length < 400; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * 120;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.35 + Math.random() * 0.3, color });
  }
}

function updateFx(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.t -= dt;
  }
  particles = particles.filter(p => p.t > 0);
  for (const f of floaters) { f.y -= 30 * dt; f.t -= dt; }
  floaters = floaters.filter(f => f.t > 0);
  if (shake > 0) shake = Math.max(0, shake - dt);
}

let lastHearts = '';
let lastCastleIndex = -1;
function updateHud() {
  const full = Math.max(0, game.cannonHp);
  const hearts = '❤️'.repeat(full) + '🖤'.repeat(game.cannonHpMax - full);
  if (hearts !== lastHearts) { $('hud-hearts').textContent = hearts; lastHearts = hearts; }
  const pct = game.charge / game.championCharge;
  championRing.style.strokeDashoffset = String(176 * (1 - pct));
  const ready = canLaunchChampion(game);
  championBtn.classList.toggle('ready', ready);
  championBtn.disabled = !ready;
  if (game.castleIndex !== lastCastleIndex) {
    lastCastleIndex = game.castleIndex;
    const castles = game.cfg.castles;
    $('hud-castles').innerHTML = castles.map((_, i) => {
      const icon = i === castles.length - 1 ? '👑' : '🏰';
      const cls = i < game.castleIndex ? 'done' : i === game.castleIndex ? 'current' : '';
      return `<span class="pip ${cls}">${icon}</span>`;
    }).join('');
  }
}

// Segments « mur » d'une rangée : tout ce que ne couvrent pas ses portes
// ouvertes (en positions actuelles, portes mobiles comprises).
function wallSegments(row, gates) {
  const openings = row.gateIds
    .map(id => gates[id])
    .map(gt => [gt.x - gt.w / 2, gt.x + gt.w / 2])
    .sort((a, b) => a[0] - b[0]);
  const walls = [];
  let cursor = 0;
  for (const [start, end] of openings) {
    if (start > cursor) walls.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < W) walls.push([cursor, W]);
  return walls;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

function draw() {
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b1226';
  ctx.fillRect(0, 0, cw, ch);

  let sx = 0, sy = 0;
  if (shake > 0) { sx = (Math.random() - 0.5) * 8 * shake / 0.3; sy = (Math.random() - 0.5) * 8 * shake / 0.3; }
  ctx.setTransform(view.scale * dpr, 0, 0, view.scale * dpr, (view.ox + sx) * dpr, (view.oy + sy) * dpr);

  // Terrain
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#3a1f3d');
  grd.addColorStop(0.35, '#1d2c55');
  grd.addColorStop(1, '#16306a');
  ctx.fillStyle = grd;
  roundRect(0, 0, W, H, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let y = 40; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Château actuel : un mini-château pour chaque étape intermédiaire, un
  // grand château pour la dernière — la progression se voit, pas juste une
  // seule barre de vie qui grignote à l'infini sur un décor figé.
  const castles = game.cfg.castles;
  const isFinalCastle = game.castleIndex === castles.length - 1;
  const scale = isFinalCastle ? 1.15 : 0.7;
  const castleW = BASE.w * scale;
  const castleH = BASE.h * scale;
  const castleBottom = BASE.y + BASE.h / 2;
  const bx = BASE.x - castleW / 2;
  const by = castleBottom - castleH;
  ctx.fillStyle = '#7a1b2a';
  roundRect(bx, by, castleW, castleH, 10);
  ctx.fill();
  ctx.fillStyle = '#b82a3f';
  const merlons = isFinalCastle ? 5 : 3;
  for (let i = 0; i < merlons; i++) ctx.fillRect(bx + 6 + i * (castleW - 12) / merlons, by - 8, (castleW - 12) / merlons - 6, 10);
  ctx.fillStyle = '#2a0a12';
  roundRect(BASE.x - castleW * 0.12, castleBottom - castleH * 0.42, castleW * 0.24, castleH * 0.42, 8);
  ctx.fill();
  if (isFinalCastle) {
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.moveTo(BASE.x, by - 22);
    ctx.lineTo(BASE.x - 7, by - 9);
    ctx.lineTo(BASE.x + 7, by - 9);
    ctx.closePath();
    ctx.fill();
  }
  // Barre de vie du château courant (pas le total du niveau)
  const castleMax = castles[game.castleIndex];
  const hpPct = Math.max(0, Math.min(1, game.castleHp / castleMax));
  const barY = castleBottom + 6;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(BASE.x - BASE.w / 2, barY, BASE.w, 10, 5);
  ctx.fill();
  ctx.fillStyle = hpPct > 0.3 ? '#ff4d5e' : '#ffc93c';
  roundRect(BASE.x - BASE.w / 2, barY, BASE.w * hpPct, 10, 5);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(Math.max(0, Math.ceil(game.castleHp))), BASE.x, BASE.y);

  // Murs : tout ce qu'aucune porte ne couvre sur une rangée. Impossible de
  // les traverser — ils forcent à viser un couloir ouvert (une porte).
  ctx.strokeStyle = 'rgba(255,193,7,0.35)';
  ctx.lineWidth = 3;
  for (const row of game.rows) {
    for (const [start, end] of wallSegments(row, game.gates)) {
      if (end - start < 2) continue;
      const wy = row.y - 16;
      roundRect(start, wy, end - start, 30, 4);
      ctx.fillStyle = '#2b2b35';
      ctx.fill();
      ctx.save();
      ctx.clip();
      for (let sx = start - 30; sx < end; sx += 10) {
        ctx.beginPath();
        ctx.moveTo(sx, wy + 30);
        ctx.lineTo(sx + 30, wy);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Portes
  for (const gate of game.gates) {
    const good = gate.op.type === 'mul';
    const col = good ? '61,220,132' : '255,77,94';
    ctx.fillStyle = `rgba(${col},${0.28 + gate.flash * 3})`;
    roundRect(gate.x - gate.w / 2, gate.y - 16, gate.w, 30, 6);
    ctx.fill();
    ctx.strokeStyle = `rgb(${col})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(good ? `×${gate.op.n}` : `÷${gate.op.n}`, gate.x, gate.y);
  }

  // Unités rouges
  ctx.fillStyle = '#ff4d5e';
  for (const e of game.red) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#ffd0d5';
  ctx.lineWidth = 2;
  for (const e of game.red) {
    if (!e.brute) continue;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Unités bleues
  ctx.fillStyle = '#3fa9ff';
  for (const u of game.blue) {
    if (u.champ) continue;
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const u of game.blue) {
    if (!u.champ) continue;
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3fa9ff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#04213d';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(String(u.hp), u.x, u.y + 1);
  }

  // Canon
  const cx = game.cannonX;
  ctx.fillStyle = 'rgba(63,169,255,0.12)';
  ctx.fillRect(cx - 1, BASE.y + BASE.h, 2, CANNON_Y - BASE.y - BASE.h - 30);
  ctx.fillStyle = '#0a5c9e';
  roundRect(cx - 8, CANNON_Y - 34, 16, 26, 4);
  ctx.fill();
  ctx.fillStyle = '#3fa9ff';
  ctx.beginPath();
  ctx.arc(cx, CANNON_Y, 20, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(cx - 26, CANNON_Y, 52, 12);
  ctx.strokeStyle = 'rgba(255,77,94,0.35)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, CANNON_Y - 8);
  ctx.lineTo(W, CANNON_Y - 8);
  ctx.stroke();
  ctx.setLineDash([]);

  // Effets
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.t * 3);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.t * 2);
    ctx.fillStyle = f.color;
    ctx.font = `900 ${f.big ? 32 : 14}px system-ui, sans-serif`;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // Compteur d'armée
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`🔵 ${game.blue.length}`, 8, CANNON_Y + 30);
  ctx.textAlign = 'center';
}

// ─── Démarrage ───────────────────────────────────────────────────────────────
// Dans l'APK Android (Capacitor), pas de lien retour vers le site
if (window.Capacitor?.isNativePlatform?.()) $('btn-home').hidden = true;

if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.Capacitor) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

renderMenu();
