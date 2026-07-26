/**
 * Spec-driven tests for §14 — Interface utilisateur (onglet Mix)
 * References: SPEC-14.1.2, SPEC-14.1.3, SPEC-14.2.5, SPEC-14.2.6, SPEC-14.4.1
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, test, expect } from '@jest/globals';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DJ_MIX_DIR = join(__dirname, '..', '..');

const html = readFileSync(join(DJ_MIX_DIR, 'index.html'), 'utf8');
const css = readFileSync(join(DJ_MIX_DIR, 'style.css'), 'utf8');
const mainSource = readFileSync(join(DJ_MIX_DIR, 'main.js'), 'utf8');

describe('SPEC-14.1.2 — Pas de chips FX au-dessus des platines', () => {
  test('index.html ne contient plus les boutons low-pass/high-pass/suggestion', () => {
    expect(html).not.toContain('deck-local-fx');
    expect(html).not.toContain('id="deck-a-lowpass-btn"');
    expect(html).not.toContain('id="deck-a-highpass-btn"');
    expect(html).not.toContain('id="deck-a-change-suggestion-btn"');
    expect(html).not.toContain('id="deck-b-lowpass-btn"');
    expect(html).not.toContain('id="deck-b-highpass-btn"');
    expect(html).not.toContain('id="deck-b-change-suggestion-btn"');
  });
});

describe('SPEC-14.1.3 — Clic sur la platine lance/pause la lecture', () => {
  test('main.js attache un handler de clic sur deckAPanel/deckBPanel via handleDeckLaunchClick', () => {
    expect(mainSource).toContain('function handleDeckLaunchClick(deck)');
    expect(mainSource).toMatch(/deckAPanel\?\.addEventListener\('click'[\s\S]{0,150}handleDeckLaunchClick\('A'\)/);
    expect(mainSource).toMatch(/deckBPanel\?\.addEventListener\('click'[\s\S]{0,150}handleDeckLaunchClick\('B'\)/);
  });
});

describe('SPEC-14.2.5 — Le menu DJ Plan se cache avec le menu mix', () => {
  test('style.css masque #dj-plan-section quand #tab-mix est mix-options-collapsed', () => {
    expect(css).toMatch(/#tab-mix\.mix-options-collapsed\s+#dj-plan-section\s*\{\s*display:\s*none;/);
  });
});

describe('SPEC-14.2.6 — Titre sur une ligne, artiste plus petit', () => {
  test('style.css définit .deck-track-title en une seule ligne avec ellipsis', () => {
    const titleRuleMatch = css.match(/\.deck-track-title\s*\{[^}]*\}/);
    expect(titleRuleMatch).not.toBeNull();
    expect(titleRuleMatch[0]).toContain('white-space: nowrap');
    expect(titleRuleMatch[0]).toContain('text-overflow: ellipsis');
  });

  test('.deck-track-artist-name a une police plus petite que .deck-track-title', () => {
    const titleSize = Number(css.match(/\.deck-track-title\s*\{[^}]*font-size:\s*(\d+)px/)[1]);
    const artistSize = Number(css.match(/\.deck-track-artist-name\s*\{[^}]*font-size:\s*(\d+)px/)[1]);
    expect(artistSize).toBeLessThan(titleSize);
  });

  test('.deck-panel a min-width:0 pour que la troncature du titre s\'adapte réellement à la largeur de la colonne de grille', () => {
    const panelRuleMatch = css.match(/\.deck-panel\s*\{[^}]*\}/);
    expect(panelRuleMatch).not.toBeNull();
    expect(panelRuleMatch[0]).toMatch(/min-width:\s*0;/);
  });
});

describe('SPEC-14.4.1 — Volume global regroupé avec le bouton menu mix', () => {
  test('#global-volume-slider est un descendant de .controls, avant le crossfade slider de mix', () => {
    const controlsStart = html.indexOf('<div class="controls">');
    const mixSliderStart = html.indexOf('id="deck-mix-slider"');
    const volumeSliderStart = html.indexOf('id="global-volume-slider"');
    expect(controlsStart).toBeGreaterThan(-1);
    expect(volumeSliderStart).toBeGreaterThan(controlsStart);
    expect(volumeSliderStart).toBeLessThan(mixSliderStart);
  });
});
