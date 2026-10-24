// Héros à cheval (tools/gen-mounted-heroes.py) : un sprite de cavalier par classe, 4 directions + cycle de marche, 48×48, chargé avec la région.
import { readFileSync } from 'fs';
import { gbaSprite, gbaWalkSprite, loadGbaSprites, hasGbaSprite } from '../../sprites/index.js';

const CLASSES = ['archer', 'templar', 'barbarian', 'assassin', 'sorcerer'];
const DIRS = ['front', 'back', 'left', 'right'];
const size = uri => { const b = Buffer.from(uri.split(',')[1], 'base64'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

await loadGbaSprites(CLASSES.map(c => `${c}_horse`));

describe('héros à cheval', () => {
    test.each(CLASSES)('%s : 4 directions fixes et 4 images de marche par direction, en PNG 48×48', cls => {
        expect(hasGbaSprite(`${cls}_horse`)).toBe(true);
        DIRS.forEach(dir => {
            expect(size(gbaSprite(`${cls}_horse`, dir))).toEqual([48, 48]);
            const frames = [0, 1, 2, 3].map(n => gbaWalkSprite(`${cls}_horse`, dir, n));
            frames.forEach(f => expect(size(f)).toEqual([48, 48]));
            expect(new Set(frames).size).toBeGreaterThan(1);        // le cheval marche : les images changent
            expect(gbaWalkSprite(`${cls}_horse`, dir, 4)).toBe(frames[0]);   // boucle de 4 images
        });
    });

    test('chaque classe a son cavalier : les sprites ne sont pas tous identiques', () => {
        const lefts = CLASSES.map(c => gbaSprite(`${c}_horse`, 'left'));
        expect(new Set(lefts).size).toBe(CLASSES.length);
    });

    test('le rendu d\'exploration utilise le sprite monté de la classe, avec repli sur l\'ancien montage, et le charge avec la région', () => {
        const view = readFileSync(new URL('../../explorationView.js', import.meta.url), 'utf8');
        expect(view).toMatch(/const mountKey = `\$\{hero\.classId\}_horse`/);
        expect(view).toMatch(/riding\(\) && \(\(moving && gbaWalkSprite\(mountKey, heroDir/);
        expect(view).toMatch(/else if \(riding\(\)\) \{[\s\S]*horse_mount/);   // repli
        expect(view.match(/\$\{cfg\.getHero\(\)\.classId\}_horse/g).length).toBeGreaterThanOrEqual(2);   // chargé à l'arrivée et région déjà prête
    });
});
