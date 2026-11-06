// Fenêtres du mode Chang'e (DOM). Chang'e explore la carte du village comme Hou Yi (explorationView.js) ; ce module fournit ce qui s'ouvre par-dessus :
//   playMirror  : transition par le miroir (reflet circulaire à l'entrée, son inverse au retour) ;
//   openHeal    : puzzle de soin d'un blessé (engine.js), avec son écran de victoire (gâteau offert) ou d'échec doux ;
//   openBook    : Livre des noms (habitants soignés et goût de leur gâteau).
// L'état vit dans `data` (session.data.change, sauvegardé par `save()`) : { done, pending, hp: { <id>: soins obtenus }, healed: [ids], return }.
// Rien ici ne fait de dégâts : voir engine.js (aucun crâne, aucune flèche).
import { icon } from '../icons.js';
import { gbaSprite } from '../sprites/index.js';
import { EPISODES, ENERGY_LABEL } from './data.js';
import { SIZE, GAUGE_MAX, createLevel, playMove, useBreath } from './engine.js';
import { tileSvg } from './art.js';

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const wait = ms => new Promise(r => setTimeout(r, ms));
const GIF = name => new URL(`../sprites/change/${name}`, import.meta.url).href;
const MIRROR_MS = 6600;
const portrait = key => gbaSprite(key, 'front') || '';
const img = (key, cls = '') => `<img class="change-sprite ${cls}" src="${portrait(key)}" alt="" draggable="false">`;

/** Transition par le miroir (`mirror-in.gif` ou `mirror-out.gif`), plein écran, passée d'un toucher. Se résout à la fin. */
export function playMirror(host, name, sfx = () => {}) {
    sfx('change-mirror');
    return new Promise(resolve => {
        const layer = document.createElement('div');
        layer.className = 'change-overlay change-mirror';
        layer.innerHTML = `<img src="${GIF(name)}?t=${Date.now()}" alt="" draggable="false"><span class="change-mirror-skip">Toucher pour passer</span>`;
        host.appendChild(layer);
        let finished = false;
        const end = () => { if (finished) return; finished = true; layer.classList.add('out'); setTimeout(() => { layer.remove(); resolve(); }, 250); };
        layer.addEventListener('click', end);
        layer.querySelector('img').addEventListener('error', () => setTimeout(end, 400));
        setTimeout(end, MIRROR_MS);
    });
}

/** Livre des noms : habitants soignés (tous épisodes) avec le gâteau offert. Se ferme sur « Fermer » ou un toucher du fond. */
export function openBook(host, data) {
    const have = new Set([...data.healed, ...(data.keep?.healed || [])]);   // pendant un rejeu, les noms déjà gagnés restent au Livre
    const rows = EPISODES.flatMap(e => e.injured.filter(n => have.has(n.id)).map(n => ({ ...n, village: e.village })));
    const el = document.createElement('div');
    el.className = 'change-overlay change-confirm';
    el.dataset.scene = 'change-village';
    el.innerHTML = `<div class="change-card"><h3>${icon('scroll')} Livre des noms</h3>${rows.length
        ? `<ul class="change-book">${rows.map(n => `<li>${img(n.id)}<div><b>${esc(n.name)}</b> <small>${esc(n.village)}</small><br>${esc(n.cake[0])}, ${esc(n.cake[1])}</div></li>`).join('')}</ul>`
        : '<p>Aucun nom pour l\'instant. Chaque personne soignée y entre, avec le goût de son gâteau.</p>'}
        <div class="change-foot"><button type="button" class="change-btn" data-no>Fermer</button></div></div>`;
    host.appendChild(el);
    el.addEventListener('click', e => { if (e.target.closest('[data-no]') || e.target === el) el.remove(); });
    return { close: () => el.remove() };
}

/**
 * Puzzle de soin de `npc` (entrée de EPISODES[].injured). `onClose({ won })` est appelé une fois à la fermeture : `won` vaut true si le blessé est
 * soigné. Les soins obtenus sont écrits dans `data.hp` à chaque coup, le soin complet dans `data.healed`.
 */
export function openHeal(host, { npc, data, save = () => {}, sfx = () => {}, onClose = () => {} }) {
    const el = document.createElement('div');
    el.className = 'change-overlay change-heal';
    el.dataset.scene = 'change-puzzle';   // choisit la musique (main.js)
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `Soigner ${npc.name}`);
    host.appendChild(el);
    let level = null, selected = -1, busy = false, closed = false;
    const puzzle = document.createElement('div');
    puzzle.className = 'change-puzzle';
    el.appendChild(puzzle);

    const startLevel = () => { level = createLevel({ color: npc.color, need: npc.need, moves: npc.moves, hp: data.hp[npc.id] || 0 }); selected = -1; };
    function render(note = '') {
        const pct = Math.round(100 * level.hp / level.need);
        // Même mise en page que le match de Hou Yi : deux fiches côte à côte (.stats-container), puis le plateau, le journal et les boutons.
        // Seules la zone des stats (soin du blessé, coups, souffle) et la forme des tuiles (SVG ci-dessous) diffèrent.
        puzzle.innerHTML = `<div class="change-card hou">
            <div class="stats-container change-stats-container">
              <div class="change-stat-card player">
                <div class="change-patient">${img(npc.id)}<div><b>${esc(npc.name)}</b><span>${esc(npc.state)}</span></div>
                  <div class="change-want" title="${esc(ENERGY_LABEL[npc.color])}">${tileSvg(npc.color)}<span>${esc(ENERGY_LABEL[npc.color])}</span></div></div>
                <div class="change-meter" role="progressbar" aria-valuemin="0" aria-valuemax="${level.need}" aria-valuenow="${level.hp}"><i style="width:${pct}%"></i><span>Soin ${level.hp} / ${level.need}</span></div>
                <div class="change-stats"><span>Coups : <b>${level.movesLeft}</b></span>
                  <span class="change-gauge" title="Recueillez d'autres énergies pour charger le souffle de l'élixir"><i style="width:${Math.round(100 * level.gauge / GAUGE_MAX)}%"></i></span>
                  <button type="button" class="change-btn" data-act="breath" ${level.gauge >= GAUGE_MAX && !level.over ? '' : 'disabled'}>${icon('star')} Souffle de l'élixir</button></div>
              </div>
            </div>
            <div class="change-board" style="--board-cols:${SIZE}">${level.board.map((t, i) => `<button type="button" class="tile change-tile${i === selected ? ' selected' : ''}" data-i="${i}" data-kind="${t}" aria-label="${esc(ENERGY_LABEL[t] || 'Goutte d\'élixir')}">${tileSvg(t)}</button>`).join('')}</div>
            <div class="change-note" role="status" aria-live="polite">${esc(note)}</div>
            <div class="change-foot"><button type="button" class="change-btn" data-act="retry">Recommencer</button><button type="button" class="change-btn" data-act="close">Retour à la carte</button></div>
          </div>`;
    }

    async function animate(steps) {
        const fast = document.body.classList.contains('fx-low');
        for (const s of steps) {
            const tiles = puzzle.querySelectorAll('.change-tile');
            s.cleared.forEach(c => tiles[c]?.classList.add('clearing'));
            await wait(fast ? 40 : 260);
            const final = level.board;   // les étapes sont des instantanés du plateau
            level.board = s.board;
            render();
            level.board = final;
        }
        render();
    }

    async function afterMove(res, note) {
        if (!res.ok) { sfx('invalid'); render(res.reason === 'nomatch' ? 'Aucun alignement : essayez une autre case.' : ''); return; }
        busy = true;
        sfx(res.gain > 0 ? 'change-match' : 'change-swap');
        data.hp[npc.id] = level.hp;
        save();
        await animate(res.steps);
        render(note || (res.reshuffled ? 'Plateau mélangé : plus de coup possible.' : ''));
        busy = false;
        if (res.over) finishLevel(res.won);
    }

    function finishLevel(won) {
        const card = puzzle.querySelector('.change-card');
        if (won) {
            if (!data.healed.includes(npc.id)) data.healed.push(npc.id);
            data.hp[npc.id] = npc.need;
            save();
            sfx('change-heal');
            setTimeout(() => sfx('change-cake'), 900);
            card.insertAdjacentHTML('beforeend', `<div class="change-result win"><h3>${esc(npc.name)} est soigné${npc.f ? 'e' : ''} !</h3>
                <p class="change-cake">${icon('moon')} Gâteau de lune pour ${esc(npc.name)} : <b>${esc(npc.cake[0])}</b>, ${esc(npc.cake[1])}.</p><p class="change-quote">« ${esc(npc.thanks)} »</p>
                <button type="button" class="change-btn primary" data-act="continue">Continuer</button></div>`);
        } else {
            card.insertAdjacentHTML('beforeend', `<div class="change-result lose"><h3>Plus de coups</h3>
                <p>Rien n'est perdu : les soins obtenus sont conservés (${level.hp} / ${level.need}) et ${esc(npc.name)} vous attend.</p>
                <button type="button" class="change-btn primary" data-act="retry">Réessayer</button><button type="button" class="change-btn" data-act="close">Retour à la carte</button></div>`);
        }
    }

    function close() {
        if (closed) return;
        closed = true;
        el.remove();
        onClose({ won: data.healed.includes(npc.id) });
    }

    el.addEventListener('click', async e => {
        const btn = e.target.closest('[data-act]'), tile = e.target.closest('.change-tile');
        if (tile && level && !busy && !level.over) {
            const i = Number(tile.dataset.i);
            if (selected < 0) { selected = i; render(); return; }
            if (selected === i) { selected = -1; render(); return; }
            const a = selected; selected = -1;
            const res = playMove(level, a, i);
            if (!res.ok && res.reason === 'far') { selected = i; render(); return; }
            await afterMove(res);
            return;
        }
        if (!btn || busy) return;
        const act = btn.dataset.act;
        if (act === 'close' || act === 'continue') { sfx('uiClick'); close(); }
        else if (act === 'retry') { sfx('uiClick'); startLevel(); render('Nouveau plateau : vos soins sont conservés.'); }
        else if (act === 'breath') {
            const res = useBreath(level);
            if (res.ok) { sfx('change-breath'); await afterMove(res, 'Souffle de l\'élixir : des énergies se rassemblent.'); }
        }
    });
    el.addEventListener('keydown', e => { if (e.key === 'Escape' && !busy) close(); });
    el.tabIndex = -1;
    startLevel();
    render();
    el.focus({ preventScroll: true });
    return { close };
}
