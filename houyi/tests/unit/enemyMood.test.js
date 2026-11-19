import { readFileSync } from 'fs';
import { PERSONALITIES as enemyPersonalities } from '../../enemyAIProfiles.js';

const hud = readFileSync(new URL('../../gameHud.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../style-hud.css', import.meta.url), 'utf8');

describe('ennemi de tempérament agressif : « en colère » derrière son nom', () => {
    test('le tempérament « agressif » existe sous la clé lue par la fiche de combat', () => {
        expect(enemyPersonalities.aggressive.name).toBe('Agressif');
    });
    test("la fiche de l'ennemi ajoute l'étiquette seulement pour ce tempérament, juste après le nom", () => {
        const tag = `enemy.personality === 'aggressive' ? '<span class="enemy-mood">en colère</span>' : ''`;
        expect(hud).toContain(`enemyNameLabel(enemy, enemyNameAsHanzi()))}</span>${'${' + tag + '}'}`);
        expect(css).toContain('.enemy-mood');
    });
    test("la fiche du héros n'a pas d'étiquette", () => {
        expect((hud.match(/enemy-mood/g) || []).length).toBe(1);
    });
});
