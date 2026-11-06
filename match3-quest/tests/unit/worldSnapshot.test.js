// Le monde est précalculé (world/snapshot.js, tools/build-world-snapshot.mjs) pour éviter plusieurs secondes d'assemblage au démarrage
// sur un vieux téléphone. Ces tests garantissent que l'instantané reste identique à l'assemblage réel.
import { readFileSync } from 'node:fs';
import { buildWorld, SCREENS, QUESTS } from '../../story.js';
import snapshot from '../../world/snapshot.js';
import { snapshotSource, SNAPSHOT_FILE } from '../../tools/build-world-snapshot.mjs';
import { EVENTS, EVENTS_DEFAULT } from '../../events/config.js';

describe('instantané du monde', () => {
    const fresh = buildWorld();

    test("le fichier est à jour (lancer `npm run world:snapshot` après toute modification de story.js, world/ ou events/)", () => {
        expect(readFileSync(SNAPSHOT_FILE, 'utf8') === snapshotSource(fresh)).toBe(true);
    });

    test('le monde chargé par le jeu est celui de l\'assemblage (sans événement forcé)', () => {
        expect(EVENTS).toEqual(EVENTS_DEFAULT);
        expect(JSON.parse(JSON.stringify(snapshot))).toEqual(JSON.parse(JSON.stringify(fresh)));
        expect(QUESTS).toEqual(fresh.quests);
        Object.keys(fresh.screens).forEach(id => expect(SCREENS[id]).toEqual(fresh.screens[id]));
    });

    test('une configuration d\'événements modifiée n\'utilise pas l\'instantané', () => {
        const off = buildWorld({ events: { wanderingSouls: { enabled: false } } });
        expect(Object.keys(off.screens).length).toBeLessThanOrEqual(Object.keys(fresh.screens).length);
    });
});
