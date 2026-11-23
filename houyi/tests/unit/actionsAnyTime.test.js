import fs from 'node:fs';

const read = f => fs.readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

describe('actions choisies à tout moment (barre chargée), sans lien avec le tour de plateau', () => {
    test('la classe du tour et la Xiūxiān se choisissent hors du tour de plateau quand les actions sont indépendantes', () => {
        const game = read('game.js');
        expect(game).toMatch(/export function setTurnClass[\s\S]{0,200}currentTurn !== 'player' && !decoupled\(\)/);
        expect(game).toMatch(/export function activateXiuxian[\s\S]{0,200}currentTurn !== 'player' && !decoupled\(\)/);
        expect(read('gameHud.js')).toMatch(/isRageFull\(player\)[^\n]*\(currentTurn === 'player' \|\| decoupled\(\)\)/);
        expect(read('gameHud.js')).toMatch(/!g\.ko && !g\.inXiu && g\.full && \(currentTurn === 'player' \|\| decoupled\(\)\)/);   // Xiūxiān du personnage choisi (compagnon compris)
        expect(read('gameSpellList.js')).toMatch(/const mine = active && \(currentTurn === 'player' \|\| decoupled\(\)\)/);
    });
    test('l\'ennemi chargé choisit aussi ses sorts de plateau hors de son tour (action de plateau, file commune)', () => {
        const flow = read('gameTurnFlow.js');
        const proactive = flow.slice(flow.indexOf('export function enemyProactiveAction'), flow.indexOf('function applyEnemyAction'));
        expect(proactive).toMatch(/boardSpell[\s\S]*castEnemyBoardSpell[\s\S]*, true[,)]/);
        expect(proactive).not.toMatch(/passent par son tour de plateau/);
    });
});

describe('invocations : sorts normaux du Mage invocateur', () => {
    test('elles sont dans la liste de sorts du Mage seulement, sans bouton ni jauge', () => {
        const list = read('gameSpellList.js');
        expect(list).toMatch(/cls === ULTIMATE_CLASS \? getSelectableUltimates\(player\)\.map\(sp => \(\{ \.\.\.sp, invocation: true/);
        expect(read('gameHud.js')).not.toMatch(/castUltimate\(equippedUltimate\.id\)/);
        expect(read('game.js')).toMatch(/spell\.cinematic\) await playUltimateCinematic\(spell\)/);
    });
});
