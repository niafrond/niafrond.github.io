import { createTrail, resetTrail, recordHero, pointBehind, stepCompanion, dirOfMove, FOLLOW_GAP, DIR_VECTOR } from '../../companionTrail.js';

// Fait avancer le héros de (x0, y0) à (x1, y1) à vitesse constante, image après image (16 ms), et renvoie le compagnon.
function walk(t, from, to, speed = 7, dirName = 'right') {
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const steps = Math.max(1, Math.round(dist / speed * 1000 / 16));
    for (let i = 1; i <= steps; i++) {
        const x = from[0] + (to[0] - from[0]) * i / steps, y = from[1] + (to[1] - from[1]) * i / steps;
        recordHero(t, x, y, dirName);
        stepCompanion(t, { x, y }, 16, dirName);
    }
    return t;
}

describe('compagnon à la trace du héros (companionTrail.js)', () => {
    test('à l\'arrivée, le compagnon se place derrière le héros (à l\'opposé de son regard)', () => {
        for (const [dir, [vx, vy]] of Object.entries(DIR_VECTOR)) {
            const t = resetTrail(createTrail(), 10, 10, dir);
            expect(t.x).toBeCloseTo(10 - vx * FOLLOW_GAP, 6);
            expect(t.y).toBeCloseTo(10 - vy * FOLLOW_GAP, 6);
            expect(t.moving).toBe(false);
        }
    });

    test('en marche droite, il reste en ligne derrière le héros, à peu près à l\'écart voulu, et « marche »', () => {
        const t = resetTrail(createTrail(), 5, 8, 'right');
        walk(t, [5, 8], [14, 8]);
        expect(t.y).toBeCloseTo(8, 1);
        expect(14 - t.x).toBeGreaterThan(FOLLOW_GAP * 0.7);
        expect(14 - t.x).toBeLessThan(FOLLOW_GAP * 1.6);
        expect(t.dir).toBe('right');
        expect(t.moving).toBe(true);
        expect(t.phase).toBeGreaterThan(5);
    });

    test('il ne coupe pas les coins : il passe par les cases que le héros a traversées', () => {
        const t = resetTrail(createTrail(), 5, 5, 'right');
        walk(t, [5, 5], [10, 5]);
        const seen = [];
        const hero = { x: 10, y: 5 };
        for (let i = 1; i <= 120; i++) {   // le héros tourne vers le haut
            hero.y = 5 - i * 0.07;
            recordHero(t, hero.x, hero.y, 'back');
            stepCompanion(t, hero, 16, 'back');
            seen.push([t.x, t.y]);
        }
        // tant que le compagnon n'a pas franchi le coin (x = 10), il reste sur la ligne y = 5 : jamais en diagonale
        seen.filter(([x]) => x < 9.99).forEach(([, y]) => expect(y).toBeCloseTo(5, 1));
        // puis il remonte derrière le héros, sur la colonne x = 10
        const [lx, ly] = seen[seen.length - 1];
        expect(lx).toBeCloseTo(10, 1);
        expect(ly).toBeGreaterThan(hero.y);
        expect(ly - hero.y).toBeLessThan(FOLLOW_GAP * 1.7);
    });

    test('à l\'arrêt du héros, il rattrape son retard puis s\'immobilise derrière lui, tourné comme lui', () => {
        const t = resetTrail(createTrail(), 3, 3, 'right');
        walk(t, [3, 3], [9, 3], 8);
        for (let i = 0; i < 60; i++) stepCompanion(t, { x: 9, y: 3 }, 16, 'right');
        expect(t.moving).toBe(false);
        expect(Math.abs(9 - t.x - FOLLOW_GAP)).toBeLessThan(0.15);
        expect(t.dir).toBe('right');
    });

    test('un saut du héros (téléportation, changement de carte) efface la piste et replace le compagnon', () => {
        const t = resetTrail(createTrail(), 2, 2, 'front');
        walk(t, [2, 2], [4, 2]);
        recordHero(t, 30, 20, 'back');
        expect(t.pts).toHaveLength(2);
        expect(t.x).toBeCloseTo(30, 6);
        expect(t.y).toBeCloseTo(20 + FOLLOW_GAP, 6);
    });

    test('la piste reste courte (mémoire bornée)', () => {
        const t = resetTrail(createTrail(), 0, 0, 'right');
        walk(t, [0, 0], [40, 0], 9);
        expect(t.pts.length).toBeLessThan(120);
    });

    test('pointBehind : sur une piste en ligne, le point est exactement à l écart demandé ; piste trop courte -> null', () => {
        const t = createTrail();
        t.pts = [{ x: 0, y: 0, s: 0 }, { x: 1, y: 0, s: 1 }, { x: 2, y: 0, s: 2 }];
        t.head = 2;
        expect(pointBehind(t, 0.5)).toEqual({ x: 1.5, y: 0 });
        expect(pointBehind(t, 2)).toEqual({ x: 0, y: 0 });
        expect(pointBehind(t, 2.5)).toBeNull();
    });

    test('dirOfMove : direction de vue d\'un déplacement', () => {
        expect(dirOfMove(1, 0.2)).toBe('right');
        expect(dirOfMove(-1, 0.2)).toBe('left');
        expect(dirOfMove(0.1, 1)).toBe('front');
        expect(dirOfMove(0.1, -1)).toBe('back');
        expect(dirOfMove(0, 0, 'left')).toBe('left');
    });
});
