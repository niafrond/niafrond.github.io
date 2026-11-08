/** @jest-environment jsdom */
// Fenêtres du mode Chang'e (change/view.js) : puzzle de soin d'un blessé (victoire, échec doux, soins conservés), transition par le miroir, Livre des noms,
// et absence de toute tuile de dégât dans le DOM. L'exploration du village elle-même est testée dans change.test.js (moteur).
import { describe, test, expect, beforeEach } from '@jest/globals';
import { openHeal, playMirror, openBook } from '../../change/view.js';
import { defaultChangeData } from '../../change/state.js';
import { possibleMoves, TILE_KINDS } from '../../change/engine.js';
import { EPISODES } from '../../change/data.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const click = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const q = s => document.body.querySelector(s);
async function waitFor(fn, what, ms = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(25); }
    throw new Error(`délai : ${what}`);
}
const boardFromDom = () => [...document.body.querySelectorAll('.change-tile')].map(t => t.dataset.kind);

beforeEach(() => { document.body.innerHTML = ''; document.body.classList.add('fx-low'); });

async function playUntil(pred) {
    for (let guard = 0; guard < 500 && !pred(); guard++) {
        if (q('.change-result.lose')) { click(q('.change-result [data-act="retry"]')); await sleep(40); continue; }
        const board = boardFromDom();
        if (board.length !== 64) { await sleep(25); continue; }
        board.forEach(k => expect(TILE_KINDS).toContain(k));   // jamais de crâne ni de flèche à l'écran
        const mv = possibleMoves(board);
        if (!mv.length) { await sleep(25); continue; }
        const [a, b] = mv[guard % mv.length];
        click(document.body.querySelectorAll('.change-tile')[a]);
        click(document.body.querySelectorAll('.change-tile')[b]);
        await sleep(80);
        while (q('.change-tile.clearing')) await sleep(15);
        const br = q('[data-act="breath"]');
        if (br && !br.disabled) { click(br); await sleep(100); }
    }
}

describe('puzzle de soin (openHeal)', () => {
    test.each(EPISODES.flatMap(e => e.injured.map(n => [e.id, n.id])))('épisode %i : %s se soigne, le gâteau est offert', async (_ep, id) => {
        const npc = EPISODES.flatMap(e => e.injured).find(n => n.id === id), data = { ...defaultChangeData(), tuto: true };
        let closed = null;
        openHeal(document.body, { npc, data, save: () => {}, onClose: r => { closed = r; } });
        await waitFor(() => q('.change-puzzle .change-board'), 'puzzle');
        expect(q('.change-overlay').dataset.scene).toBe('change-puzzle');   // musique de soin
        await playUntil(() => q('.change-result.win'));
        expect(q('.change-result.win').textContent).toContain(npc.cake[0]);
        expect(data.healed).toContain(id);
        expect(data.hp[id]).toBe(npc.need);
        click(q('[data-act="continue"]'));
        expect(closed).toEqual({ won: true });
        expect(q('.change-overlay')).toBeNull();
    }, 60000);

    test('quitter garde les soins obtenus ; le blessé n\'est pas soigné', async () => {
        const npc = EPISODES[0].injured[0], data = { ...defaultChangeData(), tuto: true };
        let closed = null;
        openHeal(document.body, { npc, data, save: () => {}, onClose: r => { closed = r; } });
        await waitFor(() => q('.change-board'), 'puzzle');
        const mv = possibleMoves(boardFromDom())[0];
        click(document.body.querySelectorAll('.change-tile')[mv[0]]);
        click(document.body.querySelectorAll('.change-tile')[mv[1]]);
        await sleep(120);
        while (q('.change-tile.clearing')) await sleep(15);
        click(q('[data-act="close"]'));
        expect(closed).toEqual({ won: false });
        expect(data.healed).toEqual([]);
        // rouvrir : les soins déjà faits sont repartis du même niveau
        const before = data.hp[npc.id] || 0;
        openHeal(document.body, { npc, data, save: () => {}, onClose: () => {} });
        await waitFor(() => q('.change-board'), 'puzzle 2');
        expect(Number(q('.change-meter').getAttribute('aria-valuenow'))).toBe(before);
    });
});

describe('transition et Livre des noms', () => {
    test('la transition par le miroir se passe d\'un toucher et se retire', async () => {
        let done = false;
        playMirror(document.body, 'mirror-in.gif').then(() => { done = true; });
        const layer = await waitFor(() => q('.change-mirror'), 'transition');
        expect(layer.querySelector('img').getAttribute('src')).toContain('mirror-in.gif');
        click(layer);
        await waitFor(() => done, 'fin');
        expect(q('.change-mirror')).toBeNull();
    });

    test('le Livre des noms liste les habitants soignés avec leur gâteau', () => {
        const data = { ...defaultChangeData(), tuto: true };
        data.healed.push('farmer_lin');
        openBook(document.body, data);
        expect(q('.change-book').textContent).toContain('Lin');
        expect(q('.change-book').textContent).toContain('Haricot rouge');
        click(q('[data-no]'));
        expect(q('.change-confirm')).toBeNull();
    });

    test('le Livre vide explique ce qu\'il contiendra', () => {
        openBook(document.body, defaultChangeData());
        expect(q('.change-confirm').textContent).toContain('Aucun nom');
    });
});

describe('tutoriel du puzzle de soin', () => {
    const npc = EPISODES[0].injured[0];
    test('première ouverture : étape 1 sur un coup, puis soin, coups ; mémorisé et rejouable par « Aide »', async () => {
        const data = defaultChangeData();
        openHeal(document.body, { npc, data });
        expect(q('.change-tuto')).not.toBeNull();
        expect(document.body.querySelectorAll('.change-tile.tuto-hint').length).toBe(2);
        const hints = [...document.body.querySelectorAll('.change-tile')].map((t, i) => t.classList.contains('tuto-hint') ? i : -1).filter(i => i >= 0);
        click(document.body.querySelectorAll('.change-tile')[hints[0]]);
        click(document.body.querySelectorAll('.change-tile')[hints[1]]);
        await waitFor(() => q('.change-tuto b')?.textContent.includes('Soigner'), 'étape 2');
        click(q('[data-act="tuto-next"]'));
        await waitFor(() => q('.change-tuto b')?.textContent.includes('Coups'), 'étape 3');
        expect(data.tuto).toBe(false);
        click(q('[data-act="tuto-next"]'));
        expect(q('.change-tuto')).toBeNull();
        expect(data.tuto).toBe(true);
        click(q('[data-act="help"]'));
        expect(q('.change-tuto')).not.toBeNull();
    }, 30000);
    test('déjà vu : aucune bulle ; « Passer » le mémorise', () => {
        openHeal(document.body, { npc, data: { ...defaultChangeData(), tuto: true } });
        expect(q('.change-tuto')).toBeNull();
        document.body.innerHTML = '';
        const data = defaultChangeData();
        openHeal(document.body, { npc, data });
        click(q('[data-act="tuto-skip"]'));
        expect(data.tuto).toBe(true);
    });
});
