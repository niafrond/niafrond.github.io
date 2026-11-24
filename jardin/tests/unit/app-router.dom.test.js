/** @jest-environment jsdom */
import { parseRoute, gardenHash, STEP_IDS } from '../../ui/wizard.js';

describe('parseRoute', () => {
  test('accueil et réglages', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/')).toEqual({ name: 'home' });
    expect(parseRoute('#/settings')).toEqual({ name: 'settings' });
  });
  test('assistant et conseils', () => {
    expect(parseRoute('#/garden/abc/plants')).toEqual({ name: 'wizard', id: 'abc', step: 'plants' });
    expect(parseRoute('#/garden/abc/zzz')).toEqual({ name: 'wizard', id: 'abc', step: 'context' });
    expect(parseRoute('#/garden/abc/advice')).toEqual({ name: 'advice', id: 'abc' });
    expect(gardenHash('x y', 'sun')).toBe('#/garden/x%20y/sun');
    expect(STEP_IDS).toHaveLength(7);
  });
});

describe('app (accueil → assistant)', () => {
  beforeAll(async () => {
    window.scrollTo = () => {};
    document.body.innerHTML = '<div id="app"></div><div id="toast" hidden></div>';
    await import('../../app.js');
  });
  const wait = (ms = 50) => new Promise((r) => setTimeout(r, ms));

  test('affiche l’accueil puis ouvre l’assistant sur « Nouveau jardin »', async () => {
    await wait();
    expect(window.__jardin.storage).toBeTruthy();
    expect(document.getElementById('btn-new')).not.toBeNull();
    document.getElementById('btn-new').click();
    await wait(300);
    expect(location.hash).toMatch(/^#\/garden\/.+\/context$/);
    expect(document.querySelectorAll('.steps .step')).toHaveLength(7);
    expect(document.querySelector('.step[aria-current="step"]').dataset.step).toBe('context');
    expect(window.__jardin.state.garden.status).toBe('draft');
  });

  test('retour libre entre étapes et autosauvegarde', async () => {
    document.querySelector('.step[data-step="wished"]').click();
    await wait(300);
    expect(location.hash).toMatch(/\/wished$/);
    const cb = document.getElementById('wish-pond');
    expect(cb).not.toBeNull();
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(700);
    const saved = await window.__jardin.storage.getGarden(window.__jardin.state.garden.id);
    expect(saved.wishedZoneTypes).toContain('pond');
  });
});
