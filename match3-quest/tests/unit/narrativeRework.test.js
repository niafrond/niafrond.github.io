import { SCREENS, QUESTS } from '../../story.js';
import { BANTER } from '../../companions.js';
import { createSession, talkToNpc, markEnemyDefeated } from '../../exploration.js';

const all = lines => (lines || []).join(' ');
const enemy = (screen, id) => SCREENS[screen].enemies.find(e => e.id === id);

describe('Xihe (anciennement Hua)', () => {
    test('aucun PNJ ne s\'appelle plus Hua : la colporteuse est Xihe, ids inchangés', () => {
        const peddlers = Object.values(SCREENS).flatMap(s => s.npcs || []).filter(n => /^hua_/.test(n.id));
        expect(peddlers.length).toBeGreaterThan(5);
        peddlers.forEach(n => expect(n.name).toBe('Xihe'));
    });
});

describe('Fengmeng : Kunlun, aveu, responsabilité', () => {
    test('au Volcan, il dit que la Reine Mère n\'a qu\'un seul véritable élixir et qu\'il en déduit que Chang\'e le détient', () => {
        const txt = all(enemy('volcan', 'fengmeng_2').defeatScene.lines);
        expect(txt).toMatch(/qu'un seul véritable/);
        expect(txt).toMatch(/Chang'e/);
    });

    test('phase 2 : l\'aveu ne vaut pas excuse, et il redescend à pied, sans arme, pour répondre de ses actes', () => {
        const txt = all(enemy('lune', 'fengmeng_3b').defeatScene.lines);
        expect(txt).toMatch(/Tu es digne/);
        expect(txt).toMatch(/n'excuse rien/);
        expect(txt).toMatch(/sans arme/);
        expect(all(QUESTS.find(q => q.id === 'q_fengmeng').complete)).toMatch(/répondre de ses actes/);
    });

    test('phase 1 : Chang\'e boit avant que Fengmeng ne puisse s\'en emparer ; elle perd sa présence, pas sa vie', () => {
        const txt = all(enemy('lune', 'fengmeng_3a').defeatScene.lines);
        expect(txt).toMatch(/avant que la main de Fengmeng ne l'atteigne/);
        expect(txt).toMatch(/Je ne perds pas la vie/);
    });
});

describe('soleil 9 : deux soleils ensemble, un seul abattu par compassion', () => {
    test('la scène de victoire fait expliquer son geste à Hou Yi avant l\'interlude du miroir', () => {
        const scenes = enemy('fusang', 'sun_9').afterScenes;
        const iHero = scenes.findIndex(sc => sc.speaker.hero && /par habitude/.test(all(sc.lines)));
        const iMirror = scenes.findIndex(sc => /Avant que la grue/.test(all(sc.lines)));
        expect(iHero).toBeGreaterThan(-1);
        expect(iMirror).toBeGreaterThan(iHero);
    });

    test('la quête annonce qu\'un seul des deux soleils sera abattu', () => {
        expect(all(QUESTS.find(q => q.id === 'q_sun_9').offer)).toMatch(/Vous n'en abattrez qu'un/);
    });
});

describe('miroir : le messager de la Lune', () => {
    const messenger = () => SCREENS.fusang.npcs.find(n => n.id === 'moon_messenger');

    test('il est sur la carte du Fusang, près du sanctuaire, et n\'apparaît qu\'après la chute du soleil 9', () => {
        const m = messenger();
        expect(m).toBeTruthy();
        expect(m.showWhen).toBe('sun_9');
        const sun = enemy('fusang', 'sun_9');
        expect(Math.abs(m.x - sun.x) + Math.abs(m.y - sun.y)).toBeLessThanOrEqual(3);
    });

    test('il explique que Chang\'e a coupé le lien elle-même pour que Fengmeng ne la retrouve pas', () => {
        const txt = all(messenger().idle);
        expect(txt).toMatch(/Chang'e/);
        expect(txt).toMatch(/coupé le lien/);
        expect(txt).toMatch(/Fengmeng/);
    });

    test('en exploration, il est invisible avant sun_9 puis parlable après', () => {
        const s = createSession({ screenId: 'fusang', x: SCREENS.fusang.spawn.x, y: SCREENS.fusang.spawn.y });
        const m = messenger();
        s.data.x = m.x; s.data.y = m.y + 1;
        const before = talkToNpc(s, 'moon_messenger');
        markEnemyDefeated(s, 'sun_9');
        const after = talkToNpc(s, 'moon_messenger');
        expect(JSON.stringify(after)).toMatch(/coupé le lien/);
        expect(JSON.stringify(before)).not.toMatch(/coupé le lien/);
    });
});

describe('Xiao Gui avant le duel final', () => {
    test('il dit « Être blessé ne te donne pas le droit de blesser les autres » sur le Pic de la Lune, avant la phase 1', () => {
        const b = BANTER.find(x => x.id === 'gui_lune_avant');
        expect(b.companion).toBe('xiao_gui');
        expect(b.screen).toBe('lune');
        expect(b.unless).toBe('fengmeng_3a');
        expect(JSON.stringify(b.scenes)).toContain('Être blessé ne te donne pas le droit de blesser les autres.');
    });
});
