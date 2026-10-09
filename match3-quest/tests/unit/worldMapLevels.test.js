import { worldZones } from '../../worldMap.js';
import { REGION_UNLOCK_LEVEL } from '../../story.js';
import { REGION_LEVEL } from '../../world/index.js';

describe('carte du monde : niveaux alignés sur ceux des régions', () => {
    test('chaque zone porte le niveau d\'accès de sa région (story.js) et le niveau de région (world/index.js)', () => {
        worldZones.forEach(z => {
            expect(z.unlockLevel).toBe(REGION_UNLOCK_LEVEL[z.id]);
            expect(z.unlockLevel).toBe(REGION_LEVEL[z.id]);
        });
        expect(worldZones.map(z => z.id)).toEqual(Object.keys(REGION_UNLOCK_LEVEL));
    });
});
