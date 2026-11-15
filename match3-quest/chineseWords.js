// « Un mot de chinois » : à la fin de chaque combat, un mot en chinois simplifié (pinyin, traduction, prononciation) tiré du monde du jeu :
// le héros, les dieux, les éléments, les créatures et les lieux. Les mots sont rangés en LOTS de cinq (thème commun) pour être mémorisés
// ensemble : un lot repasse `LOT_PASSES` fois, dans le même ordre, puis le lot suivant arrive ; un mot coché « je connais » n'est plus montré.
// Après les lots de la légende viennent des mots usuels du chinois de tous les jours (des phrases en fin de série), puis quatre lots de noms de créatures du bestiaire dont la traduction apprend un vrai mot (bestiaryNames.js).
// Module pur : le stockage est injecté. La prononciation est un mp3 par mot (audio/noms/, tools/gen-name-audio.py), chargé au clic (nameAudio.js).
import { BESTIARY_NAMES } from './bestiaryNames.js';
import { LITERAL_BY_HANZI } from './bestiaryLiteral.js';

export const LOT_SIZE = 5;
export const LOT_PASSES = 3;
export const LOT_TITLES = ["La légende", "Le héros", "Créatures", "Esprits et dieux", "Mythes et lieux", "Les cinq éléments", "Énergie et paysages", "Nature des régions", "Villages et PNJ", "Victoire et merci", "Les nombres (1)", "Les nombres (2)", "La famille", "Les pronoms", "Verbes courants (1)", "Verbes courants (2)", "Adjectifs", "Le temps", "Lieux usuels", "Manger et boire", "Les couleurs", "Poser une question", "Politesse", "Le corps", "Animaux usuels", "La météo", "Le calendrier", "Objets du quotidien", "Les gens", "Verbes courants (3)", "Verbes courants (4)", "Adjectifs (2)", "Adjectifs (3)", "Les directions", "Petits mots de grammaire", "Phrases : salutations", "Phrases : se présenter", "Phrases : se faire comprendre", "Phrases : acheter", "Phrases : se déplacer", "Phrases : au restaurant", "Phrases : en route, héros !", "Phrases : au quotidien"];
// Mots usuels du chinois de tous les jours (sans rapport avec la légende), avant les noms de créatures.
const USUAL_LOTS = [
    [
        { hanzi: "一", pinyin: "yī", fr: "un" },
        { hanzi: "二", pinyin: "èr", fr: "deux" },
        { hanzi: "三", pinyin: "sān", fr: "trois" },
        { hanzi: "四", pinyin: "sì", fr: "quatre" },
        { hanzi: "五", pinyin: "wǔ", fr: "cinq" }
    ],
    [
        { hanzi: "六", pinyin: "liù", fr: "six" },
        { hanzi: "七", pinyin: "qī", fr: "sept" },
        { hanzi: "八", pinyin: "bā", fr: "huit" },
        { hanzi: "九", pinyin: "jiǔ", fr: "neuf" },
        { hanzi: "十", pinyin: "shí", fr: "dix" }
    ],
    [
        { hanzi: "爸爸", pinyin: "bà ba", fr: "papa" },
        { hanzi: "妈妈", pinyin: "mā ma", fr: "maman" },
        { hanzi: "哥哥", pinyin: "gē ge", fr: "grand frère" },
        { hanzi: "姐姐", pinyin: "jiě jie", fr: "grande sœur" },
        { hanzi: "孩子", pinyin: "hái zi", fr: "enfant" }
    ],
    [
        { hanzi: "我", pinyin: "wǒ", fr: "je, moi" },
        { hanzi: "你", pinyin: "nǐ", fr: "tu, toi" },
        { hanzi: "他", pinyin: "tā", fr: "il, lui" },
        { hanzi: "她", pinyin: "tā", fr: "elle" },
        { hanzi: "我们", pinyin: "wǒ men", fr: "nous" }
    ],
    [
        { hanzi: "吃", pinyin: "chī", fr: "manger" },
        { hanzi: "喝", pinyin: "hē", fr: "boire" },
        { hanzi: "去", pinyin: "qù", fr: "aller" },
        { hanzi: "来", pinyin: "lái", fr: "venir" },
        { hanzi: "看", pinyin: "kàn", fr: "regarder" }
    ],
    [
        { hanzi: "说", pinyin: "shuō", fr: "parler" },
        { hanzi: "听", pinyin: "tīng", fr: "écouter" },
        { hanzi: "想", pinyin: "xiǎng", fr: "penser, vouloir" },
        { hanzi: "要", pinyin: "yào", fr: "vouloir, avoir besoin de" },
        { hanzi: "有", pinyin: "yǒu", fr: "avoir" }
    ],
    [
        { hanzi: "大", pinyin: "dà", fr: "grand" },
        { hanzi: "小", pinyin: "xiǎo", fr: "petit" },
        { hanzi: "好", pinyin: "hǎo", fr: "bon, bien" },
        { hanzi: "多", pinyin: "duō", fr: "beaucoup" },
        { hanzi: "少", pinyin: "shǎo", fr: "peu" }
    ],
    [
        { hanzi: "今天", pinyin: "jīn tiān", fr: "aujourd'hui" },
        { hanzi: "明天", pinyin: "míng tiān", fr: "demain" },
        { hanzi: "昨天", pinyin: "zuó tiān", fr: "hier" },
        { hanzi: "现在", pinyin: "xiàn zài", fr: "maintenant" },
        { hanzi: "时间", pinyin: "shí jiān", fr: "temps" }
    ],
    [
        { hanzi: "家", pinyin: "jiā", fr: "maison, famille" },
        { hanzi: "学校", pinyin: "xué xiào", fr: "école" },
        { hanzi: "城市", pinyin: "chéng shì", fr: "ville" },
        { hanzi: "路", pinyin: "lù", fr: "route, chemin" },
        { hanzi: "中国", pinyin: "Zhōng guó", fr: "Chine" }
    ],
    [
        { hanzi: "米饭", pinyin: "mǐ fàn", fr: "riz cuit" },
        { hanzi: "水果", pinyin: "shuǐ guǒ", fr: "fruit" },
        { hanzi: "茶", pinyin: "chá", fr: "thé" },
        { hanzi: "面条", pinyin: "miàn tiáo", fr: "nouilles" },
        { hanzi: "肉", pinyin: "ròu", fr: "viande" }
    ],
    [
        { hanzi: "红", pinyin: "hóng", fr: "rouge" },
        { hanzi: "蓝", pinyin: "lán", fr: "bleu" },
        { hanzi: "绿", pinyin: "lǜ", fr: "vert" },
        { hanzi: "黄", pinyin: "huáng", fr: "jaune" },
        { hanzi: "白", pinyin: "bái", fr: "blanc" }
    ],
    [
        { hanzi: "什么", pinyin: "shén me", fr: "quoi, quel" },
        { hanzi: "谁", pinyin: "shéi", fr: "qui" },
        { hanzi: "哪里", pinyin: "nǎ li", fr: "où" },
        { hanzi: "为什么", pinyin: "wèi shén me", fr: "pourquoi" },
        { hanzi: "怎么", pinyin: "zěn me", fr: "comment" }
    ],
    [
        { hanzi: "请", pinyin: "qǐng", fr: "s'il vous plaît" },
        { hanzi: "对不起", pinyin: "duì bu qǐ", fr: "pardon, désolé" },
        { hanzi: "再见", pinyin: "zài jiàn", fr: "au revoir" },
        { hanzi: "没关系", pinyin: "méi guān xi", fr: "ce n'est pas grave" },
        { hanzi: "不客气", pinyin: "bú kè qi", fr: "de rien" }
    ],
    [
        { hanzi: "头", pinyin: "tóu", fr: "tête" },
        { hanzi: "手", pinyin: "shǒu", fr: "main" },
        { hanzi: "眼睛", pinyin: "yǎn jing", fr: "yeux" },
        { hanzi: "嘴", pinyin: "zuǐ", fr: "bouche" },
        { hanzi: "心", pinyin: "xīn", fr: "cœur" }
    ],
    [
        { hanzi: "狗", pinyin: "gǒu", fr: "chien" },
        { hanzi: "猫", pinyin: "māo", fr: "chat" },
        { hanzi: "马", pinyin: "mǎ", fr: "cheval" },
        { hanzi: "鱼", pinyin: "yú", fr: "poisson" },
        { hanzi: "牛", pinyin: "niú", fr: "vache, bœuf" }
    ],
    [
        { hanzi: "天", pinyin: "tiān", fr: "ciel, jour" },
        { hanzi: "地", pinyin: "dì", fr: "terre, sol" },
        { hanzi: "风", pinyin: "fēng", fr: "vent" },
        { hanzi: "雨", pinyin: "yǔ", fr: "pluie" },
        { hanzi: "花", pinyin: "huā", fr: "fleur" }
    ],
    [
        { hanzi: "年", pinyin: "nián", fr: "année" },
        { hanzi: "月", pinyin: "yuè", fr: "mois" },
        { hanzi: "日", pinyin: "rì", fr: "jour (date)" },
        { hanzi: "星期", pinyin: "xīng qī", fr: "semaine" },
        { hanzi: "早上", pinyin: "zǎo shang", fr: "matin" }
    ],
    [
        { hanzi: "书", pinyin: "shū", fr: "livre" },
        { hanzi: "门", pinyin: "mén", fr: "porte" },
        { hanzi: "车", pinyin: "chē", fr: "voiture" },
        { hanzi: "钱", pinyin: "qián", fr: "argent" },
        { hanzi: "手机", pinyin: "shǒu jī", fr: "téléphone portable" }
    ],
    [
        { hanzi: "人", pinyin: "rén", fr: "personne" },
        { hanzi: "男人", pinyin: "nán rén", fr: "homme" },
        { hanzi: "女人", pinyin: "nǚ rén", fr: "femme" },
        { hanzi: "老师", pinyin: "lǎo shī", fr: "professeur" },
        { hanzi: "学生", pinyin: "xué sheng", fr: "élève, étudiant" }
    ],
    [
        { hanzi: "做", pinyin: "zuò", fr: "faire" },
        { hanzi: "买", pinyin: "mǎi", fr: "acheter" },
        { hanzi: "卖", pinyin: "mài", fr: "vendre" },
        { hanzi: "学", pinyin: "xué", fr: "apprendre" },
        { hanzi: "爱", pinyin: "ài", fr: "aimer" }
    ],
    [
        { hanzi: "走", pinyin: "zǒu", fr: "marcher, partir" },
        { hanzi: "坐", pinyin: "zuò", fr: "s'asseoir" },
        { hanzi: "睡觉", pinyin: "shuì jiào", fr: "dormir" },
        { hanzi: "住", pinyin: "zhù", fr: "habiter" },
        { hanzi: "工作", pinyin: "gōng zuò", fr: "travailler" }
    ],
    [
        { hanzi: "新", pinyin: "xīn", fr: "nouveau" },
        { hanzi: "老", pinyin: "lǎo", fr: "vieux" },
        { hanzi: "高", pinyin: "gāo", fr: "grand, haut" },
        { hanzi: "快", pinyin: "kuài", fr: "rapide" },
        { hanzi: "慢", pinyin: "màn", fr: "lent" }
    ],
    [
        { hanzi: "热", pinyin: "rè", fr: "chaud" },
        { hanzi: "冷", pinyin: "lěng", fr: "froid" },
        { hanzi: "贵", pinyin: "guì", fr: "cher" },
        { hanzi: "便宜", pinyin: "pián yi", fr: "bon marché" },
        { hanzi: "漂亮", pinyin: "piào liang", fr: "joli" }
    ],
    [
        { hanzi: "上", pinyin: "shàng", fr: "haut, sur" },
        { hanzi: "下", pinyin: "xià", fr: "bas, sous" },
        { hanzi: "左", pinyin: "zuǒ", fr: "gauche" },
        { hanzi: "右", pinyin: "yòu", fr: "droite" },
        { hanzi: "里", pinyin: "lǐ", fr: "dedans, intérieur" }
    ],
    [
        { hanzi: "是", pinyin: "shì", fr: "être" },
        { hanzi: "不", pinyin: "bù", fr: "ne… pas" },
        { hanzi: "没有", pinyin: "méi yǒu", fr: "ne pas avoir" },
        { hanzi: "的", pinyin: "de", fr: "de (particule d'appartenance)" },
        { hanzi: "吗", pinyin: "ma", fr: "(particule de question)" }
    ],
    [
        { hanzi: "你好吗？", pinyin: "nǐ hǎo ma?", fr: "Comment vas-tu ?" },
        { hanzi: "我很好", pinyin: "wǒ hěn hǎo", fr: "Je vais bien" },
        { hanzi: "早上好", pinyin: "zǎo shang hǎo", fr: "Bonjour (le matin)" },
        { hanzi: "晚安", pinyin: "wǎn ān", fr: "Bonne nuit" },
        { hanzi: "好久不见", pinyin: "hǎo jiǔ bú jiàn", fr: "Ça fait longtemps !" }
    ],
    [
        { hanzi: "我叫后羿", pinyin: "wǒ jiào Hòu Yì", fr: "Je m'appelle Houyi" },
        { hanzi: "你叫什么名字？", pinyin: "nǐ jiào shén me míng zi?", fr: "Comment t'appelles-tu ?" },
        { hanzi: "我是法国人", pinyin: "wǒ shì Fǎ guó rén", fr: "Je suis français(e)" },
        { hanzi: "我会说一点中文", pinyin: "wǒ huì shuō yì diǎn Zhōng wén", fr: "Je parle un peu chinois" },
        { hanzi: "很高兴认识你", pinyin: "hěn gāo xìng rèn shi nǐ", fr: "Enchanté de te rencontrer" }
    ],
    [
        { hanzi: "我不懂", pinyin: "wǒ bù dǒng", fr: "Je ne comprends pas" },
        { hanzi: "请再说一遍", pinyin: "qǐng zài shuō yí biàn", fr: "Répétez, s'il vous plaît" },
        { hanzi: "请说慢一点", pinyin: "qǐng shuō màn yì diǎn", fr: "Parlez plus lentement, s'il vous plaît" },
        { hanzi: "这是什么？", pinyin: "zhè shì shén me?", fr: "Qu'est-ce que c'est ?" },
        { hanzi: "中文怎么说？", pinyin: "Zhōng wén zěn me shuō?", fr: "Comment dit-on cela en chinois ?" }
    ],
    [
        { hanzi: "多少钱？", pinyin: "duō shao qián?", fr: "Combien ça coûte ?" },
        { hanzi: "太贵了", pinyin: "tài guì le", fr: "C'est trop cher" },
        { hanzi: "便宜一点", pinyin: "pián yi yì diǎn", fr: "Un peu moins cher" },
        { hanzi: "我要这个", pinyin: "wǒ yào zhè ge", fr: "Je prends celui-ci" },
        { hanzi: "我想买茶", pinyin: "wǒ xiǎng mǎi chá", fr: "Je voudrais acheter du thé" }
    ],
    [
        { hanzi: "请问，怎么走？", pinyin: "qǐng wèn, zěn me zǒu?", fr: "Excusez-moi, comment y aller ?" },
        { hanzi: "厕所在哪里？", pinyin: "cè suǒ zài nǎ li?", fr: "Où sont les toilettes ?" },
        { hanzi: "往左走", pinyin: "wǎng zuǒ zǒu", fr: "Allez à gauche" },
        { hanzi: "往右走", pinyin: "wǎng yòu zǒu", fr: "Allez à droite" },
        { hanzi: "我迷路了", pinyin: "wǒ mí lù le", fr: "Je suis perdu" }
    ],
    [
        { hanzi: "我饿了", pinyin: "wǒ è le", fr: "J'ai faim" },
        { hanzi: "我渴了", pinyin: "wǒ kě le", fr: "J'ai soif" },
        { hanzi: "很好吃", pinyin: "hěn hǎo chī", fr: "C'est délicieux" },
        { hanzi: "来一杯茶", pinyin: "lái yì bēi chá", fr: "Un thé, s'il vous plaît" },
        { hanzi: "买单", pinyin: "mǎi dān", fr: "L'addition, s'il vous plaît" }
    ],
    [
        { hanzi: "我要射太阳", pinyin: "wǒ yào shè tài yáng", fr: "Je vais tirer sur les soleils" },
        { hanzi: "小心！", pinyin: "xiǎo xīn!", fr: "Attention !" },
        { hanzi: "加油！", pinyin: "jiā yóu!", fr: "Courage ! Allez !" },
        { hanzi: "我们走吧", pinyin: "wǒ men zǒu ba", fr: "Allons-y" },
        { hanzi: "祝你好运", pinyin: "zhù nǐ hǎo yùn", fr: "Bonne chance" }
    ],
    [
        { hanzi: "明天见", pinyin: "míng tiān jiàn", fr: "À demain" },
        { hanzi: "我爱你", pinyin: "wǒ ài nǐ", fr: "Je t'aime" },
        { hanzi: "没问题", pinyin: "méi wèn tí", fr: "Pas de problème" },
        { hanzi: "慢走", pinyin: "màn zǒu", fr: "Bon retour ! (à celui qui part)" },
        { hanzi: "欢迎", pinyin: "huān yíng", fr: "Bienvenue" }
    ]
];
const CURATED_LOTS = [
    // Lot 1 : La légende
    [
        { hanzi: '后羿', pinyin: 'Hòu Yì', fr: 'Houyi, l\'archer (le héros)' },
        { hanzi: '嫦娥', pinyin: 'Cháng\'é', fr: 'Chang\'e, déesse de la lune' },
        { hanzi: '太阳', pinyin: 'tài yáng', fr: 'soleil' },
        { hanzi: '十日', pinyin: 'shí rì', fr: 'les dix soleils' },
        { hanzi: '月亮', pinyin: 'yuè liang', fr: 'lune' }
    ],
    // Lot 2 : Le héros
    [
        { hanzi: '弓', pinyin: 'gōng', fr: 'arc' },
        { hanzi: '箭', pinyin: 'jiàn', fr: 'flèche' },
        { hanzi: '射', pinyin: 'shè', fr: 'tirer (à l\'arc)' },
        { hanzi: '英雄', pinyin: 'yīng xióng', fr: 'héros' },
        { hanzi: '勇敢', pinyin: 'yǒng gǎn', fr: 'courageux' }
    ],
    // Lot 3 : Créatures
    [
        { hanzi: '龙', pinyin: 'lóng', fr: 'dragon' },
        { hanzi: '凤凰', pinyin: 'fèng huáng', fr: 'phénix' },
        { hanzi: '老虎', pinyin: 'lǎo hǔ', fr: 'tigre' },
        { hanzi: '狐狸', pinyin: 'hú li', fr: 'renard' },
        { hanzi: '蛇', pinyin: 'shé', fr: 'serpent' }
    ],
    // Lot 4 : Esprits et dieux
    [
        { hanzi: '鸟', pinyin: 'niǎo', fr: 'oiseau' },
        { hanzi: '鬼', pinyin: 'guǐ', fr: 'fantôme, esprit des morts' },
        { hanzi: '神', pinyin: 'shén', fr: 'dieu, divinité' },
        { hanzi: '仙', pinyin: 'xiān', fr: 'immortel' },
        { hanzi: '皇帝', pinyin: 'huáng dì', fr: 'empereur' }
    ],
    // Lot 5 : Mythes et lieux
    [
        { hanzi: '帝俊', pinyin: 'Dì Jùn', fr: 'Di Jun, père des dix soleils' },
        { hanzi: '西王母', pinyin: 'Xī Wáng Mǔ', fr: 'la Reine Mère de l\'Ouest' },
        { hanzi: '桃', pinyin: 'táo', fr: 'pêche' },
        { hanzi: '扶桑', pinyin: 'Fú Sāng', fr: 'Fusang, l\'arbre où se posent les soleils' },
        { hanzi: '药', pinyin: 'yào', fr: 'remède, élixir' }
    ],
    // Lot 6 : Les cinq éléments
    [
        { hanzi: '火', pinyin: 'huǒ', fr: 'feu' },
        { hanzi: '水', pinyin: 'shuǐ', fr: 'eau' },
        { hanzi: '木', pinyin: 'mù', fr: 'bois, arbre' },
        { hanzi: '金', pinyin: 'jīn', fr: 'or, métal' },
        { hanzi: '土', pinyin: 'tǔ', fr: 'terre' }
    ],
    // Lot 7 : Énergie et paysages
    [
        { hanzi: '五行', pinyin: 'wǔ xíng', fr: 'les cinq éléments' },
        { hanzi: '气', pinyin: 'qì', fr: 'souffle vital, énergie' },
        { hanzi: '力量', pinyin: 'lì liang', fr: 'force, puissance' },
        { hanzi: '山', pinyin: 'shān', fr: 'montagne' },
        { hanzi: '河', pinyin: 'hé', fr: 'fleuve' }
    ],
    // Lot 8 : Nature des régions
    [
        { hanzi: '海', pinyin: 'hǎi', fr: 'mer' },
        { hanzi: '雷', pinyin: 'léi', fr: 'tonnerre' },
        { hanzi: '雪', pinyin: 'xuě', fr: 'neige' },
        { hanzi: '竹', pinyin: 'zhú', fr: 'bambou' },
        { hanzi: '稻', pinyin: 'dào', fr: 'riz (plante)' }
    ],
    // Lot 9 : Villages et PNJ
    [
        { hanzi: '村庄', pinyin: 'cūn zhuāng', fr: 'village' },
        { hanzi: '商人', pinyin: 'shāng rén', fr: 'marchand' },
        { hanzi: '长老', pinyin: 'zhǎng lǎo', fr: 'ancien, doyen' },
        { hanzi: '朋友', pinyin: 'péng you', fr: 'ami' },
        { hanzi: '你好', pinyin: 'nǐ hǎo', fr: 'bonjour' }
    ],
    // Lot 10 : Mots du quotidien
    [
        { hanzi: '谢谢', pinyin: 'xiè xie', fr: 'merci' },
        { hanzi: '胜利', pinyin: 'shèng lì', fr: 'victoire' },
        { hanzi: '失败', pinyin: 'shī bài', fr: 'défaite, échec' }
    ]
];

const stripTones = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s'’-]/g, '').toLowerCase();
const lowerFirst = t => t.replace(/\s*\/\s*/g, ', ').replace(/^./, c => c.toLowerCase());

/** Noms de créatures dont la traduction littérale apprend un vrai mot (pas un simple nom propre : « Yinglong »), sans doublon ni mot déjà vu. */
export const CREATURE_LOTS = 4;
// Les créatures les plus marquantes (ordre de passage) : seulement quatre lots de cinq.
const CREATURE_PICKS = ['苍龙', '蛟龙', '炽焰虎', '僵尸', '狐狸精', '混沌', '雷公', '瘟神', '蒙面刺客', '月之巫女', '陶俑战士', '雪中仙姬', '玉石仙灵', '古松树精', '烈焰野猪', '余烬之狼', '草木精灵', '执笔术士', '泥沼蟾蜍', '烈日卫士'];
export function creatureWords(exclude = new Set()) {
    const seen = new Set(exclude), out = [];
    Object.values(BESTIARY_NAMES).forEach(([pinyin, hanzi]) => {
        const literal = LITERAL_BY_HANZI[hanzi];
        if (!literal || seen.has(hanzi) || stripTones(literal) === stripTones(pinyin)) return;
        seen.add(hanzi);
        out.push({ hanzi, pinyin, fr: lowerFirst(literal) });
    });
    return out;
}

const chunk = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const curatedHanzi = new Set(CURATED_LOTS.flat().map(w => w.hanzi));
/** Tous les lots, dans l'ordre : légende, mots usuels (mots puis phrases en fin), puis quatre lots de créatures. */
const taken = new Set([...curatedHanzi, ...USUAL_LOTS.flat().map(w => w.hanzi)]);
const creatures = creatureWords(taken);
const pickedCreatures = CREATURE_PICKS.map(h => creatures.find(w => w.hanzi === h)).filter(Boolean).slice(0, CREATURE_LOTS * LOT_SIZE);
export const LESSON_LOTS = [...CURATED_LOTS, ...USUAL_LOTS, ...chunk(pickedCreatures, LOT_SIZE)];
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
