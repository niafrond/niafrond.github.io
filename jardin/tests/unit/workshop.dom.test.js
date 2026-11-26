/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import {
  sheetHeights, settleState, nextState, upState, downState, keyboardMetrics, observeKeyboard, createSheet, openStepPicker,
  enterWorkshop, adoptWorkshop, PEEK_PX, SHEET_STATES, COLUMN_MQ,
} from '../../ui/workshop.js';
import { STEPS } from '../../ui/wizard.js';

const ptr = (el, type, y, extra = {}) => el.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, clientY: y, clientX: 10 }), { pointerId: 1 }, extra));

describe('hauteurs et états de la feuille', () => {
  test('trois hauteurs croissantes, repliée fixe, haute ≈ 66 % de la zone', () => {
    const h = sheetHeights(500);
    expect(h.peek).toBe(PEEK_PX);
    expect(h.peek).toBeLessThan(h.half);
    expect(h.half).toBeLessThan(h.full);
    expect(h.full).toBeGreaterThanOrEqual(0.6 * 500);
    expect(h.full).toBeLessThanOrEqual(0.7 * 500);
    const petit = sheetHeights(200);
    expect(petit.half).toBeGreaterThan(petit.peek);
    expect(petit.full).toBeGreaterThan(petit.half);
  });
  test('clavier : la feuille laisse une bande de plan de 72 px', () => {
    const h = sheetHeights(340, { keyboard: true });
    expect(340 - h.full).toBeGreaterThanOrEqual(72);
    expect(h.full).toBeGreaterThan(h.peek);
  });
  test('cycle, haut et bas', () => {
    expect(SHEET_STATES.map(nextState)).toEqual(['half', 'full', 'peek']);
    expect(upState('full')).toBe('full');
    expect(downState('peek')).toBe('peek');
    expect(upState('peek')).toBe('half');
  });
  test('aimantation : état le plus proche, inertie, geste vif', () => {
    const h = sheetHeights(500);
    expect(settleState(h.half + 8, h, 0, 'peek')).toBe('half');
    expect(settleState(h.full - 5, h, 0, 'half')).toBe('full');
    expect(settleState(h.peek + 10, h, 0, 'half')).toBe('peek');
    // lancé vers le haut depuis une hauteur proche de « half »
    expect(settleState(h.half, h, -0.9, 'peek')).toBe('full');
    // lancé vers le bas
    expect(settleState(h.half + 10, h, 0.9, 'full')).toBe('peek');
    // geste vif qui ne bouge presque pas : on change quand même d'état
    expect(settleState(h.half, h, -0.7, 'half')).toBe('full');
  });
});

describe('clavier virtuel', () => {
  test('keyboardMetrics : ouvert si ≥ 120 px masqués, sinon barre d’adresse', () => {
    expect(keyboardMetrics({ innerHeight: 800, vv: { height: 800, offsetTop: 0 } }).open).toBe(false);
    expect(keyboardMetrics({ innerHeight: 800, vv: { height: 740, offsetTop: 0 } }).open).toBe(false);
    const m = keyboardMetrics({ innerHeight: 800, vv: { height: 480, offsetTop: 0 } });
    expect(m).toMatchObject({ open: true, inset: 320, height: 480, top: 0 });
    expect(keyboardMetrics({ innerHeight: 800, vv: { height: 400, offsetTop: 100 } }).inset).toBe(300);
    // fenêtre redimensionnée par le clavier : la hauteur de référence est la plus grande vue
    expect(keyboardMetrics({ innerHeight: 480, vv: { height: 480, offsetTop: 0 }, baseline: 800 }).open).toBe(true);
    expect(keyboardMetrics({ innerHeight: 600, vv: null }).open).toBe(false);
  });
  test('observeKeyboard suit visualViewport', () => {
    const vv = new EventTarget(); vv.height = 800; vv.offsetTop = 0;
    const win = { visualViewport: vv, innerHeight: 800, innerWidth: 400 };
    const seen = [];
    const stop = observeKeyboard((m) => seen.push(m), win);
    expect(seen.at(-1).open).toBe(false);
    vv.height = 450; vv.dispatchEvent(new Event('resize'));
    expect(seen.at(-1)).toMatchObject({ open: true, inset: 350 });
    vv.height = 800; vv.dispatchEvent(new Event('resize'));
    expect(seen.at(-1).open).toBe(false);
    stop();
    vv.height = 300; vv.dispatchEvent(new Event('resize'));
    expect(seen.at(-1).open).toBe(false);
  });
});

describe('createSheet', () => {
  let host;
  beforeEach(() => { host = document.createElement('div'); Object.defineProperty(host, 'clientHeight', { value: 500 }); document.body.append(host); });
  afterEach(() => { document.body.innerHTML = ''; });

  test('rôle, état initial, aria-expanded, hauteur en px', () => {
    const s = createSheet(host, { label: 'Réglages' });
    expect(s.el.getAttribute('role')).toBe('region');
    expect(s.el.getAttribute('aria-label')).toBe('Réglages');
    expect(s.getState()).toBe('peek');
    expect(s.grab.getAttribute('aria-expanded')).toBe('false');
    expect(s.el.style.height).toBe(`${PEEK_PX}px`);
    s.setState('half');
    expect(s.grab.getAttribute('aria-expanded')).toBe('true');
    expect(host.style.getPropertyValue('--ws-sheet-h')).toBe(`${sheetHeights(500).half}px`);
  });
  test('toucher la poignée passe à la hauteur suivante', () => {
    const s = createSheet(host);
    ptr(s.grab, 'pointerdown', 400); ptr(s.grab, 'pointerup', 400);
    expect(s.getState()).toBe('half');
    ptr(s.grab, 'pointerdown', 300); ptr(s.grab, 'pointerup', 300);
    expect(s.getState()).toBe('full');
    ptr(s.grab, 'pointerdown', 300); ptr(s.grab, 'pointerup', 300);
    expect(s.getState()).toBe('peek');
  });
  test('glisser vers le haut puis vers le bas s’aimante sur un état', () => {
    const s = createSheet(host);
    const seen = [];
    s.onState((e) => seen.push(e));
    const h = sheetHeights(500);
    let t = 1000;
    const now = jest.spyOn(Date, 'now').mockImplementation(() => t);
    // glissé lent (le doigt s'arrête 200 ms avant de se lever) : pas d'inertie
    const glisser = (y0, dy) => {
      ptr(s.grab, 'pointerdown', y0);
      t += 100; ptr(s.grab, 'pointermove', y0 + dy / 2);
      t += 100; ptr(s.grab, 'pointermove', y0 + dy);
      t += 200; ptr(s.grab, 'pointerup', y0 + dy);
    };
    glisser(450, -(h.half - h.peek));
    expect(s.getState()).toBe('half');
    glisser(300, -400);
    expect(s.getState()).toBe('full');
    glisser(100, 600);
    expect(s.getState()).toBe('peek');
    expect(seen).toEqual(['half', 'full', 'peek']);
    // lancer vif vers le haut depuis « repliée » : monte d'un cran au moins
    ptr(s.grab, 'pointerdown', 450);
    t += 20; ptr(s.grab, 'pointermove', 440);
    t += 20; ptr(s.grab, 'pointermove', 400);
    t += 20; ptr(s.grab, 'pointerup', 380);
    expect(['half', 'full']).toContain(s.getState());
    now.mockRestore();
  });
  test('clavier sur la poignée : flèches, Début/Fin, Échap replie la feuille', () => {
    const s = createSheet(host);
    const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    key(s.grab, 'ArrowUp'); expect(s.getState()).toBe('half');
    key(s.grab, 'ArrowUp'); expect(s.getState()).toBe('full');
    key(s.grab, 'ArrowDown'); expect(s.getState()).toBe('half');
    key(s.grab, 'End'); expect(s.getState()).toBe('full');
    key(s.grab, 'Home'); expect(s.getState()).toBe('peek');
    s.setState('full');
    key(s.inner, 'Escape');
    expect(s.getState()).toBe('peek');
  });
  test('onglets : un seul volet visible, aria-selected, ouverture de la feuille', () => {
    const a = document.createElement('p'); a.textContent = 'A';
    const b = document.createElement('p'); b.textContent = 'B';
    const s = createSheet(host, { tabs: [{ id: 'x', label: 'X', nodes: [a] }, { id: 'y', label: 'Y', nodes: [b] }] });
    expect(s.pane('x').hidden).toBe(false);
    expect(s.pane('y').hidden).toBe(true);
    s.el.querySelector('[data-tab=y]').click();
    expect(s.pane('x').hidden).toBe(true);
    expect(s.pane('y').hidden).toBe(false);
    expect(s.el.querySelector('[data-tab=y]').getAttribute('aria-selected')).toBe('true');
    expect(s.getState()).toBe('half');
  });
  test('clavier ouvert : la feuille monte (haute) quand le champ actif est dedans', () => {
    const s = createSheet(host);
    const inp = document.createElement('input'); s.inner.append(inp);
    inp.focus();
    // le focus seul ouvre la feuille à mi-hauteur
    expect(s.getState()).toBe('half');
    s.setKeyboard(true);
    expect(s.getState()).toBe('full');
    expect(s.el.style.height).toBe(`${sheetHeights(500, { keyboard: true }).full}px`);
    s.setKeyboard(false);
    expect(s.el.style.height).toBe(`${sheetHeights(500).full}px`);
  });
  test('un champ sous la ligne de flottaison est remonté dans la feuille (pas dans la page)', () => {
    const s = createSheet(host);
    const inp = document.createElement('input'); s.inner.append(inp);
    const rect = (top, bottom) => ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top });
    s.inner.getBoundingClientRect = () => rect(100, 300);
    inp.getBoundingClientRect = () => rect(320, 360);
    s.inner.scrollTop = 0;
    inp.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(s.inner.scrollTop).toBeGreaterThan(0);
  });
});

describe('sélecteur d’étapes', () => {
  afterEach(() => { document.body.innerHTML = ''; });
  test('liste toutes les étapes, étape actuelle marquée, saut libre, Échap ferme', () => {
    const go = jest.fn();
    openStepPicker({ steps: STEPS, current: 5, go });
    const box = document.querySelector('[data-role=step-picker]');
    expect(box.getAttribute('role')).toBe('dialog');
    const items = box.querySelectorAll('[data-step-pick]');
    expect(items).toHaveLength(STEPS.length);
    expect(items[5].getAttribute('aria-current')).toBe('step');
    items[1].click();
    expect(go).toHaveBeenCalledWith('boundary');
    expect(document.querySelector('[data-role=step-picker]')).toBeNull();
    openStepPicker({ steps: STEPS, current: 0, go });
    document.querySelector('.ws-overlay').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[data-role=step-picker]')).toBeNull();
    expect(go).toHaveBeenCalledTimes(1);
  });
  test('l’étape courante ne déclenche pas de navigation', () => {
    const go = jest.fn();
    openStepPicker({ steps: STEPS, current: 2, go });
    document.querySelector('[data-step-pick]:nth-child(3)').click();
    expect(go).not.toHaveBeenCalled();
  });
});

describe('étapes de l’atelier', () => {
  test('dessin et rendu sont des étapes atelier ; les écrans qui défilent non', () => {
    const w = Object.fromEntries(STEPS.map((s) => [s.id, s.workshop]));
    expect(w).toMatchObject({ boundary: true, items: true, zones: true, render: true, sun: 'auto', beds: 'auto' });
    expect(w.context).toBeUndefined();
    expect(w.wished).toBeUndefined();
    expect(w.plants).toBeUndefined();
  });
  test('la condition « colonne » couvre PC, paysage et écran court', () => {
    expect(COLUMN_MQ).toContain('min-width: 900px');
    expect(COLUMN_MQ).toContain('max-height: 560px');
    expect(COLUMN_MQ).toContain('orientation: landscape');
  });
});

describe('enterWorkshop / adoptWorkshop', () => {
  afterEach(() => { document.body.innerHTML = ''; document.documentElement.className = ''; });
  const coque = () => {
    const app = document.createElement('div'); app.className = 'app';
    const header = document.createElement('header'); header.className = 'topbar';
    const stepsEl = document.createElement('ol'); stepsEl.className = 'steps';
    const title = document.createElement('h1'); title.className = 'step-title'; title.textContent = '6/9 · Dessin des zones';
    const body = document.createElement('main'); body.className = 'step-body';
    const footer = document.createElement('footer'); footer.className = 'wizard-nav';
    footer.innerHTML = '<button id="a">← A</button><button id="b">B →</button>';
    app.append(header, stepsEl, title, body, footer);
    document.body.append(app);
    return { app, header, stepsEl, title, body, footer };
  };
  test('activer : classe, menu « ⋯ », titre cliquable ; quitter : tout est remis', () => {
    const p = coque();
    const ws = enterWorkshop(p.app, { ...p, steps: STEPS, current: 5, go: () => {}, garden: { id: 'g', status: 'draft' } });
    expect(p.app.classList.contains('ws-on')).toBe(false);
    ws.set(true);
    expect(p.app.classList.contains('ws-on')).toBe(true);
    expect(document.documentElement.classList.contains('ws-lock')).toBe(true);
    expect(p.header.querySelector('[data-role=ws-menu-btn]')).toBeTruthy();
    expect(p.title.textContent).toBe('6/9 · Dessin des zones');
    expect(p.title.querySelector('[data-role=step-title-btn]')).toBeTruthy();
    // menu
    p.header.querySelector('[data-role=ws-menu-btn]').click();
    expect(p.app.querySelector('[data-role=ws-menu]')).toBeTruthy();
    expect(p.app.querySelector('[data-act=menu-advice]')).toBeNull(); // pas validé
    // plein écran
    p.app.querySelector('[data-act=menu-fullscreen]').click();
    expect(p.app.classList.contains('ws-full')).toBe(true);
    expect(p.app.querySelector('[data-role=ws-exit-full]')).toBeTruthy();
    ws.setFullscreen(false);
    expect(p.app.querySelector('[data-role=ws-exit-full]')).toBeNull();
    ws.set(false);
    expect(p.app.classList.contains('ws-on')).toBe(false);
    expect(document.documentElement.classList.contains('ws-lock')).toBe(false);
    expect(p.header.querySelector('[data-role=ws-menu-btn]')).toBeNull();
    expect(p.title.querySelector('button')).toBeNull();
  });
  test('menu : lien Conseils seulement si le jardin est validé', () => {
    const p = coque();
    const ws = enterWorkshop(p.app, { ...p, steps: STEPS, current: 5, go: () => {}, garden: { id: 'g1', status: 'validated' }, startOn: true });
    p.header.querySelector('[data-role=ws-menu-btn]').click();
    expect(p.app.querySelector('[data-act=menu-advice]').getAttribute('href')).toBe('#/garden/g1/advice');
    ws.leave();
  });
  test('clavier simulé : classe ws-kb, hauteur de l’atelier = visualViewport', () => {
    const vv = new EventTarget(); vv.height = window.innerHeight; vv.offsetTop = 0;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    window.scrollTo = () => {};
    const p = coque();
    const ws = enterWorkshop(p.app, { ...p, steps: STEPS, current: 5, go: () => {}, startOn: true });
    expect(p.app.classList.contains('ws-kb')).toBe(false);
    expect(p.app.style.getPropertyValue('--ws-h')).toBe(`${window.innerHeight}px`);
    vv.height = window.innerHeight - 300; vv.dispatchEvent(new Event('resize'));
    expect(p.app.classList.contains('ws-kb')).toBe(true);
    expect(p.app.style.getPropertyValue('--ws-h')).toBe(`${window.innerHeight - 300}px`);
    vv.height = window.innerHeight; vv.dispatchEvent(new Event('resize'));
    expect(p.app.classList.contains('ws-kb')).toBe(false);
    ws.leave();
    delete window.visualViewport;
  });
  test('adoptWorkshop : sans atelier → null ; avec atelier → barres dans la rangée, panneaux dans la feuille, puis remise en place', () => {
    const p = coque();
    const root = document.createElement('div'); root.className = 'jd jd-editor';
    const bar = document.createElement('div'); bar.className = 'jd-bar';
    const zin = document.createElement('button'); zin.dataset.act = 'zoom-in';
    const undo = document.createElement('button'); undo.dataset.act = 'undo';
    bar.append(undo, zin);
    const wrap = document.createElement('div'); wrap.className = 'jd-canvas-wrap';
    const info = document.createElement('div'); info.className = 'jd-info';
    const panel = document.createElement('div'); panel.hidden = true;
    root.append(bar, wrap, info, panel);
    p.body.append(root);
    expect(adoptWorkshop(root, { wrap })).toBeNull();
    const ws = enterWorkshop(p.app, { ...p, steps: STEPS, current: 5, go: () => {}, startOn: true });
    let sel = false;
    const a = adoptWorkshop(root, {
      wrap, tools: [bar], fab: [zin], summary: info, sheet: [panel],
      want: () => ({ key: String(sel), state: sel ? 'half' : 'peek' }),
    });
    expect(root.querySelector('.ws-tools').contains(bar)).toBe(true);
    expect(root.querySelector('.ws-fab').contains(zin)).toBe(true);
    expect(a.sheet.sum.contains(info)).toBe(true);
    expect(a.sheet.inner.contains(panel)).toBe(true);
    expect(wrap.classList.contains('ws-canvas')).toBe(true);
    expect(a.sheet.getState()).toBe('peek');
    sel = true; a.sync();
    expect(a.sheet.getState()).toBe('half');
    // la feuille ne bouge plus tant que la clé ne change pas (l'utilisateur garde la main)
    a.sheet.setState('full'); a.sync();
    expect(a.sheet.getState()).toBe('full');
    sel = false; a.sync();
    expect(a.sheet.getState()).toBe('peek');
    a.destroy();
    expect(root.contains(bar)).toBe(true);
    expect(bar.contains(zin)).toBe(true);
    expect(root.contains(info)).toBe(true);
    expect(root.contains(panel)).toBe(true);
    expect(root.querySelector('.ws-tools')).toBeNull();
    expect(root.querySelector('.ws-sheet')).toBeNull();
    expect(wrap.classList.contains('ws-canvas')).toBe(false);
    ws.leave();
  });
  test('adoptWorkshop : la barre du bas peut être remplacée puis rendue', () => {
    const p = coque();
    const root = document.createElement('div'); root.className = 'jd';
    const wrap = document.createElement('div'); root.append(wrap); p.body.append(root);
    const ws = enterWorkshop(p.app, { ...p, steps: STEPS, current: 8, go: () => {}, startOn: true });
    const a = adoptWorkshop(root, { wrap });
    const v = document.createElement('button'); v.textContent = 'Valider';
    a.setFooter([v]);
    expect([...p.footer.children]).toEqual([v]);
    const w2 = document.createElement('button'); w2.textContent = 'Conseils';
    a.setFooter([w2]);
    expect([...p.footer.children]).toEqual([w2]);
    a.destroy();
    expect([...p.footer.children].map((b) => b.id)).toEqual(['a', 'b']);
    ws.leave();
  });
});
