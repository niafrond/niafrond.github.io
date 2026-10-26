// Génère la soluce du jeu (match3-quest/soluce.html + match3-quest/soluce/*.html) à partir des données réelles du jeu :
// quêtes (story.js), compagnons (companions.js, companionPowers.js), stuff (stuff.js), bestiaire (enemies.catalog.json).
// Usage : node match3-quest/tools/build-soluce.mjs
//
// La soluce n'est liée depuis aucune page du jeu : on y accède uniquement en connaissant l'adresse (…/match3-quest/soluce.html).
// Les pages sont `noindex` et ne figurent pas dans precache-manifest.json.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTS, SCREENS, REGION_UNLOCK_LEVEL } from '../story.js';
import { COMPANIONS } from '../companions.js';
import { COMPANION_POWERS } from '../companionPowers.js';
import { allStuff, STUFF_SLOT_LABELS, STUFF_SLOTS, BIOME_PROTECTION_TEXT, BIOME_PROTECTION_LABEL, describeStuff, baseStuffPrice, CHEST_STUFF_DROP } from '../stuff.js';
import { bestiaryEntry } from '../bestiary.js';
import { entOf, questTargets } from './soluce-targets.mjs';
import { PUZZLES, PUZZLE_SETS, puzzlesOfSet } from '../puzzle/levels.js';
import { solvePath, getMode } from '../puzzle/engine.js';
import '../puzzle/modes.js';
import { spriteDefs } from '../puzzle/art.js';
import { ANTIQUE_ARMORS } from '../stuff.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'soluce');
const IMG = join(OUT, 'img');
const CATALOG = JSON.parse(readFileSync(join(ROOT, 'enemies.catalog.json'), 'utf8'));
const TEMPLATE = Object.fromEntries(CATALOG.map(t => [t.id, t]));

// ───────────────────────── Utilitaires ─────────────────────────
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const COLOR_FR = { red: 'Feu (rouge)', blue: 'Eau (bleu)', green: 'Terre (vert)', yellow: 'Air (jaune)', purple: 'Arcane (violet)' };
const COLOR_DOT = { red: '#e0533d', blue: '#3f8fe0', green: '#4cae5d', yellow: '#e6c13a', purple: '#9b62d6' };
const RARITY_FR = { common: 'Commun', uncommon: 'Peu commun', rare: 'Rare', legendary: 'Légendaire' };
const plural = (n, a, b) => (n > 1 ? b : a);
const dot = c => (c ? `<span class="dot" style="background:${COLOR_DOT[c]}"></span>${esc(COLOR_FR[c])}` : '—');

const REGION_ORDER = Object.keys(REGION_UNLOCK_LEVEL).sort((a, b) => REGION_UNLOCK_LEVEL[a] - REGION_UNLOCK_LEVEL[b]);
const regionName = r => SCREENS[r]?.name || r;
const regionSlug = r => `quetes-${r}.html`;

// Position approximative d'une case sur l'écran (tiers de la carte).
function compass(x, y, w, h) {
    if (![x, y, w, h].every(Number.isFinite)) return '';
    const col = x < w / 3 ? 'ouest' : x >= (2 * w) / 3 ? 'est' : '';
    const row = y < h / 3 ? 'nord' : y >= (2 * h) / 3 ? 'sud' : '';
    if (!col && !row) return 'centre';
    return `${row}${row && col ? '-' : ''}${col}`;
}
const whereOf = e => {
    if (!e) return '';
    const s = e.screen;
    return `${s.name} (${compass(e.ent.x, e.ent.y, s.w, s.h) === 'centre' ? 'au centre' : `partie ${compass(e.ent.x, e.ent.y, s.w, s.h)}`} de l’écran)`;
};

// Itinéraire dans une région : plus court chemin de connexions / portes depuis le village (ou le sanctuaire) de la région.
const adj = s => [...Object.values(s.connections || {}).map(c => ({ to: c.to, req: c.requires })), ...(s.exits || []).map(e => ({ to: e.to, req: e.requires }))];
function routeIn(region, targetId) {
    const start = SCREENS[`${region}_village`] ? `${region}_village` : region;
    if (targetId === start) return [start];
    const ok = id => SCREENS[id] && (SCREENS[id].region === region || id === region);
    const prev = { [start]: null };
    const queue = [start];
    while (queue.length) {
        const cur = queue.shift();
        if (cur === targetId) break;
        for (const e of adj(SCREENS[cur])) {
            if (e.to in prev || !ok(e.to)) continue;
            prev[e.to] = cur;
            queue.push(e.to);
        }
    }
    if (!(targetId in prev)) return null;
    const path = [];
    for (let c = targetId; c; c = prev[c]) path.unshift(c);
    return path;
}
const routeText = (region, screenId) => {
    const p = routeIn(region, screenId);
    if (!p || p.length < 2) return '';
    return p.map(id => SCREENS[id].name).join(' → ');
};

const titleOfQuest = id => QUESTS.find(q => q.id === id)?.title;
const questById = Object.fromEntries(QUESTS.map(q => [q.id, q]));
const questAnchor = id => `q-${id}`;

// Région d'une quête = région de son donneur.
const regionOfQuest = q => (entOf(q.giver, ['npc'])?.screen.region) || 'rizieres';
const questLevel = q => REGION_UNLOCK_LEVEL[regionOfQuest(q)] || 1;
for (const q of QUESTS) q._region = regionOfQuest(q);

// Exigences lisibles
function reqText(id) {
    if (questById[id]) return { html: `<a href="${regionSlug(questById[id]._region)}#${questAnchor(id)}">${esc(questById[id].title)}</a>`, plain: questById[id].title };
    const en = entOf(id, ['enemy']);
    if (en) return { html: `vaincre <strong>${esc(en.ent.name)}</strong>`, plain: en.ent.name };
    if (id.startsWith('parley_')) return { html: `pourparlers (<code>${esc(id)}</code>)`, plain: id };
    return { html: `<code>${esc(id)}</code>`, plain: id };
}
const asArray = v => (Array.isArray(v) ? v : v ? [v] : []);

// Fiche d'un ennemi nommé
function enemyCard(id) {
    const hit = entOf(id, ['enemy']);
    if (!hit) return '';
    const e = hit.ent;
    const t = TEMPLATE[e.templateId];
    const be = t ? bestiaryEntry(t) : null;
    const lvl = e.boss?.level ? `niveau ${e.boss.level}` : e.offset !== undefined ? `niveau du héros ${e.offset >= 0 ? '+' : '−'}${Math.abs(e.offset)}` : 'niveau du héros';
    return `<ul class="enemy">
      <li><b>${esc(e.name)}</b> — ${esc(lvl)}${e.permanent ? ', ne réapparaît pas' : ''}${e.kind === 'patrol' ? ', patrouille' : ', immobile (sentinelle)'}</li>
      <li>Lieu : ${esc(whereOf(hit))}</li>
      ${be ? `<li>Espèce : ${esc(be.name)}${be.race ? ` (${esc(be.race)})` : ''} — Force : ${dot(be.strongColor)} — <b>Faiblesse : ${dot(be.weakColor)}</b>${be.traits.length ? ` — ${esc(be.traits.join(', '))}` : ''}</li>` : ''}
    </ul>`;
}

// ───────────────────────── Gabarit de page ─────────────────────────
const CSS = `
:root{--bg:#14110f;--panel:#1f1a16;--panel2:#2a231d;--ink:#f1e6d2;--dim:#b9a98f;--gold:#e8b84a;--red:#d9553f;--jade:#59b88a;--blue:#5aa6e6;--line:#4a3d30}
@media (prefers-color-scheme:light){:root:not([data-theme=dark]){--bg:#f4ead6;--panel:#fffaf0;--panel2:#f0e2c4;--ink:#2a1f14;--dim:#6f5d45;--gold:#9a6a05;--red:#b23a25;--jade:#237a52;--blue:#1d5f9e;--line:#cdb88e}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Georgia,'Times New Roman',serif}
a{color:var(--blue)}a:hover{color:var(--gold)}
header.top{background:linear-gradient(180deg,var(--red),#7d2417);color:#fff4dc;border-bottom:4px solid var(--gold);padding:14px 16px}
header.top .in{max-width:980px;margin:0 auto;display:flex;flex-wrap:wrap;gap:6px 18px;align-items:baseline}
header.top h1{margin:0;font-size:1.35rem;letter-spacing:.04em;text-transform:uppercase}
header.top h1 small{display:block;font-size:.7rem;font-weight:400;opacity:.85;letter-spacing:.12em}
nav.menu{max-width:980px;margin:0 auto;display:flex;flex-wrap:wrap;gap:4px 14px;font:600 .85rem system-ui,sans-serif}
nav.menu a{color:#fff4dc;text-decoration:none;padding:4px 0;border-bottom:2px solid transparent}
nav.menu a:hover,nav.menu a.on{border-bottom-color:var(--gold)}
main{max-width:980px;margin:0 auto;padding:18px 16px 60px}
h2{margin:1.8em 0 .5em;border-left:6px solid var(--gold);padding-left:10px;font-size:1.35rem}
h3{margin:1.4em 0 .4em;font-size:1.1rem;color:var(--gold)}
.crumbs{font:.82rem system-ui,sans-serif;color:var(--dim);margin-bottom:10px}
.lead{font-size:1.05rem;color:var(--dim)}
.box{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:12px 0}
.box.tip{border-left:6px solid var(--jade)}.box.warn{border-left:6px solid var(--red)}.box.info{border-left:6px solid var(--blue)}
.box b.t{display:block;font:700 .75rem system-ui,sans-serif;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px}
.tip b.t{color:var(--jade)}.warn b.t{color:var(--red)}.info b.t{color:var(--blue)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin:12px 0}
.card{display:block;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px;text-decoration:none;color:var(--ink)}
.card:hover{border-color:var(--gold);background:var(--panel2)}
.card b{display:block;color:var(--gold)}.card span{font-size:.85rem;color:var(--dim)}
table{width:100%;border-collapse:collapse;margin:10px 0;font-size:.93rem}
th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
th{background:var(--panel2);font:700 .78rem system-ui,sans-serif;text-transform:uppercase;letter-spacing:.06em}
.scroll{overflow-x:auto}
.quest{background:var(--panel);border:1px solid var(--line);border-radius:8px;margin:14px 0;padding:0 14px 8px}
.quest>h3{margin:0 -14px 8px;padding:8px 14px;background:var(--panel2);border-radius:8px 8px 0 0;color:var(--ink)}
.quest>h3 small{font:600 .72rem system-ui,sans-serif;color:var(--dim);margin-left:8px}
.badge{display:inline-block;font:700 .68rem system-ui,sans-serif;padding:1px 7px;border-radius:9px;background:var(--gold);color:#201505;margin-left:4px;vertical-align:middle}
.badge.main{background:var(--red);color:#fff}.badge.comp{background:var(--jade);color:#08210f}.badge.stuff{background:var(--blue);color:#fff}
dl{margin:6px 0}dt{font:700 .75rem system-ui,sans-serif;text-transform:uppercase;letter-spacing:.07em;color:var(--dim);margin-top:8px}dd{margin:2px 0 0 0}
svg.board{width:min(100%,420px);display:block;margin:8px 0;background:#fffaf0;border:1px solid var(--line);border-radius:6px}details{margin:8px 0}summary{cursor:pointer;color:var(--gold);font-weight:600}ol.steps{padding-left:22px}ol.steps li{margin:6px 0}.pl-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}.pl-bar[hidden]{display:none}.pl-bar button,.pl-bar select{font:inherit;min-height:38px;padding:4px 12px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--ink);cursor:pointer}.pl-bar .pl-play{background:var(--gold);color:var(--bg);font-weight:700;min-width:7.5em}.pl-bar label{display:flex;gap:6px;align-items:center;color:var(--dim)}.pl-status{margin:6px 0;font-weight:600;min-height:2.8em}.pl ol.steps li{cursor:pointer;padding:2px 6px;border-radius:4px}.pl ol.steps li.done{opacity:.55}.pl ol.steps li.cur{background:var(--panel2);outline:2px solid var(--gold);opacity:1}.pl details{max-height:none}
.shot{margin:10px 0}.shotbox{position:relative;border:2px solid var(--line);border-radius:6px;overflow:hidden;line-height:0}
.shotbox img{width:100%;height:auto;display:block}
.ring{position:absolute;transform:translate(-50%,-50%);border:3px solid #ff1f1f;border-radius:50%;box-shadow:0 0 0 2px #fff,inset 0 0 0 2px #fff;pointer-events:none}
.ring i{position:absolute;right:-6px;top:-10px;min-width:17px;height:17px;border-radius:9px;background:#ff1f1f;color:#fff;font:700 11px/17px system-ui,sans-serif;text-align:center;font-style:normal;box-shadow:0 0 0 1px #fff}
.shotbox{cursor:zoom-in}
.lb{position:fixed;inset:0;z-index:1000;background:#0a0705;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.lb[hidden]{display:none}
.lb-stage{position:absolute;left:0;top:0;transform-origin:0 0;line-height:0;cursor:grab;will-change:transform}
.lb.drag .lb-stage{cursor:grabbing}
.lb-stage .shotbox{border:0;border-radius:0;cursor:inherit;max-width:none!important}
.lb-stage img{width:100%;pointer-events:none;-webkit-user-drag:none}
.lb-btn{position:absolute;width:44px;height:44px;border-radius:50%;border:2px solid #fff4dc;background:rgba(30,22,16,.85);color:#fff4dc;font:700 24px/1 system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.lb-btn:hover,.lb-btn:focus-visible{background:#d9553f;outline:none}
.lb-close{top:calc(12px + env(safe-area-inset-top,0px));right:calc(12px + env(safe-area-inset-right,0px))}
.lb-tools{position:absolute;bottom:calc(14px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);display:flex;gap:10px}
.lb-tools .lb-btn{position:static}
.lb-cap{position:absolute;left:12px;right:70px;top:calc(14px + env(safe-area-inset-top,0px));color:#fff4dc;font:.85rem system-ui,sans-serif;pointer-events:none;text-shadow:0 1px 3px #000}
.lb-cap small{display:none}
.lb-cap b{color:#ff7a6a}
.shot figcaption{font:.82rem system-ui,sans-serif;color:var(--dim);margin-top:4px}
.shot figcaption b{color:#ff5a4a}
ul.enemy{margin:4px 0;padding-left:20px;font-size:.92rem}
.dot{display:inline-block;width:.7em;height:.7em;border-radius:50%;margin-right:4px;border:1px solid rgba(0,0,0,.4)}
.search{width:100%;padding:10px 12px;font:1rem system-ui,sans-serif;border-radius:8px;border:2px solid var(--line);background:var(--panel);color:var(--ink)}
#results a{display:block;padding:6px 4px;border-bottom:1px solid var(--line);text-decoration:none}
#results small{color:var(--dim)}
footer{max-width:980px;margin:0 auto;padding:16px;font:.78rem system-ui,sans-serif;color:var(--dim);border-top:1px solid var(--line)}
@media (max-width:560px){h2{font-size:1.15rem}table{font-size:.85rem}}
`;

const NAV = [
    ['soluce.html', 'Accueil'], ['parcours.html', 'Parcours principal'], ['bases.html', 'Bases du combat'],
    ['compagnons.html', 'Compagnons'], ['quetes.html', 'Quêtes'], ['stuff.html', 'Stuff d’exception'], ['enigmes.html', 'Énigmes et armures']
];


const LIGHTBOX = `<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Carte agrandie" hidden>
<div class="lb-stage" id="lb-stage"></div>
<div class="lb-cap" id="lb-cap"></div>
<button class="lb-btn lb-close" id="lb-close" type="button" aria-label="Fermer l’aperçu">&times;</button>
<div class="lb-tools"><button class="lb-btn" id="lb-out" type="button" aria-label="Zoom arrière">&minus;</button><button class="lb-btn" id="lb-fit" type="button" aria-label="Ajuster à l’écran" style="font-size:15px">Ajuster</button><button class="lb-btn" id="lb-in" type="button" aria-label="Zoom avant">+</button></div>
</div>
<script>
(function(){
var lb=document.getElementById('lb'),stage=document.getElementById('lb-stage'),cap=document.getElementById('lb-cap');
var S=1,TX=0,TY=0,FIT=1,W=1,H=1,pts={},pinch=0,moved=0,lastTap=0,opener=null,onStage=false;
function vw(){return lb.clientWidth;}function vh(){return lb.clientHeight;}
function apply(){stage.style.transform='translate('+TX+'px,'+TY+'px) scale('+S+')';}
function clampPan(){
  var w=W*S,h=H*S,m=60;
  TX=w<=vw()?(vw()-w)/2:Math.min(m,Math.max(vw()-w-m,TX));
  TY=h<=vh()?(vh()-h)/2:Math.min(m,Math.max(vh()-h-m,TY));
}
function zoomAt(f,cx,cy){
  var ns=Math.min(10,Math.max(FIT*0.95,S*f));f=ns/S;
  TX=cx-(cx-TX)*f;TY=cy-(cy-TY)*f;S=ns;clampPan();apply();
}
function fit(){S=FIT;TX=(vw()-W*S)/2;TY=(vh()-H*S)/2;apply();}
function open(box){
  opener=box;
  var c=box.cloneNode(true);c.removeAttribute('style');
  var img=c.querySelector('img');
  var fig=box.closest('figure'),t=fig&&fig.querySelector('figcaption');
  cap.innerHTML=t?t.innerHTML:'';
  stage.innerHTML='';stage.appendChild(c);
  lb.hidden=false;document.body.style.overflow='hidden';
  function go(){
    W=img.naturalWidth||1200;H=img.naturalHeight||(W*0.5);
    stage.style.width=W+'px';
    FIT=Math.min(vw()/W,vh()/H)*0.96;fit();
  }
  if(img.complete&&img.naturalWidth)go();else{img.onload=go;W=1200;H=600;stage.style.width=W+'px';FIT=Math.min(vw()/W,vh()/H)*0.96;fit();}
  document.getElementById('lb-close').focus();
}
function close(){lb.hidden=true;stage.innerHTML='';document.body.style.overflow='';pts={};if(opener&&opener.scrollIntoView){}}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.shotbox');if(b&&!lb.contains(b))open(b);});
document.getElementById('lb-close').addEventListener('click',close);
document.getElementById('lb-in').addEventListener('click',function(){zoomAt(1.5,vw()/2,vh()/2);});
document.getElementById('lb-out').addEventListener('click',function(){zoomAt(1/1.5,vw()/2,vh()/2);});
document.getElementById('lb-fit').addEventListener('click',fit);
document.addEventListener('keydown',function(e){
  if(lb.hidden)return;
  if(e.key==='Escape')close();
  else if(e.key==='+'||e.key==='=')zoomAt(1.4,vw()/2,vh()/2);
  else if(e.key==='-')zoomAt(1/1.4,vw()/2,vh()/2);
  else if(e.key==='0')fit();
});
lb.addEventListener('wheel',function(e){e.preventDefault();zoomAt(Math.exp(-e.deltaY*0.0015),e.clientX,e.clientY);},{passive:false});
lb.addEventListener('pointerdown',function(e){
  if(e.target.closest('.lb-btn'))return;
  onStage=!!e.target.closest('.lb-stage');pts[e.pointerId]={x:e.clientX,y:e.clientY};moved=0;lb.setPointerCapture(e.pointerId);lb.classList.add('drag');
  var k=Object.keys(pts);if(k.length===2){var a=pts[k[0]],b=pts[k[1]];pinch=Math.hypot(a.x-b.x,a.y-b.y);}
});
lb.addEventListener('pointermove',function(e){
  var p=pts[e.pointerId];if(!p)return;
  var k=Object.keys(pts);
  if(k.length===2){
    var a=pts[k[0]],b=pts[k[1]];
    pts[e.pointerId]={x:e.clientX,y:e.clientY};
    var a2=pts[k[0]],b2=pts[k[1]],d=Math.hypot(a2.x-b2.x,a2.y-b2.y);
    if(pinch>0)zoomAt(d/pinch,(a2.x+b2.x)/2,(a2.y+b2.y)/2);
    pinch=d;moved=9;return;
  }
  moved+=Math.abs(e.clientX-p.x)+Math.abs(e.clientY-p.y);
  TX+=e.clientX-p.x;TY+=e.clientY-p.y;pts[e.pointerId]={x:e.clientX,y:e.clientY};clampPan();apply();
});
function up(e){
  var had=pts[e.pointerId];delete pts[e.pointerId];pinch=0;
  if(!Object.keys(pts).length)lb.classList.remove('drag');
  if(had&&moved<6&&!e.target.closest('.lb-btn')){
    var now=Date.now();
    if(now-lastTap<350){if(S>FIT*1.2)fit();else zoomAt(3,e.clientX,e.clientY);lastTap=0;}else lastTap=now;
    if(!onStage)close();
  }
}
lb.addEventListener('pointerup',up);lb.addEventListener('pointercancel',function(e){delete pts[e.pointerId];pinch=0;lb.classList.remove('drag');});
window.addEventListener('resize',function(){if(!lb.hidden){FIT=Math.min(vw()/W,vh()/H)*0.96;if(S<FIT)fit();else{clampPan();apply();}}});
})();
</script>`;

function page({ file, title, desc, body, crumbs = [], active }) {
    const top = file === 'soluce.html';
    const rel = p => (top ? (p === 'soluce.html' ? 'soluce.html' : `soluce/${p}`) : (p === 'soluce.html' ? '../soluce.html' : p));
    const menu = NAV.map(([f, l]) => `<a href="${rel(f)}"${f === active ? ' class="on"' : ''}>${l}</a>`).join('');
    const cr = crumbs.length ? `<div class="crumbs">${crumbs.map(([h, l]) => (h ? `<a href="${rel(h)}">${esc(l)}</a>` : esc(l))).join(' › ')}</div>` : '';
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${esc(desc)}">
<title>${esc(title)} — Soluce Hou Yi et les Dix Soleils</title>
<style>${CSS}</style>
</head>
<body>
<header class="top"><div class="in"><h1>Soluce complète<small>La Légende de Hou Yi — Match3 Quest</small></h1><nav class="menu">${menu}</nav></div></header>
<main>
${cr}
${body}
</main>
${LIGHTBOX}
<footer>Soluce non officielle, générée depuis les données du jeu (<code>tools/build-soluce.mjs</code>). Attention : contient de nombreux spoilers. Page non listée, ne pas diffuser sans l’avis de l’auteur.</footer>
</body>
</html>
`;
}

const write = (file, html) => {
    const path = file === 'soluce.html' ? join(ROOT, 'soluce.html') : join(OUT, file);
    writeFileSync(path, html);
};

// ───────────────────────── Quêtes ─────────────────────────
function objectiveHtml(o, region) {
    const kindFr = { kill: 'Vaincre', killGroup: 'Vaincre le groupe', chest: 'Ouvrir', talk: 'Parler à', item: 'Rapporter', visit: 'Se rendre à' }[o.type] || o.type;
    let where = '';
    let extra = '';
    if (o.type === 'visit') {
        const sc = SCREENS[o.target];
        if (sc) where = `${sc.name}${routeText(region, sc.id) ? ` — itinéraire : ${esc(routeText(region, sc.id))}` : ''}`;
    } else if (o.type === 'killGroup') {
        const members = Object.values(SCREENS).flatMap(s => (s.enemies || []).filter(e => e.group === o.target).map(e => ({ screen: s, ent: e })));
        if (members.length) {
            where = whereOf(members[0]);
            extra = `<ul class="enemy">${members.map(m => `<li>${esc(m.ent.name)} — ${esc(compass(m.ent.x, m.ent.y, m.screen.w, m.screen.h))}</li>`).join('')}</ul>`;
            const t = TEMPLATE[members[0].ent.templateId];
            if (t) { const be = bestiaryEntry(t); extra += `<p class="dim">Faiblesse : ${dot(be.weakColor)}</p>`; }
        }
    } else {
        const hit = entOf(o.target, o.type === 'kill' ? ['enemy'] : o.type === 'chest' ? ['chest'] : o.type === 'talk' ? ['npc'] : ['chest', 'npc', 'enemy']);
        if (hit) where = whereOf(hit);
        if (o.type === 'kill') extra = enemyCard(o.target);
        const sid = hit?.screen.id;
        if (sid && routeText(region, sid)) where += ` — itinéraire : ${routeText(region, sid)}`;
    }
    return `<li><b>${kindFr}</b> : ${esc(o.text)}${where ? `<br><small>Lieu : ${esc(where)}</small>` : ''}${extra}</li>`;
}


// Captures annotées : la carte de l'écran (soluce/img, voir build-soluce-shots.mjs) avec un cercle rouge par case citée par la quête.
const ROLE_FR = { giver: 'donne la quête', turnIn: 'à qui la rendre', target: 'objectif' };
function shotsHtml(q) {
    const byScreen = new Map();
    for (const t of questTargets(q)) byScreen.set(t.screenId, [...(byScreen.get(t.screenId) || []), t]);
    const figs = [];
    for (const [sid, list] of byScreen) {
        if (!existsSync(join(IMG, `${sid}.jpg`))) continue;
        const sc = SCREENS[sid];
        const rw = (1.8 / sc.w) * 100, rh = (1.8 / sc.h) * 100;
        const rings = list.map((t, i) => `<span class="ring" style="left:${(((t.x + 0.5) / sc.w) * 100).toFixed(2)}%;top:${(((t.y + 0.5) / sc.h) * 100).toFixed(2)}%;width:${rw.toFixed(2)}%;height:${rh.toFixed(2)}%"><i>${i + 1}</i></span>`).join('');
        const legend = list.map((t, i) => `<b>${i + 1}</b> ${esc(t.name)} (${ROLE_FR[t.role]})`).join(' · ');
        figs.push(`<figure class="shot"><div class="shotbox" title="Cliquer pour agrandir" style="max-width:${Math.min(1200, sc.w * 44)}px"><img src="img/${sid}.jpg" width="${sc.w * 44}" height="${sc.h * 44}" loading="lazy" alt="Carte : ${esc(sc.name)}">${rings}</div><figcaption>${esc(sc.name)} : ${legend} <small>(cliquer pour agrandir)</small></figcaption></figure>`);
    }
    return figs.join('');
}

function questHtml(q) {
    const region = q._region;
    const giver = entOf(q.giver, ['npc']);
    const turn = q.turnIn === q.giver ? null : entOf(q.turnIn, ['npc']);
    const reqs = asArray(q.requires).map(reqText);
    const next = QUESTS.filter(o => asArray(o.requires).includes(q.id));
    const r = q.reward || {};
    const rewards = [];
    if (r.gold) rewards.push(`${r.gold} pièces d’or`);
    if (r.xp) rewards.push(`${r.xp} points d’expérience`);
    if (r.stuff) rewards.push(`<a href="stuff-${r.stuff}.html"><strong>${esc(allStuff.find(s => s.id === r.stuff)?.name || r.stuff)}</strong></a> (stuff d’exception)`);
    if (r.ultimate) rewards.push(`<strong>${esc(String(r.fragment).replace(/^Ultime : /, ''))}</strong> (sort ultime)`);
    else if (r.fragment) rewards.push(`composant de flèche : ${esc(r.fragment)}`);
    const comp = COMPANIONS.find(c => c.joinWhen === q.id);
    if (comp) rewards.push(`<a href="compagnon-${comp.id}.html"><strong>${esc(comp.name)}</strong></a> rejoint le groupe`);
    const badges = [q.side ? '' : '<span class="badge main">Principale</span>', comp ? '<span class="badge comp">Compagnon</span>' : '', r.stuff ? '<span class="badge stuff">Stuff</span>' : ''].join('');
    const route = giver ? routeText(region, giver.screen.id) : '';
    return `<article class="quest" id="${questAnchor(q.id)}">
  <h3>${esc(q.title)} ${badges}<small>${esc(q.chapter.replace(/^✦ Quête secondaire — /, ''))}</small></h3>
  <dl>
    <dt>Prérequis</dt><dd>${reqs.length ? reqs.map(x => x.html).join(', ') : 'Aucun, disponible dès l’arrivée.'}</dd>
    <dt>Donneur</dt><dd>${giver ? `<b>${esc(giver.ent.name)}</b>${giver.ent.title ? ` (${esc(giver.ent.title)})` : ''} — ${esc(whereOf(giver))}${route ? `<br><small>Itinéraire depuis le village : ${esc(route)}</small>` : ''}` : esc(q.giver)}</dd>
    ${turn ? `<dt>À rapporter à</dt><dd><b>${esc(turn.ent.name)}</b> — ${esc(whereOf(turn))}</dd>` : ''}
    <dt>Objectifs</dt><dd><ol class="steps">${q.objectives.map(o => objectiveHtml(o, region)).join('')}</ol></dd>
    <dt>Récompense</dt><dd>${rewards.join(' · ') || '—'}</dd>
    ${shotsHtml(q) ? `<dt>Où chercher</dt><dd>${shotsHtml(q)}</dd>` : ''}
    ${next.length ? `<dt>Débloque</dt><dd>${next.map(n => `<a href="${regionSlug(n._region)}#${questAnchor(n.id)}">${esc(n.title)}</a>`).join(', ')}</dd>` : ''}
  </dl>
</article>`;
}

// ───────────────────────── Pages ─────────────────────────
const quetesByRegion = r => QUESTS.filter(q => q._region === r).sort((a, b) => (a.side ? 1 : 0) - (b.side ? 1 : 0));
const regionsWithQuests = REGION_ORDER.filter(r => quetesByRegion(r).length);

function buildQuests() {
    const cards = regionsWithQuests.map(r => {
        const qs = quetesByRegion(r);
        return `<a class="card" href="${regionSlug(r)}"><b>${esc(regionName(r))}</b><span>Niveau ${REGION_UNLOCK_LEVEL[r]} · ${qs.length} ${plural(qs.length, 'quête', 'quêtes')}</span></a>`;
    }).join('');
    write('quetes.html', page({
        file: 'quetes.html', title: 'Toutes les quêtes', active: 'quetes.html',
        desc: `Les ${QUESTS.length} quêtes du jeu, région par région.`,
        crumbs: [['soluce.html', 'Accueil'], [null, 'Quêtes']],
        body: `<h2>Toutes les quêtes</h2>
<p class="lead">${QUESTS.length} quêtes (${QUESTS.filter(q => !q.side).length} principales et ${QUESTS.filter(q => q.side).length} secondaires), classées par région dans l’ordre où on les débloque.</p>
<div class="box info"><b class="t">Lire une fiche</b>Chaque fiche donne les prérequis, qui la donne et où, les objectifs avec leur position approximative dans l’écran (nord, sud, ouest, est), l’itinéraire depuis le village, la faiblesse des ennemis à abattre et la récompense.</div>
<div class="grid">${cards}</div>`
    }));
    for (const r of regionsWithQuests) {
        const qs = quetesByRegion(r);
        const toc = `<ul>${qs.map(q => `<li><a href="#${questAnchor(q.id)}">${esc(q.title)}</a>${q.side ? '' : ' <span class="badge main">Principale</span>'}</li>`).join('')}</ul>`;
        write(regionSlug(r), page({
            file: regionSlug(r), title: `Quêtes — ${regionName(r)}`, active: 'quetes.html',
            desc: `Soluce des quêtes de la région ${regionName(r)}.`,
            crumbs: [['soluce.html', 'Accueil'], ['quetes.html', 'Quêtes'], [null, regionName(r)]],
            body: `<h2>${esc(regionName(r))}</h2>
<p class="lead">Région débloquée au niveau ${REGION_UNLOCK_LEVEL[r]}. ${qs.length} ${plural(qs.length, 'quête', 'quêtes')}.</p>
<div class="box"><b class="t">Sommaire</b>${toc}</div>
${qs.map(questHtml).join('\n')}`
        }));
    }
}

function buildCompanions() {
    const cards = COMPANIONS.map(c => `<a class="card" href="compagnon-${c.id}.html"><b>${esc(c.name)}</b><span>${esc(c.title)}<br>${esc(COMPANION_POWERS[c.id]?.name || '')}</span></a>`).join('');
    const rows = COMPANIONS.map(c => {
        const q = questById[c.joinWhen];
        const p = COMPANION_POWERS[c.id];
        return `<tr><td><a href="compagnon-${c.id}.html">${esc(c.name)}</a></td><td>${esc(regionName(q?._region))}</td><td>${q ? `<a href="${regionSlug(q._region)}#${questAnchor(q.id)}">${esc(q.title)}</a>` : '—'}</td><td>${esc(p?.name)} — ${esc(p?.text)}</td></tr>`;
    }).join('');
    write('compagnons.html', page({
        file: 'compagnons.html', title: 'Compagnons', active: 'compagnons.html',
        desc: 'Comment recruter chaque compagnon et ce que fait son pouvoir.',
        crumbs: [['soluce.html', 'Accueil'], [null, 'Compagnons']],
        body: `<h2>Les ${COMPANIONS.length} compagnons</h2>
<p class="lead">Chaque compagnon rejoint le groupe à la fin d’une quête secondaire et déclenche un pouvoir en fin de tour du joueur (un seul pouvoir par compagnon et par tour).</p>
<div class="grid">${cards}</div>
<div class="scroll"><table><tr><th>Compagnon</th><th>Région</th><th>Quête</th><th>Pouvoir</th></tr>${rows}</table></div>
<div class="box tip"><b class="t">Conseil</b>Tous les compagnons sont facultatifs mais leurs pouvoirs se cumulent. Recruter Xiao Gui (région 1) dès le début donne un coup supplémentaire sur le plateau une fois sur trois environ : c’est le plus rentable à court terme.</div>`
    }));
    for (const c of COMPANIONS) {
        const q = questById[c.joinWhen];
        const p = COMPANION_POWERS[c.id];
        const reqQ = q && asArray(q.requires).map(reqText);
        write(`compagnon-${c.id}.html`, page({
            file: `compagnon-${c.id}.html`, title: `Compagnon : ${c.name}`, active: 'compagnons.html',
            desc: `Comment recruter ${c.name} et son pouvoir.`,
            crumbs: [['soluce.html', 'Accueil'], ['compagnons.html', 'Compagnons'], [null, c.name]],
            body: `<h2>${esc(c.name)} <small>— ${esc(c.title)}</small></h2>
<div class="box info"><b class="t">Pouvoir : ${esc(p?.name)}</b>${esc(p?.text)}</div>
<h3>Comment le recruter</h3>
<dl>
<dt>Région</dt><dd>${esc(regionName(q?._region))} (niveau ${REGION_UNLOCK_LEVEL[q?._region]})</dd>
<dt>Quête</dt><dd>${q ? `<a href="${regionSlug(q._region)}#${questAnchor(q.id)}">${esc(q.title)}</a>` : esc(c.joinWhen)}</dd>
<dt>Prérequis</dt><dd>${reqQ?.length ? reqQ.map(x => x.html).join(', ') : 'Aucun.'}</dd>
</dl>
${q ? questHtml(q) : ''}`
        }));
    }
}

const SOURCE_TEXT = s => {
    if (s.armor) return 'Récompense d’une énigme à plateau (voir la page Énigmes et armures antiques).';
    if (s.quest) return 'Récompense unique de quête : jamais en boutique ni en butin.';
    const buy = `Boutiques des marchands (à partir du niveau ${Math.max(1, s.minLevel - 4)})`;
    const drops = Object.entries(CHEST_STUFF_DROP).filter(([, d]) => d.rarity[s.rarity]).map(([t]) => t);
    const chest = drops.length ? `coffres de palier ${drops.join(', ')}` : '';
    const victory = s.rarity === 'common' || s.rarity === 'uncommon' ? 'victoires ordinaires (6 %)' : s.rarity === 'rare' || s.rarity === 'legendary' ? 'victoire contre un ennemi de niveau supérieur (rare ou légendaire garanti)' : '';
    return [buy, chest, victory].filter(Boolean).join(' ; ');
};

function buildStuff() {
    const collars = allStuff.filter(s => s.quest);
    const rowOf = s => `<tr><td><a href="stuff-${s.id}.html">${esc(s.name)}</a>${s.quest ? ' <span class="badge stuff">Quête</span>' : ''}</td><td>${esc(STUFF_SLOT_LABELS[s.slot])}</td><td>${esc(RARITY_FR[s.rarity])}</td><td>${s.minLevel}</td><td>${esc(describeStuff(s))}</td></tr>`;
    const bySlot = STUFF_SLOTS.map(slot => `<h3>${esc(STUFF_SLOT_LABELS[slot])}s</h3><div class="scroll"><table><tr><th>Nom</th><th>Pièce</th><th>Rareté</th><th>Niv.</th><th>Effets</th></tr>${allStuff.filter(s => s.slot === slot).map(rowOf).join('')}</table></div>`).join('');
    const collarCards = collars.map(c => {
        const q = QUESTS.find(x => x.reward?.stuff === c.id);
        return `<a class="card" href="stuff-${c.id}.html"><b>${esc(c.name)}</b><span>${esc(q ? regionName(q._region) : '')} · niveau ${c.minLevel}<br>${esc(c.stealth ? 'Indétectable' : BIOME_PROTECTION_TEXT[c.biomeProtect] || '')}</span></a>`;
    }).join('');
    write('stuff.html', page({
        file: 'stuff.html', title: 'Stuff d’exception', active: 'stuff.html',
        desc: 'Colliers de biome, bagues, bracelets et casques : où les trouver et ce qu’ils font.',
        crumbs: [['soluce.html', 'Accueil'], [null, 'Stuff d’exception']],
        body: `<h2>Stuff d’exception</h2>
<p class="lead">Le stuff se porte dans l’onglet « Stuff » : un casque, un collier, un bracelet et une bague, avec bonus d’attaque, de défense, de PV max ou de résistance au poison.</p>
<h3>Les ${collars.length} colliers de quête (introuvables ailleurs)</h3>
<p>Chaque biome hostile du combat a son collier. Le gagner demande d’aller chercher une relique cachée dans la zone sauvage de la région <em>puis</em> de vaincre le mini-boss qui la garde.</p>
<div class="grid">${collarCards}</div>
<div class="box tip"><b class="t">Conseil</b>Un collier de biome ne se porte pas en même temps qu’un autre collier (un seul emplacement). Équipez celui du biome où vous combattez : volcan, bambous, neige ou mer.</div>
<h3>Catalogue complet</h3>${bySlot}
<div class="box info"><b class="t">Butin</b>Les pièces hors quête s’achètent aux marchands, tombent des coffres (palier 1 à 4) ou en butin de victoire. Contre un ennemi de niveau supérieur au vôtre, un stuff rare ou légendaire est garanti.</div>`
    }));
    for (const s of allStuff) {
        const q = QUESTS.find(x => x.reward?.stuff === s.id);
        const mc = q ? questHtml(q) : '';
        const bio = s.biomeProtect ? `<div class="box info"><b class="t">Protection de biome : ${esc(BIOME_PROTECTION_LABEL[s.biomeProtect])}</b>${esc(BIOME_PROTECTION_TEXT[s.biomeProtect])}.</div>` : '';
        const stealth = s.stealth ? '<div class="box info"><b class="t">Indétectabilité</b>Les ennemis ne détectent plus le héros pendant l’exploration.</div>' : '';
        const mine = allStuff.filter(o => o.slot === s.slot && o.id !== s.id);
        write(`stuff-${s.id}.html`, page({
            file: `stuff-${s.id}.html`, title: s.name, active: 'stuff.html',
            desc: `${s.name} : ${describeStuff(s)}`,
            crumbs: [['soluce.html', 'Accueil'], ['stuff.html', 'Stuff d’exception'], [null, s.name]],
            body: `<h2>${esc(s.name)} <small>— ${esc(STUFF_SLOT_LABELS[s.slot])}${s.quest ? ' d’exception' : ''}</small></h2>
<p class="lead">${esc(s.description)}</p>
<dl><dt>Rareté</dt><dd>${esc(RARITY_FR[s.rarity])}</dd><dt>Niveau conseillé</dt><dd>${s.minLevel}</dd><dt>Effets</dt><dd>${esc(describeStuff(s))}</dd><dt>Prix de base</dt><dd>${s.quest ? 'Non vendable' : `${baseStuffPrice(s)} pièces d’or (prix de revente environ la moitié)`}</dd><dt>Où l’obtenir</dt><dd>${esc(SOURCE_TEXT(s))}</dd></dl>
${bio}${stealth}
${q ? `<h3>Obtention pas à pas</h3>${mc}` : ''}
<h3>Autres ${esc(STUFF_SLOT_LABELS[s.slot].toLowerCase())}s</h3>
<ul>${mine.map(o => `<li><a href="stuff-${o.id}.html">${esc(o.name)}</a> — ${esc(describeStuff(o))}</li>`).join('')}</ul>`
        }));
    }
}

// ── Énigmes à plateau et armures antiques ──
// Les quatre énigmes d'une famille montent en difficulté (le rang dans la famille = le palier).
const TIERS = ['facile', 'moyen', 'difficile', 'très difficile'];
const FAMILY_TEXT = {
    jarres: { type: 'Jarres à pousser', how: 'Vous êtes le petit personnage bleu. Poussez chaque jarre (caisse jaune) sur un socle rouge : une seule jarre à la fois, jamais de traction. Une jarre contre un mur ne glisse plus que le long de celui-ci.' },
    lumiere: { type: 'Miroirs et lumière', how: 'Une lanterne émet un rayon. Touchez un miroir pour le basculer entre « / » et « \\ » ; le prisme triangulaire laisse passer le rayon et en renvoie un second sur le côté (le prisme carré, lui, en fait trois : tout droit et de chaque côté). Tous les cristaux doivent s’allumer.' },
    charrette: { type: 'Charrettes (Rush Hour)', how: 'Faites sortir la charrette rouge par l’ouverture verte, à droite. Chaque bloc ne glisse que dans le sens de sa longueur : touchez-le pour le choisir, puis une case libre dans son axe (ou les flèches).' }
};

/** Plateau de départ en SVG, avec les numéros de colonnes (haut) et de lignes (gauche) cités par la solution. */
function boardSvg(def) {
    const mode = getMode(def.mode), st = mode.init(def.level), { w, h } = mode.size(st);
    const labels = [...Array(w)].map((_, i) => `<text x="${i + 0.5}" y="-0.15" text-anchor="middle">${i + 1}</text>`).join('') + [...Array(h)].map((_, i) => `<text x="-0.25" y="${i + 0.68}" text-anchor="middle">${i + 1}</text>`).join('');
    return `<svg class="board" viewBox="-0.6 -0.6 ${w + 0.6} ${h + 0.6}" role="img" aria-label="Plateau de départ"><style>text{font:0.42px system-ui,sans-serif;fill:#7a6a4a}</style>${labels}${mode.render(st)}</svg>`;
}

/** Solution minimale en texte : un coup par étape, avec la même phrase que le lecteur animé (`mode.say`). */
function solutionSteps(def) {
    const mode = getMode(def.mode), path = solvePath(def);
    return path ? path.slice(1).map((s, i) => mode.say(path[i], s)) : [];
}

/**
 * Lecteur de solution : plateau animé, Début / Précédent / Lecture-Pause / Suivant, vitesse, et liste des étapes cliquable. Les boutons sont
 * masqués (`hidden`) tant que le script de la page ne les a pas activés : sans JavaScript, il reste le plateau de départ et la liste des étapes.
 */
const playerHtml = (def, steps) => `<div class="pl" data-puzzle="${def.id}">
${boardSvg(def)}
<div class="pl-bar" hidden>
<button type="button" data-act="start">Début</button>
<button type="button" data-act="prev">Précédent</button>
<button type="button" data-act="play" class="pl-play">Lecture</button>
<button type="button" data-act="next">Suivant</button>
<label>Vitesse <select class="pl-speed" aria-label="Vitesse de lecture"><option value="1500">Lente</option><option value="800" selected>Normale</option><option value="300">Rapide</option></select></label>
</div>
<div class="pl-status" role="status" aria-live="polite">Départ : appuyez sur Lecture, ou avancez coup par coup avec Suivant.</div>
<details><summary>Liste des étapes (${steps.length})</summary><ol class="steps">${steps.map((t, i) => `<li data-step="${i + 1}">${esc(t)}</li>`).join('')}</ol></details>
</div>`;

// Code du lecteur : moteur, dessins, modes et niveaux du jeu (modules sans import ni export) puis tools/soluce-player.js.
const stripModule = s => s.replace(/^[ \t]*import [^;]*;[ \t]*$/gm, '').replace(/^export \{[^}]*\};\s*$/gm, '').replace(/^export (const|function|let|class)/gm, '$1');
const playerScript = () => `<script type="module">\n${['engine', 'sprites', 'art', 'modes', 'levels'].map(f => stripModule(readFileSync(join(ROOT, 'puzzle', `${f}.js`), 'utf8'))).join('\n')}\n${readFileSync(join(ROOT, 'tools', 'soluce-player.js'), 'utf8')}\n</script>`;

function buildPuzzles() {
    const chestOf = id => Object.values(SCREENS).flatMap(s => (s.chests || []).filter(c => c.puzzle === id).map(c => ({ s, c }))).find(Boolean);
    const rows = [], cards = [];
    for (const fam of Object.keys(PUZZLE_SETS)) {
        const info = FAMILY_TEXT[fam], armor = ANTIQUE_ARMORS[fam];
        const items = puzzlesOfSet(fam).map((id, i) => {
            const def = { id, ...PUZZLES[id] }, found = chestOf(id), piece = armor.pieces[i];
            const steps = solutionSteps(def), total = solvePath(def).length - 1, unit = def.mode === 'push' ? 'pas' : 'coups';
            const region = found ? regionName(found.s.region) : '';
            const where = found ? `${found.s.name} (${esc(region)}) — ${esc(found.c.label || 'coffre')}, ${whereOf({ screen: found.s, ent: found.c })}` : '';
            rows.push(`<tr><td>${esc(def.title)}</td><td>${esc(info.type)}</td><td>${esc(region)}</td><td>${esc(piece.name)}</td><td>${total} ${unit}</td></tr>`);
            return `<h4>${i + 1}. ${esc(def.title)} <small>— ${TIERS[i]}</small></h4>
<dl><dt>Où</dt><dd>${where}</dd><dt>Récompense</dt><dd>${esc(piece.name)} (${esc(STUFF_SLOT_LABELS[piece.slot])}) + l’or du coffre</dd><dt>Minimum</dt><dd>${total} ${unit}</dd></dl>
${playerHtml(def, steps)}`;
        });
        cards.push(`<h3 id="${fam}">${esc(armor.name)}</h3>
<p>${esc(info.how)}</p>
<div class="box info"><b class="t">Pouvoir de l’armure complète (4 pièces portées)</b>${esc(armor.powerText)}.</div>
<table><tr><th>Pièce</th><th>Emplacement</th><th>Obtenue avec</th><th>Bonus seul</th></tr>${armor.pieces.map((p, i) => `<tr><td><a href="stuff-${p.id}.html">${esc(p.name)}</a></td><td>${esc(STUFF_SLOT_LABELS[p.slot])}</td><td>${esc(PUZZLES[puzzlesOfSet(fam)[i]].title)}</td><td>${esc(describeStuff(allStuff.find(s => s.id === p.id)).split(' • ').filter(t => !/^Armure antique/.test(t)).join(' • '))}</td></tr>`).join('')}</table>
${items.join('\n')}`);
    }
    write('enigmes.html', page({
        file: 'enigmes.html', title: 'Énigmes et armures antiques', active: 'enigmes.html',
        desc: 'Les 12 énigmes à plateau, leurs solutions et les 3 armures antiques qu’elles donnent.',
        crumbs: [['soluce.html', 'Accueil'], [null, 'Énigmes et armures']],
        body: `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${spriteDefs()}</defs></svg>
<h2>Énigmes et armures antiques</h2>
<p class="lead">Douze coffres sont verrouillés par une énigme à plateau (4 de chaque type). Chaque énigme résolue offre une pièce d’une armure antique ; portez les 4 pièces d’une même armure pour éveiller son pouvoir.</p>
<div class="box tip"><b class="t">Conseil</b>Quitter une énigme ne coûte rien : le coffre reste verrouillé et l’énigme se recommence quand vous voulez. Les boutons Annuler et Recommencer sont en haut de la fenêtre. Clavier : flèches ou ZQSD, Échap pour quitter.</div>
<div class="scroll"><table><tr><th>Énigme</th><th>Type</th><th>Région</th><th>Pièce</th><th>Minimum</th></tr>${rows.join('')}</table></div>
${cards.join('\n')}
<div class="box warn"><b class="t">Flèches de l’armure des Jarres</b>Le gain par tour vaut 25 % du coût en flèches de l’arme active la plus chère (main droite ou gauche), arrondi, au moins 1.</div>
${playerScript()}`
    }));
}

function buildBases() {
    const rows = ['red', 'blue', 'green', 'yellow', 'purple'].map(c => {
        const weakTo = { red: 'blue', blue: 'green', green: 'yellow', yellow: 'red', purple: 'green' }[c];
        return `<tr><td>${dot(c)}</td><td>${dot(weakTo)}</td></tr>`;
    }).join('');
    const pw = COMPANIONS.map(c => `<tr><td><a href="compagnon-${c.id}.html">${esc(c.name)}</a></td><td>${esc(COMPANION_POWERS[c.id]?.name)}</td><td>${esc(COMPANION_POWERS[c.id]?.text)}</td></tr>`).join('');
    const bio = allStuff.filter(s => s.biomeProtect || s.stealth).map(s => `<tr><td><a href="stuff-${s.id}.html">${esc(s.name)}</a></td><td>${esc(s.biomeProtect ? BIOME_PROTECTION_LABEL[s.biomeProtect] : 'Fusang')}</td><td>${esc(s.stealth ? 'Les ennemis ne vous détectent plus' : BIOME_PROTECTION_TEXT[s.biomeProtect])}</td></tr>`).join('');
    write('bases.html', page({
        file: 'bases.html', title: 'Bases du combat', active: 'bases.html',
        desc: 'Faiblesses élémentaires, pouvoirs des compagnons et protections de biome.',
        crumbs: [['soluce.html', 'Accueil'], [null, 'Bases du combat']],
        body: `<h2>Bases du combat</h2>
<h3>Faiblesses élémentaires</h3>
<p>Les ennemis sont faibles à la couleur de qì qui contre leur élément. Faire des combinaisons de la couleur faible inflige davantage de dégâts. Les éléments forment un cycle : Feu → Eau → Terre → Air → Feu, l’Arcane étant faible à la Terre.</p>
<div class="scroll"><table><tr><th>Ennemi de couleur</th><th>Faible à</th></tr>${rows}</table></div>
<div class="box tip"><b class="t">Astuce</b>Observez l’ennemi sur la carte avant d’engager : le carnet note sa faiblesse. Les fiches de quête de cette soluce l’indiquent déjà pour chaque cible.</div>
<h3>Pouvoirs des compagnons</h3>
<div class="scroll"><table><tr><th>Compagnon</th><th>Pouvoir</th><th>Effet</th></tr>${pw}</table></div>
<h3>Protections de biome</h3>
<div class="scroll"><table><tr><th>Collier</th><th>Biome</th><th>Effet</th></tr>${bio}</table></div>`
    }));
}

function buildParcours() {
    const main = QUESTS.filter(q => !q.side).sort((a, b) => questLevel(a) - questLevel(b) || a.id.localeCompare(b.id));
    // Ordre conseillé = ordre de déblocage des régions des quêtes principales, puis dépendances.
    const sections = main.map(q => {
        const reg = q._region;
        const qs = quetesByRegion(reg).filter(x => x.side);
        const comps = COMPANIONS.filter(c => qs.some(x => x.id === c.joinWhen));
        const collarQ = qs.find(x => x.reward?.stuff);
        const reqs = asArray(q.requires).map(reqText);
        const bossObj = q.objectives.find(o => o.type === 'kill');
        const wardens = Object.values(SCREENS).flatMap(s => (s.enemies || []).filter(e => /_wardens_/.test(e.id) && s.region === reg));
        return `<h2 id="${esc(q.id)}">${esc(q.chapter)}</h2>
<p class="lead">Région : ${esc(regionName(reg))} · niveau ${REGION_UNLOCK_LEVEL[reg]}.</p>
${reqs.length ? `<p>À faire avant : ${reqs.map(x => x.html).join(', ')}.</p>` : ''}
${questHtml(q)}
${bossObj ? `<div class="box warn"><b class="t">Boss</b>${enemyCard(bossObj.target)}</div>` : ''}
${wardens.length ? `<div class="box info"><b class="t">Gardes du sanctuaire</b>Deux gardes protègent le soleil. Les abattre, ou tenter le pourparler quand il est proposé, ouvre le chemin.${enemyCard(wardens[0].id)}</div>` : ''}
<h3>À faire dans la région avant de repartir</h3>
<ul>
<li><a href="${regionSlug(reg)}">${qs.length} ${plural(qs.length, 'quête secondaire', 'quêtes secondaires')}</a></li>
${comps.length ? `<li>Compagnon${comps.length > 1 ? 's' : ''} : ${comps.map(c => `<a href="compagnon-${c.id}.html">${esc(c.name)}</a>`).join(', ')}</li>` : ''}
${collarQ ? `<li>Stuff d’exception : <a href="stuff-${collarQ.reward.stuff}.html">${esc(allStuff.find(s => s.id === collarQ.reward.stuff)?.name)}</a></li>` : ''}
</ul>`;
    }).join('\n');
    const toc = main.map(q => `<li><a href="#${esc(q.id)}">${esc(q.chapter)}</a></li>`).join('');
    write('parcours.html', page({
        file: 'parcours.html', title: 'Parcours principal', active: 'parcours.html',
        desc: 'La route de l’histoire, chapitre par chapitre.',
        crumbs: [['soluce.html', 'Accueil'], [null, 'Parcours principal']],
        body: `<h2>Parcours principal</h2>
<p class="lead">Les ${main.length} quêtes principales dans l’ordre de déblocage des régions (le niveau demandé est celui de la région).</p>
<div class="box"><b class="t">Sommaire</b><ol>${toc}</ol></div>
${sections}`
    }));
}

function buildHub() {
    const total = QUESTS.length;
    const index = [
        ...QUESTS.map(q => ({ t: q.title, k: `${q.chapter} ${q.giver}`, h: `soluce/${regionSlug(q._region)}#${questAnchor(q.id)}`, c: q.side ? 'Quête' : 'Quête principale' })),
        ...COMPANIONS.map(c => ({ t: c.name, k: `${c.title} compagnon`, h: `soluce/compagnon-${c.id}.html`, c: 'Compagnon' })),
        ...Object.entries(PUZZLES).map(([id, p]) => ({ t: p.title, k: `énigme ${p.mode} armure antique`, h: 'soluce/enigmes.html', c: 'Énigme' })),
        ...allStuff.map(s => ({ t: s.name, k: `${s.description} ${STUFF_SLOT_LABELS[s.slot]}`, h: `soluce/stuff-${s.id}.html`, c: 'Stuff' }))
    ];
    write('soluce.html', page({
        file: 'soluce.html', title: 'Accueil', active: 'soluce.html',
        desc: 'Soluce complète : parcours, compagnons, quêtes et stuff d’exception.',
        body: `<h2>Soluce complète de La Légende de Hou Yi</h2>
<p class="lead">Tout ce qu’il faut pour finir le jeu à 100 % : le parcours principal, les ${COMPANIONS.length} compagnons, les ${total} quêtes et le stuff d’exception.</p>
<div class="box warn"><b class="t">Spoilers</b>Cette soluce révèle l’intrigue, les boss et les récompenses.</div>
<input class="search" id="q" type="search" placeholder="Rechercher une quête, un compagnon, un objet…" autocomplete="off" aria-label="Recherche">
<div id="results"></div>
<div class="grid">
<a class="card" href="soluce/parcours.html"><b>Parcours principal</b><span>${QUESTS.filter(q => !q.side).length} chapitres de l’histoire</span></a>
<a class="card" href="soluce/bases.html"><b>Bases du combat</b><span>Éléments, pouvoirs, biomes</span></a>
<a class="card" href="soluce/compagnons.html"><b>Compagnons</b><span>${COMPANIONS.length} recrues et leurs pouvoirs</span></a>
<a class="card" href="soluce/quetes.html"><b>Quêtes</b><span>${total} quêtes par région</span></a>
<a class="card" href="soluce/enigmes.html"><b>Énigmes et armures</b><span>${Object.keys(PUZZLES).length} énigmes, 3 armures antiques</span></a>
<a class="card" href="soluce/stuff.html"><b>Stuff d’exception</b><span>${allStuff.length} pièces dont ${allStuff.filter(s => s.quest).length} colliers de quête</span></a>
</div>
<h3>Par où commencer ?</h3>
<ol class="steps">
<li>Suivez le <a href="soluce/parcours.html">parcours principal</a> région par région.</li>
<li>Dans chaque région, faites les quêtes secondaires avant le soleil : elles rapportent de l’expérience, des compagnons et du stuff.</li>
<li>Faites <a href="soluce/quetes-${REGION_ORDER[0]}.html#${questAnchor('sq_rice_thief')}">le chapardeur des rizières</a> pour recruter <a href="soluce/compagnon-xiao_gui.html">Xiao Gui</a> dès le début.</li>
</ol>
<script>
(function(){
var DATA=${JSON.stringify(index)};
var q=document.getElementById('q'),out=document.getElementById('results');
function norm(s){return s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}
q.addEventListener('input',function(){
  var t=norm(q.value.trim());out.textContent='';
  if(t.length<2)return;
  DATA.filter(function(d){return norm(d.t+' '+d.k).indexOf(t)>=0;}).slice(0,25).forEach(function(d){
    var a=document.createElement('a');a.href=d.h;a.textContent=d.t+' ';
    var s=document.createElement('small');s.textContent='('+d.c+')';a.appendChild(s);out.appendChild(a);
  });
});
})();
</script>`
    }));
}

mkdirSync(IMG, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.html')) rmSync(join(OUT, f));
buildQuests();
buildCompanions();
buildStuff();
buildBases();
buildPuzzles();
buildParcours();
buildHub();
console.log('Soluce générée :', QUESTS.length, 'quêtes,', COMPANIONS.length, 'compagnons,', allStuff.length, 'pièces de stuff');
