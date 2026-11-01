// Soluce (soluce/bases.html, soluce/stuff.html) : le contre-équipement des boss y est documenté (le jeu, lui, ne l'annonce pas).
// Les pages sont générées par tools/build-soluce.mjs et versionnées : ce test vérifie qu'elles sont à jour avec les données du jeu.
import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { allStuff, WARD_STUFF, WARD_TIERS, WARD_ELEMENT_LABELS, VENOMOUS_TEMPLATES } from '../../stuff.js';
import { BOSS_COUNTER_FROM_LEVEL, BOSS_COUNTER_FULL_LEVEL } from '../../bossBalance.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const page = name => readFileSync(join(ROOT, 'soluce', name), 'utf8');
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('soluce : boss et contre-équipement', () => {
    const bases = page('bases.html');
    const plain = text(bases);

    test('la section existe et résume les règles', () => {
        expect(plain).toContain('Boss : il faut varier sorts et stuff');
        expect(plain).toContain('on le devine en combattant');
        expect(plain).toMatch(/Niveau minimum/);
        expect(plain).toContain(`niveau ${BOSS_COUNTER_FROM_LEVEL}`);
        expect(plain).toContain(`niveau ${BOSS_COUNTER_FULL_LEVEL}`);
        expect(plain).toContain(`${WARD_STUFF.length} pièces`);
        WARD_TIERS.forEach(t => expect(plain).toContain(`niveau ${t.minLevel}`));
    });

    test('les cinq éléments sont listés avec leur faiblesse et leurs parures (liens vers des pages existantes)', () => {
        Object.values(WARD_ELEMENT_LABELS).forEach(label => expect(plain).toContain(label));
        for (const piece of WARD_STUFF.filter(p => p.minLevel === WARD_TIERS[1].minLevel)) {
            expect(bases).toContain(`href="stuff-${piece.id}.html"`);
            expect(existsSync(join(ROOT, 'soluce', `stuff-${piece.id}.html`))).toBe(true);
        }
    });

    test('toutes les parures ont leur fiche et figurent au catalogue du stuff', () => {
        const stuff = page('stuff.html');
        for (const piece of WARD_STUFF) {
            expect(existsSync(join(ROOT, 'soluce', `stuff-${piece.id}.html`))).toBe(true);
            expect(stuff).toContain(`stuff-${piece.id}.html`);
        }
        expect(text(stuff)).toContain('protection élémentaire');
    });

    test('les gabarits venimeux et leurs antidotes sont cités (liens valides)', () => {
        VENOMOUS_TEMPLATES.forEach(id => expect(bases).toContain(id));
        for (const id of ['collier_antivenin', 'bracelet_antidote', 'collier_du_phenix']) {
            expect(bases).toContain(`stuff-${id}.html`);
            expect(existsSync(join(ROOT, 'soluce', `stuff-${id}.html`))).toBe(true);
        }
    });

    test('l\'accueil compte toutes les pièces de stuff', () => {
        expect(page('../soluce.html')).toContain(`${allStuff.length} pièces`);
    });
});

describe('jeu : aucune annonce du contre-équipement', () => {
    test('enemies.js ne rédige plus de ligne de parure, d\'antidote ou de venin', () => {
        const src = readFileSync(join(ROOT, 'enemies.js'), 'utf8');
        expect(src).not.toMatch(/une parure de/);
        expect(src).not.toMatch(/antidote/i);
        expect(src).not.toMatch(/Son venin/);
    });
});
