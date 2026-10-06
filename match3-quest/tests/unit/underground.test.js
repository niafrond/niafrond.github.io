import { readFileSync } from 'node:fs';
import { SCREENS } from '../../story.js';
import { UNDERGROUND } from '../../world/underground.js';
import { createSession, tryMove, currentScreen, isTerrainBlocked } from '../../exploration.js';
import { merchantStock, availableOffers, buyOffer, MERCHANT_IDS, TORCH_PRICE } from '../../merchants.js';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));
const templateIds = new Set(catalog.map(t => t.id));
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

describe('souterrains : cavernes et cryptes dans le noir', () => {
    test.each(UNDERGROUND.map(u => [u.id, u]))('%s : écran sombre relié à sa zone sauvage', (_id, u) => {
        const s = SCREENS[u.id];
        expect(s).toMatchObject({ dark: true, underground: true, region: u.region });
        const parent = SCREENS[u.parent];
        const entry = parent.exits.find(e => e.to === u.id);
        const back = s.exits.find(e => e.to === u.parent);
        expect(entry && back).toBeTruthy();
        expect(isTerrainBlocked(parent, entry.x, entry.y)).toBe(false);
        expect(isTerrainBlocked(parent, back.arrive.x, back.arrive.y)).toBe(false);
        expect(isTerrainBlocked(s, entry.arrive.x, entry.arrive.y)).toBe(false);
        s.enemies.forEach(e => expect(templateIds.has(e.templateId)).toBe(true));
        expect(s.chests.length).toBeGreaterThanOrEqual(2);
    });

    test.each(UNDERGROUND.map(u => [u.id, u]))('%s : tout est atteignable même avec les ennemis et coffres pour obstacles', (_id, u) => {
        const s = SCREENS[u.id];
        const ents = [...s.enemies, ...s.chests];
        const solid = new Set(ents.map(e => `${e.x},${e.y}`));
        const seen = new Set([`${s.spawn.x},${s.spawn.y}`]);
        const queue = [s.spawn];
        while (queue.length) {
            const { x, y } = queue.shift();
            DIRS.forEach(([dx, dy]) => {
                const k = `${x + dx},${y + dy}`;
                if (seen.has(k) || isTerrainBlocked(s, x + dx, y + dy) || solid.has(k)) return;
                seen.add(k); queue.push({ x: x + dx, y: y + dy });
            });
        }
        ents.forEach(e => expect(DIRS.some(([dx, dy]) => seen.has(`${e.x + dx},${e.y + dy}`))).toBe(true));
    });

    test('on y entre depuis la zone sauvage et on en ressort', () => {
        const u = UNDERGROUND[0];
        const parent = SCREENS[u.parent];
        const entry = parent.exits.find(e => e.to === u.id);
        const session = createSession({ screenId: u.parent, x: entry.x, y: entry.y + 1 });
        session.data.x = entry.x; session.data.y = entry.y;
        // placer le héros à côté de l'entrée puis marcher dessus
        const side = DIRS.map(([dx, dy]) => ({ x: entry.x + dx, y: entry.y + dy, dx: -dx, dy: -dy })).find(p => !isTerrainBlocked(parent, p.x, p.y));
        session.data.x = side.x; session.data.y = side.y;
        expect(tryMove(session, side.dx, side.dy, { playerLevel: 99 })).toMatchObject({ type: 'transition', to: u.id });
        expect(currentScreen(session).dark).toBe(true);
    });
});

describe('torche', () => {
    test('vendue par chaque marchand, une seule fois', () => {
        MERCHANT_IDS.forEach(id => expect(merchantStock(id).find(o => o.kind === 'torch')).toMatchObject({ price: TORCH_PRICE, unique: true }));
        const hero = { gold: 1000, weapons: [], inventory: [] };
        const res = buyOffer(MERCHANT_IDS[0], 'torch:torch', hero);
        expect(res.ok).toBe(true);
        expect(hero).toMatchObject({ torch: true, gold: 1000 - TORCH_PRICE });
        expect(availableOffers(MERCHANT_IDS[1], hero).some(o => o.kind === 'torch')).toBe(false);
        expect(buyOffer(MERCHANT_IDS[0], 'torch:torch', hero).ok).toBe(false);
    });

    test('trop pauvre : pas de torche', () => {
        const hero = { gold: TORCH_PRICE - 1, weapons: [], inventory: [] };
        expect(buyOffer(MERCHANT_IDS[0], 'torch:torch', hero).ok).toBe(false);
        expect(hero.torch).toBeUndefined();
    });
});
