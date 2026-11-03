/** @jest-environment jsdom */
// Fenêtre du mode Chang'e (change/view.js) : parcours complet d'un épisode (transition, village, cinq puzzles, conversation, retour),
// sortie anticipée par le bouton miroir avec confirmation, et absence de toute tuile de dégât dans le DOM.
import { describe, test, expect, beforeEach } from '@jest/globals';
import { openChange } from '../../change/view.js';
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

async function playNpc(n, data) {
    await waitFor(() => q(`[data-npc="${n.id}"]`) && !q('.change-mirror') && !q('.change-puzzle'), `village ${n.id}`);
    click(q(`[data-npc="${n.id}"]`));
    await waitFor(() => q('.change-puzzle .change-board'), `puzzle ${n.id}`);
    for (let guard = 0; guard < 500 && !q('.change-result.win'); guard++) {
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
    expect(q('.change-result.win')).toBeTruthy();
    expect(data.healed).toContain(n.id);
    click(q('.change-result [data-act="continue"]'));
    await sleep(60);
}

describe('fenêtre du mode Chang\'e', () => {
    test.each(EPISODES.map(e => [e.id]))('épisode %i : transition, cinq soins, conversation finale, retour', async id => {
        const ep = EPISODES.find(e => e.id === id), data = defaultChangeData();
        let finished = null;
        openChange(document.body, { episode: id, data, save: () => {}, onFinish: r => { finished = r; } });
        expect(data.pending).toBe(id);
        await waitFor(() => q('.change-mirror'), 'transition d\'entrée');
        click(q('.change-mirror'));
        await waitFor(() => !q('.change-mirror'), 'fin de la transition');
        for (const n of ep.injured) await playNpc(n, data);
        for (let i = 0; i < 12 && !q('.change-mirror'); i++) {
            const nxt = q('[data-next]'); if (nxt) click(nxt);
            const f = q('.change-finale button'); if (f) click(f);
            await sleep(60);
        }
        await waitFor(() => q('.change-mirror'), 'transition de retour');
        click(q('.change-mirror'));
        await waitFor(() => finished, 'fermeture');
        expect(finished).toEqual({ completed: true });
        expect(data.done).toContain(id);
        expect(data.pending).toBeNull();
        expect(q('.change-overlay')).toBeNull();
    }, 60000);

    test('le bouton miroir demande confirmation, garde les soins et laisse l\'épisode en cours', async () => {
        const data = defaultChangeData();
        let finished = null;
        openChange(document.body, { episode: 1, data, save: () => {}, onFinish: r => { finished = r; } });
        await waitFor(() => q('.change-mirror'), 'entrée'); click(q('.change-mirror'));
        await waitFor(() => !q('.change-mirror'), 'fin de la transition d\'entrée');
        await waitFor(() => q('[data-act="mirror"]'), 'bouton miroir');
        click(q('[data-act="mirror"]'));
        click(await waitFor(() => q('.change-confirm [data-no]'), 'confirmation'));
        await sleep(30);
        expect(q('.change-overlay')).toBeTruthy();   // « Rester »
        expect(finished).toBeNull();
        click(q('[data-act="mirror"]'));
        click(await waitFor(() => q('.change-confirm [data-yes]'), 'confirmation 2'));
        await waitFor(() => q('.change-mirror'), 'transition de sortie'); click(q('.change-mirror'));
        await waitFor(() => finished, 'sortie');
        expect(finished).toEqual({ completed: false });
        expect(data.pending).toBe(1);
        expect(data.done).toEqual([]);
    });

    test('le Livre des noms liste les habitants soignés', async () => {
        const data = defaultChangeData();
        data.healed.push('farmer_lin');
        openChange(document.body, { episode: 1, data, save: () => {}, onFinish: () => {} });
        await waitFor(() => q('.change-mirror'), 'entrée'); click(q('.change-mirror'));
        await waitFor(() => !q('.change-mirror'), 'fin de la transition d\'entrée');
        await waitFor(() => q('[data-act="book"]'), 'bouton livre');
        click(q('[data-act="book"]'));
        const book = await waitFor(() => q('.change-book'), 'livre');
        expect(book.textContent).toContain('Lin');
        expect(book.textContent).toContain('Haricot rouge');
    });
});
