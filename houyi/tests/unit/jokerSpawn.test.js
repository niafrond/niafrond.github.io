import { describe, test, expect } from '@jest/globals';
import { collectMatches, getJokerSpawnIndex, pickJokerSpawns } from '../../matchMechanics.js';
import { boardSize } from '../../constants.js';

const mk = () => new Array(boardSize * boardSize).fill(null).map((_, i) => ['red', 'green', 'blue', 'yellow'][(i * 7 + Math.floor(i / boardSize)) % 4]);
const withJoker = (matches) => matches.forEach((m) => { if (m.info.len >= 5) m.info.makeJoker = true; });

describe('position du joker x5', () => {
    test('indice médian d\'un alignement', () => {
        expect(getJokerSpawnIndex([10, 11, 12, 13, 14])).toBe(12);
        expect(getJokerSpawnIndex([10, 11, 12, 13])).toBe(11);
        expect(getJokerSpawnIndex([])).toBeNull();
    });

    test('alignement de 5 horizontal : joker au centre', () => {
        const board = mk();
        for (let c = 1; c <= 5; c++) board[2 * boardSize + c] = 'combat';
        const ms = collectMatches(board).filter((m) => m.info.type === 'combat');
        withJoker(ms);
        const spawns = pickJokerSpawns(ms);
        expect(spawns).toHaveLength(1);
        expect(spawns[0].index).toBe(2 * boardSize + 3);
    });

    test('alignement de 5 vertical : joker au centre', () => {
        const board = mk();
        for (let r = 0; r < 5; r++) board[r * boardSize + 6] = 'skull';
        const ms = collectMatches(board).filter((m) => m.info.type === 'skull');
        withJoker(ms);
        expect(pickJokerSpawns(ms)[0].index).toBe(2 * boardSize + 6);
    });

    test('croix / T : un seul joker, au centre du run le plus long ; déterministe', () => {
        const board = mk();
        for (let c = 1; c <= 5; c++) board[3 * boardSize + c] = 'combat'; // 5 horizontaux
        for (let r = 1; r <= 3; r++) board[r * boardSize + 3] = 'combat'; // 3 verticaux croisés en (3,3)
        const ms = collectMatches(board).filter((m) => m.info.type === 'combat');
        ms.forEach((m) => { m.info.makeJoker = true; });
        const a = pickJokerSpawns(ms);
        const b = pickJokerSpawns([...ms].reverse().reverse());
        expect(a).toHaveLength(1);
        expect(a[0].index).toBe(3 * boardSize + 3);
        expect(a[0].match.info.len).toBe(5);
        expect(b[0].index).toBe(a[0].index);
    });

    test('deux alignements séparés : un joker chacun ; sans makeJoker : aucun', () => {
        const board = mk();
        for (let c = 0; c < 5; c++) board[0 * boardSize + c] = 'combat';
        for (let c = 0; c < 5; c++) board[7 * boardSize + c] = 'skull';
        const ms = collectMatches(board).filter((m) => m.info.len >= 5);
        expect(pickJokerSpawns(ms)).toHaveLength(0);
        withJoker(ms);
        expect(pickJokerSpawns(ms).map((s) => s.index).sort((x, y) => x - y)).toEqual([2, 7 * boardSize + 2]);
    });
});
