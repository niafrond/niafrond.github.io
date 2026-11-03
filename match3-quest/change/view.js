// Fenêtre du mode Chang'e (DOM) : transition par le miroir, village où l'on va de blessé en blessé (cinq au plus), puzzle de soin de chaque blessé,
// conversation finale avec Hou Yi, transition de retour. L'état vit dans `data` (session.data.change, sauvegardé par `save()`) :
//   { done: [épisodes terminés], pending: épisode commencé et inachevé | null, hp: { <id>: soins obtenus }, healed: [ids soignés] }
// Rien ici ne fait de dégâts : voir engine.js (aucun crâne, aucune flèche).
import { icon } from '../icons.js';
import { gbaSprite, gbaWalkSprite } from '../sprites/index.js';
import { episodeById, EPISODES, ENERGY_LABEL } from './data.js';
import { SIZE, GAUGE_MAX, createLevel, playMove, useBreath } from './engine.js';
import { tileSvg } from './art.js';

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const wait = ms => new Promise(r => setTimeout(r, ms));
const GIF = name => new URL(`../sprites/change/${name}`, import.meta.url).href;
const SPOTS = [[16, 66], [36, 76], [58, 64], [78, 76], [50, 52]];   // places des cinq blessés dans la scène (% largeur, % hauteur des pieds)
const HERO_START = [50, 90];
const MIRROR_MS = 6600;

/**
 * Ouvre l'épisode `episode` dans `host`. `heroPortrait` : data URI du portrait de Hou Yi (conversation finale).
 * `onFinish({ completed })` est appelé une fois, à la fermeture : `completed` vaut true si tous les blessés sont soignés (conversation jouée).
 * Renvoie { close }.
 */
export function openChange(host, { episode, data, save = () => {}, heroPortrait = null, sfx = () => {}, onFinish = () => {} }) {
    const ep = episodeById(episode);
    if (!ep) return null;
    data.pending = episode;
    save();
    const el = document.createElement('div');
    el.className = 'change-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `Chang'e à ${ep.village}`);
    el.style.setProperty('--sky-a', ep.sky[0]);
    el.style.setProperty('--sky-b', ep.sky[1]);
    el.style.setProperty('--ground', ep.ground);
    host.appendChild(el);
    let closed = false, busy = false, tick = 0, walkTimer = null, level = null, current = null, selected = -1;
    const healedHere = () => ep.injured.filter(n => data.healed.includes(n.id));
    const portrait = (key, dir = 'front') => gbaSprite(key, dir) || '';
    const img = (key, cls = '') => `<img class="change-sprite ${cls}" src="${portrait(key)}" alt="" draggable="false">`;

    // ── Dialogue (bulle en bas) ────────────────────────────────────────────────────────────────────────────────────────
    function showLines(lines) {
        return new Promise(resolve => {
            let i = 0;
            const box = document.createElement('div');
            box.className = 'change-dialog';
            el.appendChild(box);
            const render = () => {
                const l = lines[i], hou = l.who === 'hou';
                const pic = hou ? (heroPortrait ? `<img class="change-sprite" src="${heroPortrait}" alt="" draggable="false">` : '') : img('change');
                box.innerHTML = `<div class="change-dialog-pic">${pic}</div><div class="change-dialog-body"><div class="change-dialog-name">${hou ? 'Hou Yi' : 'Chang\'e'}</div>
                    <div class="change-dialog-text">${esc(l.text)}</div><button type="button" class="change-btn" data-next>${i === lines.length - 1 ? 'Fermer' : 'Suivant'}</button></div>`;
                box.querySelector('[data-next]').focus({ preventScroll: true });
            };
            box.addEventListener('click', e => {
                if (!e.target.closest('[data-next]') && !e.target.closest('.change-dialog-body')) return;
                sfx('uiClick');
                if (++i >= lines.length) { box.remove(); resolve(); } else render();
            });
            render();
        });
    }

    // ── Transition par le miroir (animation du reflet circulaire) ─────────────────────────────────────────────────────
    function playMirror(name) {
        return new Promise(resolve => {
            const layer = document.createElement('div');
            layer.className = 'change-mirror';
            layer.innerHTML = `<img src="${GIF(name)}?t=${Date.now()}" alt="" draggable="false"><span class="change-mirror-skip">Toucher pour passer</span>`;
            el.appendChild(layer);
            let finished = false;
            const end = () => { if (finished) return; finished = true; layer.classList.add('out'); setTimeout(() => { layer.remove(); resolve(); }, 250); };
            layer.addEventListener('click', end);
            layer.querySelector('img').addEventListener('error', () => setTimeout(end, 400));
            setTimeout(end, MIRROR_MS);
        });
    }

    // ── Village ──────────────────────────────────────────────────────────────────────────────────────────────────────
    const scene = document.createElement('div');
    scene.className = 'change-scene';
    function renderVillage() {
        const done = healedHere().length;
        scene.innerHTML = `<div class="change-top"><div class="change-title">${esc(ep.village)}<small>Soignés ${done} / ${ep.injured.length}</small></div>
            <div class="change-top-actions"><button type="button" class="change-btn" data-act="book">${icon('scroll')} Livre des noms</button>
            <button type="button" class="change-btn change-mirror-btn" data-act="mirror" title="Revenir auprès de Hou Yi">${icon('mirror')} Miroir</button></div></div>
            <div class="change-field"><div class="change-sun"></div>
            ${ep.injured.map((n, k) => {
        const healed = data.healed.includes(n.id), hp = data.hp[n.id] || 0, [x, y] = SPOTS[k];
        return `<button type="button" class="change-npc${healed ? ' healed' : ''}" data-npc="${n.id}" style="left:${x}%;top:${y}%" aria-label="${esc(n.name)} : ${esc(n.state)}">
            ${img(n.id)}<span class="change-npc-name">${esc(n.name)}</span>
            ${healed ? `<span class="change-npc-mark">${icon('check')}</span>` : `<span class="change-npc-bar" title="${hp} / ${n.need}"><i style="width:${Math.round(100 * hp / n.need)}%"></i></span>`}</button>`;
    }).join('')}
            <img class="change-hero change-sprite" src="${portrait('change_jouable')}" alt="Chang'e" style="left:${HERO_START[0]}%;top:${HERO_START[1]}%" draggable="false"></div>
            <div class="change-hint">Touchez un blessé pour le soigner. Aucun ennemi ici : seulement des gens à aider.</div>`;
    }
    const heroEl = () => scene.querySelector('.change-hero');
    function walkTo(x, y) {
        return new Promise(resolve => {
            const h = heroEl(), fx = parseFloat(h.style.left), fy = parseFloat(h.style.top);
            const dir = Math.abs(x - fx) > Math.abs(y - fy) ? (x < fx ? 'left' : 'right') : (y < fy ? 'back' : 'front');
            clearInterval(walkTimer);
            walkTimer = setInterval(() => { tick++; h.src = gbaWalkSprite('change_jouable', dir, tick) || portrait('change_jouable', dir); }, 140);
            h.style.transition = `left ${0.75}s linear, top ${0.75}s linear`;
            h.style.left = `${x}%`; h.style.top = `${y}%`;
            setTimeout(() => { clearInterval(walkTimer); h.src = portrait('change_jouable', 'front'); resolve(); }, document.body.classList.contains('fx-low') ? 50 : 800);
        });
    }

    async function onNpc(id) {
        if (busy || closed) return;
        const n = ep.injured.find(v => v.id === id), k = ep.injured.indexOf(n);
        if (data.healed.includes(id)) { busy = true; await showLines([{ who: 'change', text: `${n.name} : « ${n.thanks} »` }]); busy = false; return; }
        busy = true;
        const [x, y] = SPOTS[k];
        await walkTo(Math.min(92, Math.max(8, x + (x < 50 ? 8 : -8))), Math.min(96, y + 4));
        if (closed) return;
        busy = false;
        openPuzzle(n);
    }

    // ── Puzzle de soin ───────────────────────────────────────────────────────────────────────────────────────────────
    const puzzle = document.createElement('div');
    puzzle.className = 'change-puzzle';
    function startLevel(n) {
        current = n;
        level = createLevel({ color: n.color, need: n.need, moves: n.moves, hp: data.hp[n.id] || 0 });
        selected = -1;
    }
    function openPuzzle(n) {
        startLevel(n);
        el.appendChild(puzzle);
        renderPuzzle();
    }
    function renderPuzzle(note = '') {
        const n = current, pct = Math.round(100 * level.hp / level.need);
        puzzle.innerHTML = `<div class="change-card">
            <div class="change-patient">${img(n.id)}<div><b>${esc(n.name)}</b><span>${esc(n.state)}</span></div>
              <div class="change-want" title="${esc(ENERGY_LABEL[n.color])}">${tileSvg(n.color)}<span>${esc(ENERGY_LABEL[n.color])}</span></div></div>
            <div class="change-meter" role="progressbar" aria-valuemin="0" aria-valuemax="${level.need}" aria-valuenow="${level.hp}"><i style="width:${pct}%"></i><span>Soin ${level.hp} / ${level.need}</span></div>
            <div class="change-stats"><span>Coups : <b>${level.movesLeft}</b></span>
              <span class="change-gauge" title="Recueillez d'autres énergies pour charger le souffle lunaire"><i style="width:${Math.round(100 * level.gauge / GAUGE_MAX)}%"></i></span>
              <button type="button" class="change-btn" data-act="breath" ${level.gauge >= GAUGE_MAX && !level.over ? '' : 'disabled'}>${icon('moon')} Souffle lunaire</button></div>
            <div class="change-board" style="--cols:${SIZE}">${level.board.map((t, i) => `<button type="button" class="change-tile${i === selected ? ' selected' : ''}" data-i="${i}" data-kind="${t}" aria-label="${esc(ENERGY_LABEL[t] || 'Pleine lune')}">${tileSvg(t)}</button>`).join('')}</div>
            <div class="change-note" role="status" aria-live="polite">${esc(note)}</div>
            <div class="change-foot"><button type="button" class="change-btn" data-act="retry">Recommencer</button><button type="button" class="change-btn" data-act="village">Retour au village</button></div>
          </div>`;
    }

    async function animate(steps) {
        const fast = document.body.classList.contains('fx-low');
        for (const s of steps) {
            const tiles = puzzle.querySelectorAll('.change-tile');
            s.cleared.forEach(c => tiles[c]?.classList.add('clearing'));
            await wait(fast ? 40 : 260);
            const prev = level.board;   // plateau final ; on affiche l'étape (les étapes sont des instantanés)
            level.board = s.board;
            renderPuzzle();
            level.board = prev;
        }
        renderPuzzle();
    }

    async function afterMove(res, note) {
        if (!res.ok) { renderPuzzle(res.reason === 'nomatch' ? 'Aucun alignement : essayez une autre case.' : ''); return; }
        busy = true;
        data.hp[current.id] = level.hp;
        save();
        await animate(res.steps);
        renderPuzzle(note || (res.reshuffled ? 'Plateau mélangé : plus de coup possible.' : ''));
        busy = false;
        if (res.over) await finishLevel(res.won);
    }

    async function finishLevel(won) {
        busy = true;
        const n = current;
        if (won) {
            if (!data.healed.includes(n.id)) data.healed.push(n.id);
            data.hp[n.id] = n.need;
            save();
            sfx('victory');
            puzzle.querySelector('.change-card').insertAdjacentHTML('beforeend', `<div class="change-result win"><h3>${esc(n.name)} est soigné${n.f ? 'e' : ''} !</h3>
                <p class="change-cake">${icon('moon')} Gâteau de lune pour ${esc(n.name)} : <b>${esc(n.cake[0])}</b>, ${esc(n.cake[1])}.</p><p class="change-quote">« ${esc(n.thanks)} »</p>
                <button type="button" class="change-btn primary" data-act="continue">Continuer</button></div>`);
        } else {
            puzzle.querySelector('.change-card').insertAdjacentHTML('beforeend', `<div class="change-result lose"><h3>Plus de coups</h3>
                <p>Rien n'est perdu : les soins obtenus sont conservés (${level.hp} / ${level.need}) et ${esc(n.name)} vous attend.</p>
                <button type="button" class="change-btn primary" data-act="retry">Réessayer</button><button type="button" class="change-btn" data-act="village">Retour au village</button></div>`);
        }
        busy = false;
    }

    async function backToVillage() {
        puzzle.remove();
        level = null; selected = -1;
        renderVillage();
        if (ep.injured.every(n => data.healed.includes(n.id))) await conclude();
    }

    async function conclude() {
        if (busy) return;
        busy = true;
        await wait(300);
        await showLines(ep.outro);
        if (ep.finale) {
            const f = document.createElement('div');
            f.className = 'change-finale';
            f.innerHTML = `<p>${esc(ep.finale)}</p><button type="button" class="change-btn primary">Continuer</button>`;
            el.appendChild(f);
            await new Promise(r => f.querySelector('button').addEventListener('click', () => { f.remove(); r(); }));
        }
        await playMirror('mirror-out.gif');
        if (!data.done.includes(ep.id)) data.done.push(ep.id);
        data.pending = null;
        save();
        finish(true);
    }

    function finish(completed) {
        if (closed) return;
        closed = true;
        clearInterval(walkTimer);
        el.remove();
        onFinish({ completed });
    }

    function confirmLeave() {
        if (el.querySelector('.change-confirm')) return;
        const c = document.createElement('div');
        c.className = 'change-confirm';
        c.innerHTML = `<div class="change-card small"><p>Revenir auprès de Hou Yi ?</p><small>Les soins déjà faits sont conservés ; les autres habitants vous attendront.</small>
            <div class="change-foot"><button type="button" class="change-btn primary" data-yes>Oui, revenir</button><button type="button" class="change-btn" data-no>Rester</button></div></div>`;
        el.appendChild(c);
        c.addEventListener('click', async e => {
            if (e.target.closest('[data-no]')) { c.remove(); return; }
            if (!e.target.closest('[data-yes]')) return;
            c.remove(); busy = true;
            puzzle.remove();
            await playMirror('mirror-out.gif');
            save();
            finish(false);
        });
    }

    function showBook() {
        const rows = EPISODES.flatMap(e => e.injured.filter(n => data.healed.includes(n.id)).map(n => ({ ...n, village: e.village })));
        const b = document.createElement('div');
        b.className = 'change-confirm';
        b.innerHTML = `<div class="change-card"><h3>${icon('scroll')} Livre des noms</h3>${rows.length
            ? `<ul class="change-book">${rows.map(n => `<li>${img(n.id)}<div><b>${esc(n.name)}</b> <small>${esc(n.village)}</small><br>${esc(n.cake[0])}, ${esc(n.cake[1])}</div></li>`).join('')}</ul>`
            : '<p>Aucun nom pour l\'instant. Chaque personne soignée y entre, avec le goût de son gâteau.</p>'}
            <div class="change-foot"><button type="button" class="change-btn" data-no>Fermer</button></div></div>`;
        el.appendChild(b);
        b.addEventListener('click', e => { if (e.target.closest('[data-no]') || e.target === b) b.remove(); });
    }

    // ── Commandes ────────────────────────────────────────────────────────────────────────────────────────────────────
    el.addEventListener('click', async e => {
        const btn = e.target.closest('[data-act]'), npc = e.target.closest('[data-npc]'), tile = e.target.closest('.change-tile');
        if (npc && !puzzle.isConnected) { onNpc(npc.dataset.npc); return; }
        if (tile && level && !busy && !level.over) {
            const i = Number(tile.dataset.i);
            if (selected < 0) { selected = i; renderPuzzle(); return; }
            if (selected === i) { selected = -1; renderPuzzle(); return; }
            const a = selected; selected = -1;
            const res = playMove(level, a, i);
            if (!res.ok && res.reason === 'far') { selected = i; renderPuzzle(); return; }
            await afterMove(res);
            return;
        }
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === 'mirror') { sfx('uiClick'); confirmLeave(); }
        else if (act === 'book') { sfx('uiClick'); showBook(); }
        else if (act === 'village' && !busy) { sfx('uiClick'); await backToVillage(); }
        else if (act === 'continue') { sfx('uiClick'); await backToVillage(); }
        else if (act === 'retry' && !busy) { sfx('uiClick'); startLevel(current); renderPuzzle('Nouveau plateau : vos soins sont conservés.'); }
        else if (act === 'breath' && level && !busy) {
            const res = useBreath(level);
            if (res.ok) { sfx('uiClick'); await afterMove(res, 'Souffle lunaire : des énergies se rassemblent.'); }
        }
    });
    el.addEventListener('keydown', e => { if (e.key === 'Escape' && !busy) confirmLeave(); });
    el.tabIndex = -1;

    // ── Départ : transition d'entrée, puis village ────────────────────────────────────────────────────────────────────
    (async () => {
        el.appendChild(scene);
        renderVillage();
        busy = true;
        await playMirror('mirror-in.gif');
        busy = false;
        if (closed) return;
        el.focus({ preventScroll: true });
        if (ep.injured.every(n => data.healed.includes(n.id))) await backToVillage();
    })();

    return { close: () => finish(false) };
}
