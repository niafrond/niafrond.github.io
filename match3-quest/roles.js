// Rôles : chaque classe jouable joue le plateau différemment. Module pur ; board.js applique le résultat.
//   templar  (Garde impérial, « Chevalier ») : rouge = frappe physique, jaune = bouclier (absorbe des dégâts) ;
//   sorcerer (Maître taoïste, « Mage »)      : bleu = magie (+1 mana), un match de 4+ convertit des tuiles en bleu ;
//   assassin (Archer céleste, « Assassin »)  : match court (3) = coup critique ; après 3 matchs d'une même chaîne,
//                                              devient invisible et esquive la prochaine attaque ;
//   alchemist (Alchimiste, pas encore jouable) : vert/violet = potion qui empoisonne l'ennemi.

export const SHIELD_CAP = 24;
export const STEALTH_CHAIN = 3;

export const ROLES = {
    templar: { id: 'templar', name: 'Chevalier', text: 'Rouge : attaque physique. Jaune : bouclier.' },
    sorcerer: { id: 'sorcerer', name: 'Mage', text: 'Bleu : magie (+1 mana). 4 tuiles ou plus : 2 tuiles deviennent bleues.' },
    assassin: { id: 'assassin', name: 'Assassin', text: 'Match de 3 : coup critique. 3 matchs en chaîne : invisible, esquive la prochaine attaque.' },
    alchemist: { id: 'alchemist', name: 'Alchimiste', text: 'Vert/violet : potion qui empoisonne l\'ennemi.' }
};

const none = () => ({ strike: 0, shield: 0, bonusMana: 0, convert: 0, convertColor: null, poison: 0, stealth: false });

// Effets d'un match du joueur : info = { type, color, len } ; chain = nombre de matchs distincts du tour (ce match compris).
export function roleMatchEffects(classId, info, chain = 1) {
    const fx = none();
    if (!ROLES[classId] || !info) return fx;
    const len = Math.max(0, info.len || 0);
    if (classId === 'templar' && info.type === 'color') {
        if (info.color === 'red') fx.strike = len * 2;
        if (info.color === 'yellow') fx.shield = len * 2;
    } else if (classId === 'sorcerer' && info.type === 'color') {
        if (info.color === 'blue') fx.bonusMana = 1;
        if (len >= 4) { fx.convert = 2; fx.convertColor = 'blue'; }
    } else if (classId === 'assassin') {
        if (info.type === 'color' && len === 3) fx.strike = 3;
        if (chain >= STEALTH_CHAIN) fx.stealth = true;
    } else if (classId === 'alchemist' && info.type === 'color' && (info.color === 'green' || info.color === 'purple')) {
        fx.poison = 2;
    }
    return fx;
}

export const addShield = (current, gain) => Math.min(SHIELD_CAP, Math.max(0, current || 0) + gain);
