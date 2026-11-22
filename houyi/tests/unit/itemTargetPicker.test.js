/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { openTargetPicker, closeTargetPicker, teamMembers, hasLivingAlly } from '../../itemTargetPicker.js';
import { player, gameState } from '../../game.js';

describe('« sur qui ? » : choix du personnage avec sa barre de vie', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        player.hp = 120; player.maxHp = 300; gameState.heroKo = false;
        gameState.allies = {
            monk: { classId: 'monk', name: 'Sun Wukong', hp: 270, maxHp: 270, ko: false },
            sorcerer: { classId: 'sorcerer', name: 'Fuxi', hp: 0, maxHp: 210, ko: true }
        };
    });
    afterEach(() => { closeTargetPicker(); gameState.allies = {}; });

    test('liste Hou Yi puis les compagnons avec PV actuels / max et indique hors de combat', () => {
        expect(teamMembers().map(m => m.classId)).toEqual(['assassin', 'monk', 'sorcerer']);
        expect(hasLivingAlly()).toBe(true);
        openTargetPicker({ title: 'Potion : sur qui ?', blockReason: m => (m.ko ? 'hors de combat' : m.hp >= m.maxHp ? 'en pleine forme' : null), onPick: () => {} });
        const rows = [...document.querySelectorAll('.target-row')];
        expect(rows).toHaveLength(3);
        expect(rows[0].textContent).toContain('120 / 300 PV');
        expect(rows[0].querySelector('.target-hp-fill').style.width).toBe('40%');
        expect(rows[1].disabled).toBe(true);
        expect(rows[2].textContent).toContain('hors de combat');
        expect(rows[2].disabled).toBe(true);
    });

    test('un clic sur un personnage valable ferme la fenêtre et renvoie sa classe ; Échap et Annuler ferment sans rien faire', () => {
        const onPick = jest.fn();
        openTargetPicker({ title: 'x', blockReason: null, onPick });
        document.querySelector('[data-pick="monk"]').click();
        expect(onPick).toHaveBeenCalledWith('monk');
        expect(document.querySelector('.target-picker-overlay')).toBeNull();
        openTargetPicker({ title: 'x', blockReason: null, onPick });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.querySelector('.target-picker-overlay')).toBeNull();
        openTargetPicker({ title: 'x', blockReason: null, onPick });
        document.querySelector('[data-cancel]').click();
        expect(document.querySelector('.target-picker-overlay')).toBeNull();
        expect(onPick).toHaveBeenCalledTimes(1);
    });
});
