/** @jest-environment jsdom */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { announce, notify, initDialogs } from '../../a11y.js';

beforeEach(() => { document.body.innerHTML = ''; });

describe('annonces pour lecteurs d\'écran', () => {
    test('announce crée une zone role=status masquée et y écrit le texte sans balises', () => {
        expect(announce('<b>Vous infligez 12 dégâts</b>')).toBe(true);
        const el = document.getElementById('sr-status');
        expect(el.getAttribute('role')).toBe('status');
        expect(el.getAttribute('aria-live')).toBe('polite');
        expect(el.classList.contains('visually-hidden')).toBe(true);
        expect(el.textContent).toBe('Vous infligez 12 dégâts');
    });

    test('un même message répété est de nouveau annoncé', () => {
        announce('Soin +5');
        const first = document.getElementById('sr-status').textContent;
        announce('Soin +5');
        expect(document.getElementById('sr-status').textContent).not.toBe(first);
    });

    test('texte vide ignoré', () => {
        expect(announce('  ')).toBe(false);
        expect(notify('')).toBe(false);
    });

    test('notify affiche une bulle visible puis la masque, et annonce le message', () => {
        jest.useFakeTimers();
        notify('Cet onglet est disponible après le combat.', 1000);
        const box = document.getElementById('a11y-toast');
        expect(box.classList.contains('visible')).toBe(true);
        expect(document.getElementById('sr-status').textContent).toContain('après le combat');
        jest.advanceTimersByTime(1100);
        expect(box.classList.contains('visible')).toBe(false);
        jest.useRealTimers();
    });
});

describe('fenêtres modales', () => {
    test('rôle dialog, titre associé, focus à l\'ouverture et retour à la fermeture', async () => {
        document.body.innerHTML = '<button id="opener">Ouvrir</button><div id="m" class="modal"><div class="modal-content"><h2>Titre</h2><button id="a">A</button><div class="modal-actions"><button class="primary" id="ok">OK</button></div></div></div>';
        initDialogs();
        const opener = document.getElementById('opener');
        opener.focus();
        const modal = document.getElementById('m');
        modal.classList.add('active');
        await Promise.resolve();
        expect(modal.getAttribute('role')).toBe('dialog');
        expect(modal.getAttribute('aria-modal')).toBe('true');
        expect(document.getElementById(modal.getAttribute('aria-labelledby')).textContent).toBe('Titre');
        expect(document.activeElement.id).toBe('ok');
        modal.classList.remove('active');
        await Promise.resolve();
        expect(document.activeElement).toBe(opener);
    });
});
