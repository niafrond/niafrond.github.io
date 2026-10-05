/** @jest-environment jsdom */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { getOption, setOption, effectsLevel, animationFactor, maxManaParticles, applyOptions, OPTION_DEFAULTS } from '../../gameOptions.js';
import { flyManaToCounter } from '../../manaFlight.js';

const rect = (l, t) => ({ left: l, top: t, width: 20, height: 20 });

beforeEach(() => {
    Object.entries(OPTION_DEFAULTS).forEach(([k, v]) => setOption(k, v));
    window.matchMedia = () => ({ matches: false });
});

describe('options d\'affichage', () => {
    test('valeurs par défaut, validation et persistance', () => {
        expect(getOption('manaFlight')).toBe(true);
        expect(setOption('speed', 'turbo')).toBe(false);
        expect(setOption('inconnue', 1)).toBe(false);
        expect(setOption('speed', 'fast')).toBe(true);
        expect(JSON.parse(localStorage.getItem('match3quest.options')).speed).toBe('fast');
    });

    test('vitesse : facteur de durée', () => {
        setOption('speed', 'slow'); expect(animationFactor()).toBeGreaterThan(1);
        setOption('speed', 'fast'); expect(animationFactor()).toBeLessThan(1);
        setOption('speed', 'normal'); expect(animationFactor()).toBe(1);
    });

    test('effets : niveau forcé, auto selon l\'appareil, classes du body', () => {
        setOption('effects', 'low');
        expect(effectsLevel()).toBe('low');
        expect(document.body.classList.contains('fx-low')).toBe(true);
        expect(maxManaParticles()).toBeLessThan(6);
        setOption('effects', 'high');
        expect(document.body.classList.contains('fx-high')).toBe(true);
        expect(maxManaParticles()).toBeGreaterThan(6);
        setOption('effects', 'auto');
        Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2, configurable: true });
        expect(effectsLevel()).toBe('low');
        Object.defineProperty(navigator, 'hardwareConcurrency', { value: 12, configurable: true });
        Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
        expect(effectsLevel()).toBe('high');
        window.matchMedia = () => ({ matches: true });
        expect(effectsLevel()).toBe('low');
        applyOptions();
    });
});

describe('manaFlight et options', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="board"></div><span id="player-mana-blue"></span>';
        for (let i = 0; i < 10; i++) {
            const t = document.createElement('div');
            t.getBoundingClientRect = () => rect(i * 10, 50);
            document.getElementById('board').appendChild(t);
        }
        document.getElementById('player-mana-blue').getBoundingClientRect = () => rect(0, 0);
        Element.prototype.animate = function () { return {}; };
    });

    test('option désactivée : aucune particule', () => {
        setOption('manaFlight', false);
        flyManaToCounter([0, 1, 2], 'blue');
        expect(document.querySelectorAll('.mana-fly-dot')).toHaveLength(0);
    });

    test('le nombre de particules suit le niveau d\'effets', () => {
        const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        setOption('effects', 'low');
        flyManaToCounter(all, 'blue');
        expect(document.querySelectorAll('.mana-fly-dot').length).toBeLessThanOrEqual(3);
        document.querySelectorAll('.mana-fly-dot').forEach(d => d.remove());
        setOption('effects', 'high');
        flyManaToCounter(all, 'blue');
        expect(document.querySelectorAll('.mana-fly-dot').length).toBeGreaterThan(6);
    });
});
