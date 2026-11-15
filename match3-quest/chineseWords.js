// « Un mot de chinois » : à la fin de chaque combat, un mot en chinois simplifié (pinyin, traduction, prononciation) tiré du monde du jeu :
// le héros, les dieux, les éléments, les créatures et les lieux. Les mots sont rangés en LOTS de cinq (thème commun) pour être mémorisés
// ensemble : un lot repasse `LOT_PASSES` fois, dans le même ordre, puis le lot suivant arrive ; un mot coché « je connais » n'est plus montré.
// Après les lots thématiques viennent les noms des créatures du bestiaire dont la traduction apprend un vrai mot (bestiaryNames.js).
// Module pur : le stockage est injecté. La prononciation est un mp3 par mot (audio/noms/, tools/gen-name-audio.py), chargé au clic (nameAudio.js).
import { BESTIARY_NAMES } from './bestiaryNames.js';
import { LITERAL_BY_HANZI } from './bestiaryLiteral.js';

export const LOT_SIZE = 5;
export const LOT_PASSES = 3;
export const LOT_TITLES = ["La légende", "Le héros", "Créatures", "Esprits et dieux", "Mythes et lieux", "Les cinq éléments", "Énergie et paysages", "Nature des régions", "Villages et PNJ", "Mots du quotidien"];
const CURATED_LOTS = [
    // Lot 1 : La légende
    [
        { hanzi: '后羿', pinyin: 'Hòu Yì', fr: 'Houyi, l\'archer (le héros)', hint: 'Il abat neuf des dix soleils.' },
        { hanzi: '嫦娥', pinyin: 'Cháng\'é', fr: 'Chang\'e, déesse de la lune', hint: 'Épouse de Houyi, elle boit l\'élixir d\'immortalité.' },
        { hanzi: '太阳', pinyin: 'tài yáng', fr: 'soleil', hint: 'Il y en avait dix dans le ciel.' },
        { hanzi: '十日', pinyin: 'shí rì', fr: 'les dix soleils', hint: 'Les fils de Di Jun, qui brûlaient la terre.' },
        { hanzi: '月亮', pinyin: 'yuè liang', fr: 'lune', hint: 'Là où vit Chang\'e, avec le lièvre de jade.' }
    ],
    // Lot 2 : Le héros
    [
        { hanzi: '弓', pinyin: 'gōng', fr: 'arc', hint: 'L\'arme de Houyi.' },
        { hanzi: '箭', pinyin: 'jiàn', fr: 'flèche', hint: 'Une flèche, un soleil.' },
        { hanzi: '射', pinyin: 'shè', fr: 'tirer (à l\'arc)', hint: 'Le geste du héros.' },
        { hanzi: '英雄', pinyin: 'yīng xióng', fr: 'héros', hint: 'C\'est vous.' },
        { hanzi: '勇敢', pinyin: 'yǒng gǎn', fr: 'courageux', hint: 'Ce qu\'il faut pour affronter un dragon.' }
    ],
    // Lot 3 : Créatures
    [
        { hanzi: '龙', pinyin: 'lóng', fr: 'dragon', hint: 'Dragons de rivière, de feu, de jade… partout dans la légende.' },
        { hanzi: '凤凰', pinyin: 'fèng huáng', fr: 'phénix', hint: 'L\'oiseau qui renaît de ses cendres.' },
        { hanzi: '老虎', pinyin: 'lǎo hǔ', fr: 'tigre', hint: 'Les tigres des plaines gardent leurs crocs.' },
        { hanzi: '狐狸', pinyin: 'hú li', fr: 'renard', hint: 'Les renards-esprits changent de visage.' },
        { hanzi: '蛇', pinyin: 'shé', fr: 'serpent', hint: 'Les serpents des marais sont venimeux.' }
    ],
    // Lot 4 : Esprits et dieux
    [
        { hanzi: '鸟', pinyin: 'niǎo', fr: 'oiseau', hint: 'Les oiseaux rouges annoncent le feu.' },
        { hanzi: '鬼', pinyin: 'guǐ', fr: 'fantôme, esprit des morts', hint: 'Ils errent dans le royaume des âmes.' },
        { hanzi: '神', pinyin: 'shén', fr: 'dieu, divinité', hint: 'Le dieu du feu, du tonnerre, des épidémies…' },
        { hanzi: '仙', pinyin: 'xiān', fr: 'immortel', hint: 'Les immortels vivent au-dessus des nuages.' },
        { hanzi: '皇帝', pinyin: 'huáng dì', fr: 'empereur', hint: 'Celui qui vous a demandé d\'abattre les soleils.' }
    ],
    // Lot 5 : Mythes et lieux
    [
        { hanzi: '帝俊', pinyin: 'Dì Jùn', fr: 'Di Jun, père des dix soleils', hint: 'Un dieu qui ne vous pardonnera pas.' },
        { hanzi: '西王母', pinyin: 'Xī Wáng Mǔ', fr: 'la Reine Mère de l\'Ouest', hint: 'Elle garde l\'élixir de longue vie.' },
        { hanzi: '桃', pinyin: 'táo', fr: 'pêche', hint: 'Les pêches d\'immortalité mûrissent tous les trois mille ans.' },
        { hanzi: '扶桑', pinyin: 'Fú Sāng', fr: 'Fusang, l\'arbre où se posent les soleils', hint: 'Une région de la légende.' },
        { hanzi: '药', pinyin: 'yào', fr: 'remède, élixir', hint: 'L\'élixir d\'immortalité en est un.' }
    ],
    // Lot 6 : Les cinq éléments
    [
        { hanzi: '火', pinyin: 'huǒ', fr: 'feu', hint: 'L\'élément rouge, celui du volcan.' },
        { hanzi: '水', pinyin: 'shuǐ', fr: 'eau', hint: 'L\'élément bleu, celui du fleuve et de la mer.' },
        { hanzi: '木', pinyin: 'mù', fr: 'bois, arbre', hint: 'L\'élément vert, celui des bambous.' },
        { hanzi: '金', pinyin: 'jīn', fr: 'or, métal', hint: 'L\'élément jaune, celui des pièces.' },
        { hanzi: '土', pinyin: 'tǔ', fr: 'terre', hint: 'Le sol des rizières et du désert.' }
    ],
    // Lot 7 : Énergie et paysages
    [
        { hanzi: '五行', pinyin: 'wǔ xíng', fr: 'les cinq éléments', hint: 'Feu, eau, bois, métal, terre : les cinq couleurs de qì.' },
        { hanzi: '气', pinyin: 'qì', fr: 'souffle vital, énergie', hint: 'Ce que vous gagnez en alignant les gemmes.' },
        { hanzi: '力量', pinyin: 'lì liang', fr: 'force, puissance', hint: 'Ce que vos points d\'attribut vous donnent.' },
        { hanzi: '山', pinyin: 'shān', fr: 'montagne', hint: 'Le tonnerre gronde au sommet.' },
        { hanzi: '河', pinyin: 'hé', fr: 'fleuve', hint: 'Le Fleuve Jaune.' }
    ],
    // Lot 8 : Nature des régions
    [
        { hanzi: '海', pinyin: 'hǎi', fr: 'mer', hint: 'La Mer d\'Orient, où dérivent les rangées.' },
        { hanzi: '雷', pinyin: 'léi', fr: 'tonnerre', hint: 'Le duc du Tonnerre en est le maître.' },
        { hanzi: '雪', pinyin: 'xuě', fr: 'neige', hint: 'Elle gèle les cases du plateau.' },
        { hanzi: '竹', pinyin: 'zhú', fr: 'bambou', hint: 'Il pousse sur les cases du plateau.' },
        { hanzi: '稻', pinyin: 'dào', fr: 'riz (plante)', hint: 'Les rizières, là où tout commence.' }
    ],
    // Lot 9 : Villages et PNJ
    [
        { hanzi: '村庄', pinyin: 'cūn zhuāng', fr: 'village', hint: 'Où l\'on trouve marchands et anciens.' },
        { hanzi: '商人', pinyin: 'shāng rén', fr: 'marchand', hint: 'Ils vendent le meilleur stuff, très cher.' },
        { hanzi: '长老', pinyin: 'zhǎng lǎo', fr: 'ancien, doyen', hint: 'Doyen Wen confie la première quête.' },
        { hanzi: '朋友', pinyin: 'péng you', fr: 'ami', hint: 'Les compagnons qui vous suivent.' },
        { hanzi: '你好', pinyin: 'nǐ hǎo', fr: 'bonjour', hint: 'Pour saluer les villageois.' }
    ],
    // Lot 10 : Mots du quotidien
    [
        { hanzi: '谢谢', pinyin: 'xiè xie', fr: 'merci', hint: 'À dire après chaque quête rendue.' },
        { hanzi: '胜利', pinyin: 'shèng lì', fr: 'victoire', hint: 'Comme à l\'instant.' },
        { hanzi: '失败', pinyin: 'shī bài', fr: 'défaite, échec', hint: 'On apprend plus de ses défaites.' }
    ]
];

const stripTones = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s'’-]/g, '').toLowerCase();
const lowerFirst = t => t.replace(/\s*\/\s*/g, ', ').replace(/^./, c => c.toLowerCase());

/** Noms de créatures dont la traduction littérale apprend un vrai mot (pas un simple nom propre : « Yinglong »), sans doublon ni mot déjà vu. */
export function creatureWords(exclude = new Set()) {
    const seen = new Set(exclude), out = [];
    Object.values(BESTIARY_NAMES).forEach(([pinyin, hanzi]) => {
        const literal = LITERAL_BY_HANZI[hanzi];
        if (!literal || seen.has(hanzi) || stripTones(literal) === stripTones(pinyin)) return;
        seen.add(hanzi);
        out.push({ hanzi, pinyin, fr: lowerFirst(literal), hint: 'Le nom d\'une créature de la légende.' });
    });
    return out;
}

const chunk = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const curatedHanzi = new Set(CURATED_LOTS.flat().map(w => w.hanzi));
/** Tous les lots, dans l'ordre : lots thématiques puis lots de créatures. */
export const LESSON_LOTS = [...CURATED_LOTS, ...chunk(creatureWords(curatedHanzi), LOT_SIZE)];
export const LESSON_WORDS = LESSON_LOTS.flat();
export const lotTitle = i => LOT_TITLES[i] || 'Créatures';

export const LESSON_STORAGE_KEY = 'match3quest.zhLesson';
const blank = () => ({ lot: 0, pos: 0, passes: 0, known: [] });
function load(storage) {
    try {
        const raw = JSON.parse(storage?.getItem(LESSON_STORAGE_KEY) || 'null');
        if (raw && typeof raw === 'object') return { ...blank(), ...raw, known: Array.isArray(raw.known) ? raw.known.filter(h => typeof h === 'string') : [] };
    } catch { /* stockage illisible : on repart de zéro */ }
    return blank();
}
function save(storage, p) { try { storage?.setItem(LESSON_STORAGE_KEY, JSON.stringify(p)); } catch { /* ignoré */ } }

export const knownWords = (storage = globalThis.localStorage) => new Set(load(storage).known);
export function setKnown(hanzi, known, storage = globalThis.localStorage) {
    const p = load(storage);
    const set = new Set(p.known);
    if (known) set.add(hanzi); else set.delete(hanzi);
    p.known = [...set];
    save(storage, p);
    return known;
}

/**
 * Prochain mot : on parcourt les mots encore inconnus du lot courant dans l'ordre, `LOT_PASSES` fois, puis on passe au lot suivant ; un lot
 * entièrement connu est sauté. Renvoie { …mot, lot, lotCount, rank, rankCount } ou null quand tous les mots sont connus.
 */
export function nextLesson(storage = globalThis.localStorage) {
    const p = load(storage);
    const known = new Set(p.known);
    if (LESSON_WORDS.every(w => known.has(w.hanzi))) return null;
    for (let guard = 0; guard <= LESSON_LOTS.length; guard++) {
        p.lot = ((p.lot % LESSON_LOTS.length) + LESSON_LOTS.length) % LESSON_LOTS.length;
        const unknown = LESSON_LOTS[p.lot].filter(w => !known.has(w.hanzi));
        if (!unknown.length || p.passes >= LOT_PASSES) { p.lot = (p.lot + 1) % LESSON_LOTS.length; p.pos = 0; p.passes = 0; continue; }
        const rank = p.pos % unknown.length;
        const word = unknown[rank];
        p.pos = rank + 1;
        if (p.pos >= unknown.length) { p.pos = 0; p.passes++; }
        save(storage, p);
        return { ...word, lot: p.lot, lotCount: LESSON_LOTS.length, rank: rank + 1, rankCount: unknown.length };
    }
    return null;
}
