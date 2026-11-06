/** @jest-environment jsdom */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { getOption, setOption, effectsLevel, animationFactor, maxManaParticles, applyOptions, vibrate, canVibrate, armVibration, isVibrationBlocked, OPTION_DEFAULTS } from '../../gameOptions.js';
import { readFileSync } from 'node:fs';
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

describe('vibrations', () => {
    test('activées par défaut, coupées par l\'option, sans effet si l\'appareil ne vibre pas', () => {
        const calls = [];
        Object.defineProperty(navigator, 'vibrate', { value: ms => { calls.push(ms); return true; }, configurable: true });
        expect(getOption('vibration')).toBe(true);
        expect(vibrate(50)).toBe(true);
        expect(calls).toEqual([50]);
        expect(setOption('vibration', false)).toBe(true);
        expect(vibrate(50)).toBe(false);
        expect(calls).toEqual([50]);   // rien de plus : l'option est coupée
        expect(setOption('vibration', 'oui')).toBe(false);   // valeur invalide refusée
        setOption('vibration', true);
        Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
        expect(vibrate(50)).toBe(false);
    });
    test('sans vibreur (iPhone, Firefox) : détection, et secousse de l\'écran seulement pour les dégâts', () => {
        Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
        expect(canVibrate()).toBe(false);
        document.body.className = '';
        expect(vibrate(50)).toBe(false);                        // onde : rien
        expect(document.body.classList.contains('shake')).toBe(false);
        expect(vibrate(50, true)).toBe(false);                  // dégâts : secousse
        expect(document.body.classList.contains('shake')).toBe(true);
        setOption('vibration', false);
        document.body.className = '';
        vibrate(50, true);
        expect(document.body.classList.contains('shake')).toBe(false);   // option coupée : rien du tout
        setOption('vibration', true);
        Object.defineProperty(navigator, 'vibrate', { value: () => true, configurable: true });
        expect(canVibrate()).toBe(true);
    });
    test('Chrome exige un geste : un refus (false) signale le blocage, un geste réussi le lève', () => {
        const events = [];
        window.addEventListener('m3:vibration-blocked', () => events.push('blocked'));
        let allowed = false;
        Object.defineProperty(navigator, 'vibrate', { value: () => allowed, configurable: true });
        expect(vibrate(50)).toBe(false);                 // pas de geste : refusé
        expect(isVibrationBlocked()).toBe(true);
        expect(events).toEqual(['blocked']);
        expect(armVibration()).toBe(false);              // encore refusé
        allowed = true;                                  // l'utilisateur a touché l'écran
        expect(armVibration()).toBe(true);
        expect(isVibrationBlocked()).toBe(false);
        expect(vibrate(50)).toBe(true);
        setOption('vibration', false);
        expect(armVibration()).toBe(false);              // option coupée : on n'arme rien
        setOption('vibration', true);
    });
    test('l\'option figure dans le menu Options (index.html)', () => {
        const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
        expect(html).toContain('id="opt-vibration"');
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
