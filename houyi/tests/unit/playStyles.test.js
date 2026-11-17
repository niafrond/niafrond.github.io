/** @jest-environment jsdom */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { PLAY_STYLES, PLAY_STYLE_ORDER, getPlayStyle, setPlayStyle, styleDamageDealt, styleDamageTaken, styleSpellCost, styleManaGain } from '../../playStyles.js';
import { getOption, setOption, applyOptions, animationFactor, effectsLevel, OPTION_DEFAULTS } from '../../gameOptions.js';
import { exportSaveToFile } from '../../saveManager.js';

describe('styles de jeu de Hou Yi', () => {
    test('trois styles, style libre par défaut sans effet', () => {
        expect(PLAY_STYLE_ORDER).toEqual(['flamboyant', 'mystic', 'guardian']);
        const hero = {};
        expect(getPlayStyle(hero)).toBeNull();
        expect(styleDamageDealt(hero, 10)).toBe(10);
        expect(styleDamageTaken(hero, 10)).toBe(10);
        expect(styleSpellCost(hero, 8)).toBe(8);
        expect(styleManaGain(hero, 4, 4)).toBe(4);
    });

    test('changer de style ne touche à aucune autre donnée', () => {
        const hero = { level: 12, hp: 80, maxHp: 120, attack: 30, attributes: { strength: 5 }, gold: 99 };
        const before = JSON.stringify(hero);
        PLAY_STYLE_ORDER.forEach(id => expect(setPlayStyle(hero, id)).toBe(true));
        expect(setPlayStyle(hero, 'inconnu')).toBe(false);
        expect(hero.playStyle).toBe('guardian');
        setPlayStyle(hero, null);
        expect(JSON.stringify({ ...hero, playStyle: undefined })).toBe(before);
    });

    test('flamboyant : plus de dégâts, sorts plus chers', () => {
        const h = { playStyle: 'flamboyant' };
        expect(styleDamageDealt(h, 20)).toBe(25);
        expect(styleSpellCost(h, 8)).toBe(10);
        expect(styleDamageTaken(h, 20)).toBe(20);
    });

    test('mystique : qì majoré, sorts moins chers et plus forts, tirs plus faibles', () => {
        const h = { playStyle: 'mystic' };
        expect(styleManaGain(h, 4, 3)).toBe(5);
        expect(styleManaGain(h, 4, 4)).toBe(7);
        expect(styleSpellCost(h, 10)).toBe(8);
        expect(styleSpellCost(h, 1)).toBe(1);
        expect(styleDamageDealt(h, 20, true)).toBe(23);
        expect(styleDamageDealt(h, 20, false)).toBe(18);
    });

    test('gardien : dégâts subis réduits, jamais en dessous de 1', () => {
        const h = { playStyle: 'guardian' };
        expect(styleDamageTaken(h, 20)).toBe(15);
        expect(styleDamageTaken(h, 1)).toBe(1);
        expect(styleDamageDealt(h, 20)).toBe(17);
    });

    test('chaque style a un nom, un résumé et des effets lisibles', () => {
        Object.values(PLAY_STYLES).forEach(s => { expect(s.name).toMatch(/^Archer /); expect(s.summary.length).toBeGreaterThan(10); expect(s.effects.length).toBeGreaterThan(0); });
    });

    test('le style est conservé dans l\'export de sauvegarde', async () => {
        const res = exportSaveToFile({ name: 'Hou Yi', level: 3, playStyle: 'mystic', attributes: {} }, '1.0.0');
        expect(res.success).toBe(true);
        expect(JSON.parse(await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsText(res.blob); })).player.playStyle).toBe('mystic');
    });
});

describe('options d\'accessibilité', () => {
    beforeEach(() => { Object.entries(OPTION_DEFAULTS).forEach(([k, v]) => setOption(k, v)); window.matchMedia = () => ({ matches: false }); });

    test('taille du texte : valeurs validées et classes du body', () => {
        expect(setOption('textSize', 'enorme')).toBe(false);
        setOption('textSize', 'large'); expect(document.body.classList.contains('text-large')).toBe(true);
        setOption('textSize', 'xlarge'); expect(document.body.classList.contains('text-xlarge')).toBe(true);
        expect(document.body.classList.contains('text-large')).toBe(false);
        setOption('textSize', 'normal'); expect(document.body.classList.contains('text-xlarge')).toBe(false);
    });

    test('symboles, animations et effets réduits', () => {
        setOption('shapes', true); expect(document.body.classList.contains('a11y-shapes')).toBe(true);
        setOption('animations', false); expect(document.body.classList.contains('no-anim')).toBe(true);
        expect(animationFactor()).toBeLessThan(1);
        setOption('animations', true); expect(animationFactor()).toBe(1);
        setOption('effects', 'high'); setOption('reduceFx', true);
        expect(effectsLevel()).toBe('low'); expect(document.body.classList.contains('fx-reduced')).toBe(true);
        expect(document.body.classList.contains('fx-high')).toBe(false);
        expect(getOption('reduceFx')).toBe(true);
        applyOptions();
    });
});
