/** @jest-environment jsdom */
// Sélecteur d'ambiance : pastilles, nom suggéré, fenêtre d'une zone ou du jardin entier (zone par zone).
import { createGarden, createZone } from '../../model.js';
import { mountPlants } from '../../ui/step-plants.js';
import { AMBIANCES } from '../../ambiances.js';
import { ambianceChips, openAmbiancePicker, nameWithAmbiance, zoneAmbiance } from '../../ui/ambiance-picker.js';

const rect = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
const zone = (type, label, ambiance) => { const z = createZone(type, rect(0, 0, 4, 3)); z.label = label; if (ambiance) z.ambiance = ambiance; return z; };
const click = (n) => n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
beforeEach(() => { document.body.innerHTML = ''; });

describe('nameWithAmbiance', () => {
  test('ajoute le mot d’ambiance, le remplace, le retire', () => {
    expect(nameWithAmbiance('Terrasse', 'bucolique')).toBe('Terrasse — bucolique');
    expect(nameWithAmbiance('Terrasse — bucolique', 'zen')).toBe('Terrasse — zen');
    expect(nameWithAmbiance('Terrasse — bucolique', null)).toBe('Terrasse');
    expect(nameWithAmbiance('Massif bucolique devant la terrasse', 'bucolique')).toBe('Massif bucolique devant la terrasse');
    expect(nameWithAmbiance('Massif bucolique', null)).toBe('Massif');
    expect(nameWithAmbiance('', 'zen')).toBe('zen');
  });
  test('zoneAmbiance : enregistrée, sinon détectée dans le nom', () => {
    expect(zoneAmbiance(zone('lawn', 'Coin zen'))).toBe('zen');
    expect(zoneAmbiance(zone('lawn', 'Coin zen', 'colore'))).toBe('colore');
    expect(zoneAmbiance(zone('lawn', 'Pelouse'))).toBeNull();
  });
});

describe('ambianceChips', () => {
  test('radiogroupe : une valeur, « Aucune », mise à jour de aria-checked', () => {
    const picks = [];
    const box = ambianceChips({ value: 'zen', onPick: (id) => picks.push(id) });
    document.body.append(box);
    expect(box.getAttribute('role')).toBe('radiogroup');
    const chips = [...box.querySelectorAll('[role=radio]')];
    expect(chips).toHaveLength(AMBIANCES.length + 1);
    expect(box.querySelector('[data-ambiance=zen]').getAttribute('aria-checked')).toBe('true');
    click(box.querySelector('[data-ambiance=bucolique]'));
    expect(picks).toEqual(['bucolique']);
    expect(box.querySelector('[data-ambiance=bucolique]').getAttribute('aria-checked')).toBe('true');
    expect(box.querySelector('[data-ambiance=zen]').getAttribute('aria-checked')).toBe('false');
    click(box.querySelector('[data-ambiance=""]'));
    expect(picks).toEqual(['bucolique', null]);
  });
  test('mode action : pas de rôle radio, un toucher déclenche onPick', () => {
    const picks = [];
    const box = ambianceChips({ mode: 'action', onPick: (id) => picks.push(id) });
    expect(box.querySelectorAll('[role=radio]')).toHaveLength(0);
    expect(box.querySelector('[data-ambiance=""]')).toBeNull();
    click(box.querySelector('[data-ambiance=zen]'));
    expect(picks).toEqual(['zen']);
  });
});

describe('openAmbiancePicker : une zone', () => {
  test('titre, valeur par défaut = ambiance de la zone, validation', () => {
    const z = zone('midplants', 'Massif', 'romantique');
    let res = null;
    const p = openAmbiancePicker(document.body, { zones: [z], onConfirm: (m) => { res = m; } });
    const dlg = document.querySelector('[role=dialog]');
    expect(dlg.textContent).toContain('Quelle ambiance pour cette zone ?');
    expect(dlg.textContent).toContain('Massif');
    expect(dlg.querySelector('[data-ambiance=romantique]').getAttribute('aria-checked')).toBe('true');
    expect(dlg.textContent).toContain('Peu importe');
    click(dlg.querySelector('[data-ambiance=gourmand]'));
    click(dlg.querySelector('[data-act=amb-ok]'));
    expect(res).toEqual({ [z.id]: 'gourmand' });
    expect(document.querySelector('[data-role=ambiance-picker]')).toBeNull();
    expect(p.el.isConnected).toBe(false);
  });
  test('défaut détecté dans le nom ; « Peu importe » donne null ; annuler appelle onCancel', () => {
    const z = zone('lawn', 'Coin zen');
    let res = 'x'; let cancelled = 0;
    openAmbiancePicker(document.body, { zones: [z], onConfirm: (m) => { res = m; }, onCancel: () => { cancelled++; } });
    expect(document.querySelector('[data-ambiance=zen]').getAttribute('aria-checked')).toBe('true');
    click(document.querySelector('[data-ambiance=""]'));
    click(document.querySelector('[data-act=amb-ok]'));
    expect(res).toEqual({ [z.id]: null });
    openAmbiancePicker(document.body, { zones: [z], onConfirm: () => {}, onCancel: () => { cancelled++; } });
    click(document.querySelector('[data-act=amb-cancel]'));
    openAmbiancePicker(document.body, { zones: [z], onConfirm: () => {}, onCancel: () => { cancelled++; } });
    document.querySelector('[data-role=ambiance-picker]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cancelled).toBe(2);
    expect(document.querySelector('[data-role=ambiance-picker]')).toBeNull();
  });
  test('`defaults` l’emporte sur l’ambiance de la zone', () => {
    const z = zone('lawn', 'Pelouse', 'zen');
    openAmbiancePicker(document.body, { zones: [z], defaults: { [z.id]: 'colore' }, onConfirm: () => {} });
    expect(document.querySelector('[data-ambiance=colore]').getAttribute('aria-checked')).toBe('true');
  });
});

describe('openAmbiancePicker : jardin entier, zone par zone', () => {
  test('une ligne par zone, « Même ambiance pour toutes », valider', () => {
    const a = zone('midplants', 'Massif', 'bucolique'); const b = zone('lawn', 'Pelouse'); const c = zone('vegetable', 'Potager gourmand');
    let res = null;
    openAmbiancePicker(document.body, { zones: [a, b, c], onConfirm: (m) => { res = m; } });
    const dlg = document.querySelector('[role=dialog]');
    expect(dlg.textContent).toContain('Quelle ambiance pour chaque zone ?');
    const rows = dlg.querySelectorAll('.amb-row');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Massif');
    expect(rows[0].querySelector('[aria-checked=true]').dataset.ambiance).toBe('bucolique');
    expect(rows[1].querySelector('[aria-checked=true]').dataset.ambiance).toBe('');
    expect(rows[2].querySelector('[aria-checked=true]').dataset.ambiance).toBe('gourmand');
    click(rows[1].querySelector('[data-ambiance=zen]'));
    click(dlg.querySelector('[data-act=same-ambiance]'));
    const same = dlg.querySelector('[data-role=amb-same]');
    expect(same.hidden).toBe(false);
    click(same.querySelector('[data-ambiance=colore]'));
    expect(same.hidden).toBe(true);
    rows.forEach((r) => expect(r.querySelector('[aria-checked=true]').dataset.ambiance).toBe('colore'));
    click(rows[0].querySelector('[data-ambiance=""]'));
    click(dlg.querySelector('[data-act=amb-ok]'));
    expect(res).toEqual({ [a.id]: null, [b.id]: 'colore', [c.id]: 'colore' });
  });
});

describe('étape essences : ambiance de la zone', () => {
  const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  function jardin() {
    const g = createGarden('Test');
    g.context.departement = '75';
    g.boundary = rect(0, 0, 12, 8).points; g.boundaryClosed = true;
    g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    const m = zone('midplants', 'Massif devant la terrasse'); m.shape = rect(0, 0, 6, 4);
    const l = zone('lawn', 'Pelouse'); l.shape = rect(0, 4, 12, 4);
    g.zones = [m, l];
    return g;
  }
  test('« Surprends-moi » demande l’ambiance, l’enregistre, la rappelle dans le résumé ; « Changer l’ambiance » rouvre le sélecteur', async () => {
    const g = jardin();
    const el = document.createElement('div'); document.body.append(el);
    mountPlants(el, { garden: g, onChange() {}, getPhoto: async () => null, IO: null, seed: 4 });
    expect(el.querySelector('[data-role=zone-head]').textContent).toContain('Massif devant la terrasse');
    click(el.querySelector('#btn-surprise')); await wait(5);
    const dlg = document.querySelector('[data-role=ambiance-picker]');
    expect(dlg.textContent).toContain('Quelle ambiance pour cette zone ?');
    expect(dlg.querySelector('[aria-checked=true]').dataset.ambiance).toBe(''); // « Peu importe » par défaut
    click(dlg.querySelector('[data-ambiance=bucolique]'));
    click(dlg.querySelector('[data-act=amb-ok]')); await wait(5);
    expect(g.zones[0].ambiance).toBe('bucolique');
    expect(g.zones[0].plantings.length).toBeGreaterThan(0);
    expect(el.querySelector('#proposal-summary').textContent).toMatch(/^\d+ essences? · ambiance bucolique · floraison de \S+ à \S+ · ≈ \d+ € · espacements respectés$/);
    expect(el.querySelector('[data-role=zone-head-ambiance]').textContent).toContain('bucolique');
    expect(el.querySelector('#btn-surprise').textContent).toBe('🎲 Autre proposition');
    click(el.querySelector('#btn-surprise')); await wait(5); // même ambiance : pas de nouvelle fenêtre
    expect(document.querySelector('[data-role=ambiance-picker]')).toBeNull();
    expect(g.zones[0].ambiance).toBe('bucolique');
    click(el.querySelector('[data-act=change-ambiance]'));
    const d2 = document.querySelector('[data-role=ambiance-picker]');
    expect(d2.querySelector('[aria-checked=true]').dataset.ambiance).toBe('bucolique');
    click(d2.querySelector('[data-ambiance=zen]')); click(d2.querySelector('[data-act=amb-ok]'));
    expect(g.zones[0].ambiance).toBe('zen');
    expect(el.querySelector('[data-role=zone-head-ambiance]').textContent).toContain('zen');
  });
  test('tout le jardin : une seule fenêtre, une ligne par zone, ambiances enregistrées par zone', async () => {
    const g = jardin();
    const el = document.createElement('div'); document.body.append(el);
    mountPlants(el, { garden: g, onChange() {}, getPhoto: async () => null, IO: null, seed: 4 });
    click(el.querySelector('#btn-surprise-all')); await wait(5);
    const dlg = document.querySelector('[data-role=ambiance-picker]');
    const rows = dlg.querySelectorAll('.amb-row');
    expect(rows).toHaveLength(2);
    click(rows[0].querySelector('[data-ambiance=bucolique]'));
    click(rows[1].querySelector('[data-ambiance=gourmand]'));
    click(dlg.querySelector('[data-act=amb-ok]')); await wait(5);
    expect(g.zones.map((z) => z.ambiance)).toEqual(['bucolique', 'gourmand']);
    expect(el.querySelector('#proposal-summary').textContent).toContain('ambiances variées');
  });
  test('annuler la fenêtre ne propose rien', async () => {
    const g = jardin();
    const el = document.createElement('div'); document.body.append(el);
    mountPlants(el, { garden: g, onChange() {}, getPhoto: async () => null, IO: null, seed: 4 });
    click(el.querySelector('#btn-surprise')); await wait(5);
    click(document.querySelector('[data-act=amb-cancel]')); await wait(5);
    expect(g.zones[0].plantings).toEqual([]);
    expect(el.querySelector('#btn-undo').hidden).toBe(true);
  });
});
