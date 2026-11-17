// Cohérence force / faiblesse / nature des gabarits d'ennemis (bestiaire du carnet, combat, observation).
// Convention des éléments (elements.js) : rouge = Feu, bleu = Eau, vert = Terre (pierre, sol, montagne, plantes),
// jaune = Air (vent, foudre, vol), violet = Arcane (esprits, fantômes, nuit, lune).
import { readFileSync } from 'fs';
import { strongColorOf, weakColorOf } from '../../bestiary.js';
import { BESTIARY } from '../../tools/bestiary-data.mjs';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(catalog.map(t => [t.id, t]));
const dominant = t => String(t.spellProfile.preferredColors[0]).toLowerCase();

// Nature → couleur dominante attendue (liste explicite, établie à partir des titres, races et notices).
const NATURE = {
    red: ['huo_shen', 'huo_shou', 'chi_niao', 'bi_fang', 'hanba', 'nuba', 'zhuque', 'zhulong_serpent', 'zhulong_torche',
        'chilong', 'pixiu', 'tigre_embrase', 'loup_braise', 'sanglier_flammes', 'garde_solaire', 'jinwu', 'sanzu_wu', 'fenghuang'],
    blue: ['shui_gui', 'shuihou', 'he_bo', 'shui_shen', 'jiao', 'jiaolong', 'hai_ruo', 'hai_shen', 'hai_gui', 'hai_she',
        'ren_yu', 'kun', 'longwang', 'yu_shi', 'canglong', 'dame_des_neiges', 'xue_niao'],
    green: ['houtu', 'dilong', 'shi_jing', 'she_shen', 'fucanglong', 'bixi', 'suanni', 'immortel_jade', 'shan_shen',
        'shan_gui', 'shu_jing', 'mu_mei', 'cao_jing', 'lingzhi_maudit', 'shennong'],
    yellow: ['feng_bo', 'feng_shou', 'lei_gong', 'dian_mu', 'lei_shou', 'tengshe', 'feima', 'nian'],
    purple: ['gui_esprit', 'zu_xian', 'wangxiang', 'mei', 'meng_shou', 'gui_po', 'nu_gui', 'diaosi_gui', 'heibai_wuchang',
        'pretresse_lunaire', 'yutu', 'tiangou_lune', 'jiangshi', 'ming_niao']
};

describe('Bestiaire : force, faiblesse et nature', () => {
    test('force = couleur dominante, jamais égale à la faiblesse, et mieux résistée qu\'elle', () => {
        const bad = catalog.filter(t => {
            const strong = strongColorOf(t), weak = weakColorOf(t), res = t.resistanceProfile;
            return strong !== dominant(t) || strong === weak || !(res[weak] < res[strong]);
        }).map(t => t.id);
        expect(bad).toEqual([]);
    });

    test('la couleur dominante correspond à la nature de la créature', () => {
        const wrong = [];
        Object.entries(NATURE).forEach(([color, ids]) => ids.forEach(id => {
            expect(byId[id]).toBeDefined();
            if (dominant(byId[id]) !== color) wrong.push(`${id}: ${dominant(byId[id])} au lieu de ${color}`);
        }));
        expect(wrong).toEqual([]);
    });

    test('les craintes citées par les notices sont les faiblesses du jeu', () => {
        expect(weakColorOf(byId.nian)).toBe('red');        // le Nian craint le feu et le rouge
        expect(weakColorOf(byId.huo_shou)).toBe('blue');   // les bêtes de cendre ne craignent que la pluie
        expect(weakColorOf(byId.hanba)).toBe('blue');      // démon de la sécheresse
        expect(weakColorOf(byId.nuba)).toBe('blue');
    });

    test('le générateur reste idempotent : couleur de tools/bestiary-data.mjs = couleur dominante du catalogue', () => {
        const drift = BESTIARY.filter(b => byId[b[0]] && dominant(byId[b[0]]) !== b[4]).map(b => b[0]);
        expect(drift).toEqual([]);
    });
});
