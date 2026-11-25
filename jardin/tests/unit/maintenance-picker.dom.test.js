/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { maintenanceChips, gardenMaintenancePicker, zoneMaintenancePicker, maintenanceReminder, effortIndicator, levelPhrase } from '../../ui/maintenance-picker.js';

const click = (n) => n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
beforeEach(() => { document.body.innerHTML = ''; });

test('maintenanceChips : trois pastilles radio, sélection et onPick', () => {
  const onPick = jest.fn();
  const box = maintenanceChips({ value: 'low', onPick });
  document.body.append(box);
  const btns = [...box.querySelectorAll('button')];
  expect(btns.map((b) => b.dataset.maintenance)).toEqual(['green', 'low', 'none']);
  expect(box.querySelector('[aria-checked=true]').dataset.maintenance).toBe('low');
  click(btns[2]);
  expect(onPick).toHaveBeenCalledWith('none');
  expect(box.querySelector('[aria-checked=true]').dataset.maintenance).toBe('none');
});

test('maintenanceChips avec « comme le jardin » : valeur null', () => {
  const onPick = jest.fn();
  const box = maintenanceChips({ value: null, inherit: true, onPick });
  expect(box.querySelectorAll('button')).toHaveLength(4);
  expect(box.querySelector('[aria-checked=true]').dataset.maintenance).toBe('');
  click(box.querySelector('[data-maintenance=none]'));
  click(box.querySelector('[data-maintenance=""]'));
  expect(onPick).toHaveBeenLastCalledWith(null);
});

test('gardenMaintenancePicker : enregistre le niveau du jardin (green par défaut)', () => {
  const g = { context: {} };
  const onChange = jest.fn();
  const el = gardenMaintenancePicker(g, { onChange });
  document.body.append(el);
  expect(el.textContent).toContain('Quel niveau d’entretien ?');
  expect(el.querySelector('[aria-checked=true]').dataset.maintenance).toBe('green');
  click(el.querySelector('[data-maintenance=none]'));
  expect(g.context.maintenance).toBe('none');
  expect(onChange).toHaveBeenCalledWith('none');
});

test('zoneMaintenancePicker : fixe puis retire le niveau de la zone', () => {
  const z = {};
  const el = zoneMaintenancePicker({ context: {} }, z);
  click(el.querySelector('[data-maintenance=low]'));
  expect(z.maintenance).toBe('low');
  click(el.querySelector('[data-maintenance=""]'));
  expect('maintenance' in z).toBe(false);
});

test('maintenanceReminder : texte, bouton « changer » et nouveau niveau', () => {
  let cur = 'low';
  const el = maintenanceReminder({ get: () => cur, set: (id) => { cur = id; } });
  document.body.append(el);
  expect(el.textContent).toContain('Niveau d’entretien : 🌿 peu d’entretien');
  click(el.querySelector('[data-act=maint-change]'));
  expect(el.querySelector('.maint-chips').hidden).toBe(false);
  click(el.querySelector('[data-maintenance=none]'));
  expect(cur).toBe('none');
  expect(el.textContent).toContain('🛋 pas d’entretien');
  expect(el.querySelector('.maint-chips').hidden).toBe(true);
});

test('effortIndicator et levelPhrase', () => {
  const e = effortIndicator(2);
  expect(e.textContent).toBe('🧤×2 Entretien : moyen');
  expect(levelPhrase('low')).toBe('🌿 peu d’entretien');
  expect(levelPhrase('green')).toBe('');
});
