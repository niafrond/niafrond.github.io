import { describe, it, expect } from '@jest/globals';
import { spellTarget, weaponTarget, isAreaSpell, TARGET } from '../../targeting.js';

describe('ciblage des sorts et des armes', () => {
    it('un sort ciblé par défaut, de zone si listé ou si son texte l\'indique', () => {
        expect(spellTarget({ id: 'fireball', dmg: 25, name: 'Souffle', description: 'sur l\'ennemi' })).toBe(TARGET.SINGLE);
        expect(isAreaSpell({ id: 'blizzard', dmg: 85 })).toBe(true);
        expect(spellTarget({ id: 'x', dmg: 10, name: 'Pluie de feu', description: '' })).toBe(TARGET.AREA);
        expect(spellTarget({ id: 'x', heal: 10, name: 'Pluie de soin' })).toBe(TARGET.SINGLE);   // sans dégâts : pas de zone
    });
    it('le champ target l\'emporte', () => {
        expect(spellTarget({ id: 'blizzard', target: 'single' })).toBe(TARGET.SINGLE);
        expect(spellTarget({ id: 'fireball', target: 'area' })).toBe(TARGET.AREA);
        expect(spellTarget({ id: 'fiveHarmony', dmg: 100, description: 'tout' })).toBe(TARGET.SINGLE);
    });
    it('armes : ciblées sauf éventail ou champ target', () => {
        expect(weaponTarget({ type: 'bow' })).toBe(TARGET.SINGLE);
        expect(weaponTarget({ type: 'fan' })).toBe(TARGET.AREA);
        expect(weaponTarget({ type: 'bow', target: 'area' })).toBe(TARGET.AREA);
    });
});
