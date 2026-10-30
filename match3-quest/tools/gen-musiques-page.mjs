#!/usr/bin/env node
/**
 * gen-musiques-page.mjs — Génère la page « Musiques de Hou Yi » (lecteur de toutes les variantes traditionnelles `<clé>-b.mp3`).
 * Les pistes viennent de tools/audio/acestep/catalog.mjs (clés finissant par `-b`, présentes dans audio/music/) : titre de la pièce ancienne
 * citée dans la consigne, scène du jeu, groupe. Une seule source pour la page du dépôt et pour la copie publiée ailleurs.
 *
 * Usage (WSL, Node 22) : node tools/gen-musiques-page.mjs [--out=musiques.html] [--base=audio/music/]
 *   --base : dossier des MP3 vu depuis la page (défaut `audio/music/`, relatif à match3-quest/).
 */
import { writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=')]; }));
const OUT = resolve(args.out || join(GAME, 'musiques.html'));
const BASE = args.base || 'audio/music/';

const mod = await import('./audio/acestep/catalog.mjs');
const CATALOG = mod.CATALOG || mod.TRACKS;

const BIOME = { paddy: 'Rizières', riverbed: 'Lit du fleuve', bamboo: 'Bambous', gobi: 'Gobi', storm: 'Tonnerre', volcano: 'Volcan', savanna: 'Savane', coast: 'Côte', tides: 'Hautes-Eaux', fusang: 'Fusang', moon: 'Lune' };
const SCENE = { title: 'Écran titre', menu: 'Menu', house: 'Maison', sanctuary: 'Sanctuaire', moon: 'Pic de la Lune', ending: 'Fin', victory: 'Victoire', defeat: 'Défaite', 'puzzle-push': 'Énigme des jarres', 'puzzle-mirror': 'Énigme des miroirs', 'puzzle-slide': 'Énigme des chariots' };
// Noms chinois des pièces citées (les autres s'affichent en pinyin).
const ZH = {
  'Shi Mian Mai Fu': '十面埋伏', 'Erquan Yingyue': '二泉映月', 'Yangguan Sandie': '阳关三叠', 'Fengyang Huagu': '凤阳花鼓', 'Gao Shan Liu Shui': '高山流水',
  'Mei Hua San Nong': '梅花三弄', 'Yu Qiao Wen Da': '渔樵问答', 'Guangling San': '广陵散', 'Han Gong Qiu Yue': '汉宫秋月', 'Xiyang Xiaogu': '夕阳箫鼓',
  'Hujia Shiba Pai': '胡笳十八拍', 'Ping Sha Luo Yan': '平沙落雁', 'Yang Chun Bai Xue': '阳春白雪', 'Mo Li Hua': '茉莉花', 'Jin She Kuang Wu': '金蛇狂舞',
  'Chun Jiang Hua Yue Ye': '春江花月夜', 'Lao Liu Ban': '老六板', 'Zi Zhu Diao': '紫竹调', 'Xiao Tao Hong': '小桃红', 'Xiao Xiang Shui Yun': '潇湘水云',
  'Liu Shui': '流水', 'Chang Men Yuan': '长门怨', 'Gu Yuan': '古原', 'Ba Wang Xie Jia': '霸王卸甲', 'Jiang Jun Ling': '将军令', 'Ye Shen Chen': '夜深沉', 'Long Zhou': '龙舟'
};

// Les quatre premiers morceaux citent leur pièce autrement dans le catalogue (« inspired by Hua Yanjun "…" ») : titre forcé.
const FIRST_FOUR = { 'combat-0-b': 'Shi Mian Mai Fu', 'moon-b': 'Erquan Yingyue', 'wild-bamboo-b': 'Yangguan Sandie', 'village-paddy-b': 'Fengyang Huagu' };

// Texte de la pièce citée : après « the ancient piece » jusqu'à la première virgule hors parenthèses.
function pieceOf(style) {
  const m = /(?:ancient piece|piece) (.*)/.exec(style);
  if (!m) return null;
  let depth = 0, end = m[1].length;
  for (let i = 0; i < m[1].length; i++) {
    const c = m[1][i];
    if (c === '(') depth++; else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { end = i; break; }
  }
  return m[1].slice(0, end).replace(/"/g, '').trim();
}
const romanName = piece => (piece || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/ (folk tune|folk song|wandering melody|melody|fierce section|final battle section|section|Beijing opera percussion style)\b.*$/i, '').replace(/^dragon boat festival drumming\s*/i, '').trim();
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const rows = Object.keys(CATALOG).filter(k => /-b$/.test(k) && existsSync(join(GAME, 'audio/music', `${k}.mp3`))).map(k => {
  const base = k.replace(/-b$/, '');
  const piece = pieceOf(CATALOG[k].style);
  const name = FIRST_FOUR[k] || romanName(piece);
  let group, scene;
  if (/^village-/.test(base)) { group = 'Villages'; scene = `Village, ${BIOME[base.slice(8)] || base.slice(8)}`; }
  else if (/^wild-/.test(base)) { group = 'Zones sauvages'; scene = `Exploration, ${BIOME[base.slice(5)] || base.slice(5)}`; }
  else if (/^combat-/.test(base)) { group = 'Combats'; scene = base === 'combat-tides' ? 'Combat, Hautes-Eaux' : `Combat, style ${Number(base.slice(7)) + 1}`; }
  else if (/^boss-a\d$/.test(base)) { group = 'Boss'; scene = `Boss, archétype ${Number(base.slice(6)) + 1}`; }
  else if (/^boss-/.test(base)) { group = 'Boss'; scene = cap(base.slice(5).replace(/-/g, ' ')); }
  else { group = 'Scènes'; scene = SCENE[base] || base; }
  return { key: k, group, scene, zh: ZH[name] || '', name: name || scene };
});
const ORDER = ['Scènes', 'Villages', 'Zones sauvages', 'Combats', 'Boss'];
rows.sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group));
const DATA = JSON.stringify(rows.map(r => [r.key, r.group, r.scene, r.zh, r.name]));

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Musiques de Hou Yi</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600&family=Sora:wght@400;600&display=swap" rel="stylesheet">
<style>
/* Page générée par tools/gen-musiques-page.mjs (ne pas modifier à la main). Lecteur en haut, liste groupée dessous ; laque noire, vermillon = piste active, jade = repères. */
:root{
  --bg:#14110f; --panel:#1d1815; --line:#33291f; --ink:#efe6d6; --mute:#a89a85;
  --accent:#d6452b; --jade:#6fb59a;
  --display:"Noto Serif SC","Songti SC",serif; --body:"Sora",system-ui,sans-serif;
  color-scheme:dark;
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--body)}
body{min-height:100%;padding:24px 16px 48px}
main{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:24px}
h1{margin:0;font-family:var(--display);font-size:1.5rem;text-wrap:balance}
.sub{margin:4px 0 0;color:var(--mute);font-size:.9rem}
.player{position:sticky;top:0;z-index:2;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 20px;display:flex;flex-direction:column;gap:12px}
.now-zh{font-family:var(--display);font-size:1.7rem;line-height:1.1}
.now-fr{color:var(--mute);font-size:.9rem;margin-top:4px}
.seek{display:flex;align-items:center;gap:12px;font-variant-numeric:tabular-nums;color:var(--mute);font-size:.8rem}
input[type=range]{-webkit-appearance:none;appearance:none;height:4px;background:var(--line);border-radius:2px;flex:1;accent-color:var(--accent)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--accent);cursor:pointer}
input[type=range]::-moz-range-thumb{width:14px;height:14px;border:0;border-radius:50%;background:var(--accent);cursor:pointer}
.controls{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.btns{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
button,input[type=search]{font:inherit;color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:999px;padding:8px 14px}
button{cursor:pointer}
button:hover{border-color:var(--mute)}
button:focus-visible,li:focus-visible,input:focus-visible{outline:2px solid var(--jade);outline-offset:2px}
button.play{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600;min-width:96px}
button[aria-pressed=true]{border-color:var(--jade);color:var(--jade)}
.vol{display:flex;align-items:center;gap:8px;color:var(--mute);font-size:.8rem}
.vol input{width:96px;flex:none}
input[type=search]{width:100%;border-radius:10px}
ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
li{display:grid;grid-template-columns:28px 1fr auto;gap:12px;align-items:center;padding:10px 12px;border-radius:10px;cursor:pointer;border:1px solid transparent}
li:hover{background:var(--panel)}
li[aria-current=true]{background:var(--panel);border-color:var(--accent)}
.n{color:var(--mute);font-variant-numeric:tabular-nums;text-align:right}
li[aria-current=true] .n{color:var(--accent)}
.t-zh{font-family:var(--display)}
.t-fr{color:var(--mute);font-size:.82rem}
.scene{color:var(--jade);font-size:.75rem;text-align:right}
.group{color:var(--mute);font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;margin:16px 0 8px}
@media (max-width:480px){.scene{display:none}.vol input{width:72px}li{grid-template-columns:28px 1fr}}
@media (prefers-reduced-motion:no-preference){li{transition:background .15s}}
</style>
</head>
<body>
<main>
  <header>
    <h1>Musiques de Hou Yi</h1>
    <p class="sub" id="sub"></p>
  </header>

  <section class="player" aria-label="Lecteur">
    <div>
      <div class="now-zh" id="nowZh"></div>
      <div class="now-fr" id="nowFr"></div>
    </div>
    <div class="seek">
      <span id="cur">0:00</span>
      <input type="range" id="seek" min="0" max="1000" value="0" aria-label="Position">
      <span id="dur">0:00</span>
    </div>
    <div class="controls">
      <div class="btns">
        <button id="prev" aria-label="Piste précédente">Précédent</button>
        <button id="play" class="play">Lecture</button>
        <button id="next" aria-label="Piste suivante">Suivant</button>
      </div>
      <div class="btns">
        <button id="auto" aria-pressed="true">Enchaîner</button>
        <button id="shuf" aria-pressed="false">Aléatoire</button>
        <label class="vol">Volume <input type="range" id="vol" min="0" max="100" value="80" aria-label="Volume"></label>
      </div>
    </div>
  </section>

  <section>
    <input type="search" id="q" placeholder="Filtrer : boss, village, guqin, Gobi" aria-label="Filtrer les pistes">
    <div id="lists"></div>
  </section>
  <audio id="a" preload="metadata"></audio>
</main>
<script>
// [clé, groupe, scène, titre chinois, titre de la pièce]
const T = ${DATA};
const BASE = ${JSON.stringify(BASE)};
const el = id => document.getElementById(id), a = el('a'), lists = el('lists');
let i = 0, auto = true, shuffle = false;
const fmt = s => isFinite(s) ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00';
el('sub').textContent = T.length + ' interprétations inspirées de pièces anciennes, à alterner avec la bande-son du jeu.';
const items = [];
let lastGroup = null, ol = null;
T.forEach((t, k) => {
  if (t[1] !== lastGroup) {
    lastGroup = t[1];
    const h = document.createElement('p'); h.className = 'group'; h.textContent = lastGroup; h.dataset.group = lastGroup; lists.appendChild(h);
    ol = document.createElement('ol'); lists.appendChild(ol);
  }
  const li = document.createElement('li');
  li.tabIndex = 0;
  li.innerHTML = '<span class="n">' + (k + 1) + '</span><span><div class="t-zh">' + (t[3] || t[4]) + '</div><div class="t-fr">' + (t[3] ? t[4] + ' · ' : '') + t[2] + '</div></span><span class="scene">' + t[1] + '</span>';
  li.addEventListener('click', () => load(k, true));
  li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); load(k, true); } });
  ol.appendChild(li);
  items.push(li);
});
function load(k, play) {
  i = k;
  const t = T[k];
  a.src = BASE + t[0] + '.mp3';
  el('nowZh').textContent = t[3] || t[4];
  el('nowFr').textContent = (t[3] ? t[4] + ' · ' : '') + t[2];
  items.forEach((li, j) => j === k ? li.setAttribute('aria-current', 'true') : li.removeAttribute('aria-current'));
  el('seek').value = 0; el('cur').textContent = '0:00'; el('dur').textContent = '0:00';
  if (play) a.play().catch(() => {});
}
function step(d) {
  if (shuffle && d > 0) {
    let k;
    do { k = Math.floor(Math.random() * T.length); } while (k === i && T.length > 1);
    load(k, true);
    return;
  }
  load((i + d + T.length) % T.length, true);
}
el('q').oninput = e => {
  const q = e.target.value.trim().toLowerCase();
  items.forEach((li, k) => { li.hidden = q && (T[k].join(' ').toLowerCase().indexOf(q) < 0); });
  [...lists.querySelectorAll('ol')].forEach(o => { o.previousElementSibling.hidden = [...o.children].every(c => c.hidden); });
};
el('play').onclick = () => { a.paused ? a.play().catch(() => {}) : a.pause(); };
el('prev').onclick = () => step(-1);
el('next').onclick = () => step(1);
el('auto').onclick = e => { auto = !auto; e.currentTarget.setAttribute('aria-pressed', auto); };
el('shuf').onclick = e => { shuffle = !shuffle; e.currentTarget.setAttribute('aria-pressed', shuffle); };
el('vol').oninput = e => { a.volume = e.target.value / 100; };
a.volume = 0.8;
a.onplay = () => { el('play').textContent = 'Pause'; };
a.onpause = () => { el('play').textContent = 'Lecture'; };
a.onloadedmetadata = () => { el('dur').textContent = fmt(a.duration); };
a.ontimeupdate = () => { el('cur').textContent = fmt(a.currentTime); if (a.duration) el('seek').value = a.currentTime / a.duration * 1000; };
el('seek').oninput = e => { if (a.duration) a.currentTime = e.target.value / 1000 * a.duration; };
a.onended = () => { if (auto) step(1); };
load(0, false);
</script>
</body>
</html>
`;
writeFileSync(OUT, html);
console.log(`${rows.length} pistes → ${OUT}`);
