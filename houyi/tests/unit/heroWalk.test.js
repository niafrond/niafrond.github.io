import { gbaWalkSprite, gbaSprite, loadAllGbaSprites } from '../../sprites/index.js';

// Les sprites GBA sont chargés à la demande (avec leur région) : ici on les charge tous.
await loadAllGbaSprites();

describe('animation de marche du héros', () => {
    const classes = ['archer', 'templar', 'barbarian', 'assassin', 'sorcerer'];

    test.each(classes)('%s a un cycle de marche dans chaque direction', cls => {
        for (const dir of ['front', 'back', 'left', 'right']) {
            expect(gbaWalkSprite(cls, dir, 0)).toMatch(/^data:image\/png;base64,/);
            expect(gbaSprite(cls, dir)).toBeTruthy();
        }
    });

    test('le cycle change d\'image avec le temps et boucle', () => {
        const seq = [0, 1, 2, 3].map(t => gbaWalkSprite('archer', 'front', t));
        expect(new Set(seq).size).toBe(4);
        expect(gbaWalkSprite('archer', 'front', 4)).toBe(seq[0]);
        // 3 images (gauche) : aller-retour 0,1,2,1
        expect(gbaWalkSprite('archer', 'left', 3)).toBe(gbaWalkSprite('archer', 'left', 1));
    });

    test('pas d\'animation pour un PNJ sans cycle', () => {
        expect(gbaWalkSprite('farmer_lin', 'front', 0)).toBeNull();
    });
});
