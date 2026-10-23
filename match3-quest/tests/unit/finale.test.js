import { readFileSync } from 'fs';
import { SCREENS, STORY_ENDING } from '../../story.js';
import { isArenaUnlocked } from '../../arena.js';
import { CREDITS, ENDING_CAPTIONS } from '../../cinematics.js';
import {
    createSession, talkToNpc, markEnemyDefeated, encounterFor, resetAfterDefeat, startNewGamePlus, aliveEnemies
} from '../../exploration.js';

const lune = () => createSession({ screenId: 'lune', x: SCREENS.lune.spawn.x, y: SCREENS.lune.spawn.y });

describe('finale du Pic de la Lune : Chang\'e appât, phases enchaînées', () => {
    test('parler à Chang\'e fait surgir Fengmeng (phase 1) ; les conversations suivantes sont plus courtes', () => {
        const s = lune();
        expect(aliveEnemies(s).map(e => e.def.id)).not.toContain('fengmeng_3a');
        const first = talkToNpc(s, 'change_moon');
        expect(first.combat).toBe('fengmeng_3a');
        expect(first.lines).toEqual(SCREENS.lune.npcs.find(n => n.id === 'change_moon').bait.lines);
        expect(first.lines.join(' ')).toMatch(/appât/);
        expect(aliveEnemies(s).map(e => e.def.id)).toContain('fengmeng_3a');
        const again = talkToNpc(s, 'change_moon');
        expect(again.combat).toBe('fengmeng_3a');
        expect(again.lines.length).toBeLessThan(first.lines.length);
    });

    test('la victoire sur la phase 1 enchaîne la phase 2 après les scènes, sans retour libre', () => {
        const s = lune();
        talkToNpc(s, 'change_moon');
        const events = markEnemyDefeated(s, 'fengmeng_3a');
        expect(events.map(e => e.type)).toEqual(['scene', 'chain']);
        expect(events[1].enemyId).toBe('fengmeng_3b');
    });

    test('la phase 2 garde les PV du héros ; la phase 1 non', () => {
        const s = lune();
        expect(encounterFor(s, 'fengmeng_3a', 40).carryHp).toBe(false);
        expect(encounterFor(s, 'fengmeng_3b', 40).carryHp).toBe(true);
    });

    test('une défaite en phase 2 annule la phase 1 : tout le duel est à refaire', () => {
        const s = lune();
        talkToNpc(s, 'change_moon');
        markEnemyDefeated(s, 'fengmeng_3a');
        s.rt.pendingEnemyId = 'fengmeng_3b';
        resetAfterDefeat(s);
        expect(s.data.defeated).not.toContain('fengmeng_3a');
        expect(aliveEnemies(s).map(e => e.def.id)).toContain('fengmeng_3a');
        expect(aliveEnemies(s).map(e => e.def.id)).not.toContain('fengmeng_3b');
        expect(talkToNpc(s, 'change_moon').combat).toBe('fengmeng_3a');
    });

    test('une défaite en phase 1 ne touche pas aux ennemis vaincus', () => {
        const s = lune();
        s.data.defeated.push('sun_1');
        s.rt.pendingEnemyId = 'fengmeng_3a';
        resetAfterDefeat(s);
        expect(s.data.defeated).toEqual(['sun_1']);
    });

    test('Chang\'e ne relance plus le combat une fois Fengmeng vaincu', () => {
        const s = lune();
        markEnemyDefeated(s, 'fengmeng_3a');
        expect(talkToNpc(s, 'change_moon').combat).toBeUndefined();
    });
});

describe('fin de la légende : textes, générique, Nouvelle Partie +', () => {
    test('chaque tableau de l\'animation de fin est expliqué par une légende', () => {
        expect(ENDING_CAPTIONS).toHaveLength(4);
        ENDING_CAPTIONS.forEach(c => expect(c.length).toBeGreaterThan(80));
        expect(ENDING_CAPTIONS.join(' ')).toMatch(/Fengmeng/);
        expect(ENDING_CAPTIONS.join(' ')).toMatch(/Chang'e/);
        expect(ENDING_CAPTIONS[3]).toMatch(/Ainsi s'achève la légende de Hou Yi/);
        expect(STORY_ENDING.length).toBeGreaterThan(0);
    });

    test('le générique reprend les crédits voulus, dans l\'ordre, et finit sur le mot pour la famille', () => {
        const text = CREDITS.map(c => [c.text, c.role, ...(c.names || []), ...(c.lines || [])].join(' ')).join(' | ');
        expect(text).toMatch(/Un jeu imaginé et créé par Mickaël Fontaine/);
        expect(text).toMatch(/Concept original, réalisation et scénario Mickaël Fontaine/);
        expect(text).toMatch(/Inspiré librement de la mythologie chinoise Et notamment des légendes de Hou Yi et de Chang'e/);
        expect(text).toMatch(/Ethan, pour ses cours de chinois/);
        expect(text).toMatch(/Claude \(Anthropic\).*Musique : ACE-Step.*Création visuelle : ComfyUI.*Génération de textes : Ollama/);
        expect(text).toMatch(/Idées, suggestions et contributions Ethan, Luna/);
        expect(text).toMatch(/Tests et assurance qualité \(QA\) Ethan, Luna, Vanessa/);
        expect(text).toMatch(/carte graphique, qui a affronté les flammes/);
        expect(CREDITS[CREDITS.length - 1].text).toBe("À ma femme et mes enfants, qui m'ont suivi dans mon délire, je vous aime fort.");
        expect(CREDITS.filter(c => c.type === 'rule')).toHaveLength(4);
    });

    test('le générique défile seul, se laisse remonter, s\'arrête sur la dernière phrase et attend « Continuer »', () => {
        const src = readFileSync(new URL('../../cinematics.js', import.meta.url), 'utf8');
        expect(src).toMatch(/cine-credits-continue/);
        expect(src).toMatch(/\['wheel', 'touchstart', 'touchmove', 'pointerdown'\]/);   // le joueur reprend la main
        expect(src).toMatch(/if \(pos >= maxScroll\(\) - 1\) markDone\(\)/);
        const main = readFileSync(new URL('../../main.js', import.meta.url), 'utf8');
        expect(main).toMatch(/\.cine-ending, \.cine-credits'\)\) return \['ending'\]/);
    });

    test('en Nouvelle Partie +, l\'arène est ouverte dès le début, même sans terrain visité', () => {
        expect(isArenaUnlocked([], 0)).toBe(false);
        expect(isArenaUnlocked([], 1)).toBe(true);
        const s = createSession({});
        s.data.ended = true;
        expect(startNewGamePlus(s)).toBe(true);
        expect(s.data.ngPlus).toBe(1);
        expect(s.data.visitedScreens.some(id => id.startsWith('gobi'))).toBe(false);
        expect(isArenaUnlocked(s.data.visitedScreens, s.data.ngPlus)).toBe(true);
    });

    test('la Nouvelle Partie + remet toutes les quêtes à zéro et relance l\'histoire depuis le prologue', () => {
        const s = createSession({});
        s.data.quests = { q_sun_1: 'done', q_sun_2: 'active' };
        s.data.defeated = ['fengmeng_1'];
        s.data.waypoints = ['some_village'];
        s.data.activeCompanion = 'someone';
        s.data.seenCinematics = { fengmeng_2: true };
        s.data.introSeen = true;
        s.data.tracked = 'q_sun_2';
        s.data.ended = true;
        expect(startNewGamePlus(s)).toBe(true);
        expect(s.data.quests).toEqual({});
        expect(s.data.defeated).toEqual([]);
        expect(s.data.activeCompanion).toBe(null);
        expect(s.data.seenCinematics).toEqual({});
        expect(s.data.introSeen).toBe(false);
        expect(s.data.tracked).toBe(null);
        expect(s.data.waypoints.includes('some_village')).toBe(false);
        const view = readFileSync(new URL('../../explorationView.js', import.meta.url), 'utf8');
        expect(view).toMatch(/playPrologueAnimation\(\)\.then[\s\S]*startEncounter\('fengmeng_1'\)/);
    });

    test('la Nouvelle Partie + passe par l\'export de la sauvegarde, après le générique', () => {
        const view = readFileSync(new URL('../../explorationView.js', import.meta.url), 'utf8');
        expect(view).toMatch(/await playEndingAnimation\(\);\s*await playCredits\(\);/);
        expect(view).toMatch(/cfg\.onExportSave && !cfg\.onExportSave\(\)/);
        const main = readFileSync(new URL('../../main.js', import.meta.url), 'utf8');
        expect(main).toMatch(/onExportSave:/);
    });
});
