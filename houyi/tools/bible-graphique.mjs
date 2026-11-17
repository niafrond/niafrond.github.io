// Bible graphique du bestiaire : motifs visuels de l'iconographie chinoise ancienne (bronzes Shang, Shanhaijing, gravures Ming…),
// à injecter dans les prompts de génération (gen-sprites-gm.mjs) et à donner en contexte à un LLM (`bibleText()`).
// Source unique : ce fichier ; docs/BIBLE-GRAPHIQUE.md en est la version lisible (node tools/bible-graphique.mjs --md).
// Images de référence locales : docs/bible-graphique/ (Wikimedia Commons, voir REFERENCES).
//
// Un motif = { id, nom, traits (français, pour le LLM), prompt (anglais, pour le générateur), source, images, mots (déclencheurs) }.
// `mots` sont cherchés dans l'id, le nom, la race, le titre et le prompt de la créature (bestiary-data.mjs).

export const REGLES_GLOBALES = [
  "Créatures composites : on assemble des parties d'animaux réels (cerf, tigre, serpent, oiseau, poisson), jamais un monstre occidental (pas de dragon à ailes de chauve-souris, ni d'orc, de gobelin, de squelette).",
  'Symétrie frontale et formes stylisées : masque à plat, yeux ronds globuleux, cornes en C ou en spirale, volutes (leiwen) remplissant les vides.',
  'Corps serpentins, écailles en motifs répétés, griffes à trois ou quatre doigts, moustaches et crinière en rubans.',
  'Palette : patine de bronze (vert-de-gris, brun), laque rouge, or, jade, blanc de porcelaine ; contours sombres épais, aplats, pas de dégradé photoréaliste.',
  'Membres surnuméraires, têtes ou queues multiples autorisés (Shanhaijing) : ils servent la lisibilité en 32×32, pas le réalisme.',
  'Les esprits (jing, gui) gardent un trait animal ou végétal lisible : un seul attribut fort par silhouette.',
  'Formes, motifs et textures viennent des bronzes Shang ; les anatomies fantastiques viennent du Shanhaijing. Qilin et fenghuang sont des iconographies plus tardives.',
];

export const MOTIFS = [
  { id: 'taotie', nom: 'Taotie (masque de bronze)', mots: ['taotie', 'qiongqi', 'tao_tie', 'hundun'],
    traits: 'Masque frontal symétrique, yeux ronds globuleux, cornes en C, gueule hybride aux crocs, spirales de tonnerre sur les joues, sans mâchoire inférieure distincte.',
    prompt: 'frontal symmetric taotie bronze mask face, bulging round eyes, curled horns, wide fanged hybrid mouth, spiral thunder-pattern cheeks, verdigris bronze patina',
    source: 'Bronzes Shang — Met Museum ; reliefs — British Museum', images: ['taotie-masque-zhou.jpg', 'zun-shang-taotie.jpg', 'bu-shang-taotie.jpg'] },
  { id: 'dragon_bronze', nom: 'Dragon de bronze', mots: ['long', 'dragon', 'jiao', 'canglong', 'chilong', 'bailong', 'heilong', 'qinglong', 'shenlong', 'fucanglong', 'panlong', 'yinglong', 'zhulong', 'tengshe', 'feilong', 'wyrm'],
    traits: "Corps serpentin en S, écailles stylisées en motifs répétés, quatre pattes à griffes, cornes de cerf, longues moustaches et crinière en rubans, pas d'ailes de chauve-souris.",
    prompt: 'Chinese serpentine dragon with long sinuous scaly body, stylized repeating scale pattern, four clawed legs, deer antlers, whiskers and ribbon mane, ancient bronze dragon style',
    source: 'Bronzes chinois — Smithsonian ; Commons: Category:Chinese_dragons', images: ['dragons-anciens.png', 'dragon-chinois.png'] },
  { id: 'shanhaijing', nom: 'Créature du Shanhaijing', mots: ['shou', 'guai', 'xiangliu', 'wangliang', 'jiu_tou', 'sanzu', 'bi_fang', 'zouyu', 'yingzhao', 'feiyi', 'lushu', 'composite'],
    traits: 'Animal composite aux membres surnuméraires, têtes ou queues multiples, anatomie étrange mais lisible, gravure au trait.',
    prompt: 'composite mythical beast from the Classic of Mountains and Seas, extra limbs, multiple tails, strange anatomy, old woodblock engraving look',
    source: 'Shanhaijing, éd. Chongzhen (1628–1644)', images: ['shanhaijing-lushu.jpg', 'shanhaijing-lei.jpg'] },
  { id: 'bete_gravee', nom: 'Bête gravée Ming', mots: ['lei', 'xiezhi', 'baize', 'bai_ze', 'yazi', 'chiwen', 'chaofeng', 'pulao', 'bian', 'bixi'],
    traits: 'Silhouette fantastique gravée, anatomie étrange, motifs de nuages et de flammes sur le pelage, pose héraldique.',
    prompt: 'fantastic Ming-era engraved beast silhouette, odd anatomy, cloud and flame patterns on the coat, heraldic pose',
    source: 'Shanhaijing Chongzhen (Lei)', images: ['shanhaijing-lei.jpg'] },
  { id: 'fenghuang', nom: 'Fenghuang et oiseaux fastes', mots: ['fenghuang', 'zhuque', 'qingniao', 'jinwu', 'bennu', 'niao', 'jingwei', 'peng', 'yayu'],
    traits: 'Oiseau mythique : longue queue en rubans, plumage ornemental à ocelles, crête, bec de coq, pattes de grue.',
    prompt: 'Chinese phoenix fenghuang, long flowing ribbon tail feathers, ornamental ocellated plumage, crest, crane legs',
    source: 'Fenghuang, dessin de 1664', images: ['fenghuang-1664.jpg'] },
  { id: 'qilin', nom: 'Qilin', mots: ['qilin', 'tianma', 'longma', 'feima'],
    traits: 'Hybride cervidé-dragon : corps de cerf, écailles sur le flanc, sabots fendus, une ou deux cornes, queue de bœuf touffue, flammes aux membres.',
    prompt: 'qilin, deer-dragon hybrid, scaled flanks, cloven hooves, branching horn, tufted ox tail, small flames on the legs',
    source: 'Qilin (Commons, SVG)', images: ['qilin.png'] },
  { id: 'pixiu', nom: 'Bête gardienne (Pixiu, Suanni)', mots: ['pixiu', 'suanni', 'bixie', 'tianlu', 'lion', 'behemoth'],
    traits: 'Bête gardienne trapue, gueule puissante largement ouverte, crinière bouclée, petites cornes, ailes courtes repliées, posture assise et massive.',
    prompt: 'Chinese guardian beast pixiu, stocky, powerful open jaws, curly mane, short horns, small folded wings, carved jade-stone look',
    source: 'Commons: Category:Pixiu', images: ['pixiu-qianlong.jpg', 'pixiu-gfp.jpg'] },
  { id: 'xiwangmu', nom: 'Figure surnaturelle (Xi Wangmu)', mots: ['wangmu', 'nuwa', 'fuxi', 'po_nu', 'hai_ruo', 'ren_yu', 'hanba', 'nuba'],
    traits: 'Humanoïde surnaturel portant un attribut animal fort (queue, plumes, cornes, bas de serpent), robe longue à plis rayonnants, coiffe ornée.',
    prompt: 'supernatural humanoid figure with strong animal attributes, snake tail or feathers or horns, long flowing robe, ornate headdress, ancient painted look',
    source: 'Shan Hai Jing — Xi Wangmu', images: ['shanhaijing-xiwangmu.jpg'] },
  { id: 'ding_shang', nom: 'Ding rituel Shang', mots: ['ding', 'zu_xian', 'ancetre', 'diao_si', 'cigale'],
    traits: "Reliefs animaliers et motifs d'insectes (cigales, grillons) en bandes ; bronze coulé, formes carrées et épaisses.",
    prompt: 'ritual Shang ding bronze relief, animal and cicada insect motifs in bands, thick cast-bronze square forms',
    source: 'Ding — British Museum A_1947-0712-419 ; Smart Museum', images: ['bu-shang-taotie.jpg'] },
  { id: 'bronze_patine', nom: 'Textures de bronze rituel', mots: ['golem', 'colosse', 'warden', 'statue', 'bronze', 'tortue', 'xuan_gui', 'ling_gui'],
    traits: 'Texture patinée vert-de-gris et brun, motifs géométriques et organiques gravés (méandres léiwén, nuages), arêtes usées.',
    prompt: 'weathered ritual bronze texture, green verdigris patina, engraved geometric meander and cloud patterns, worn edges',
    source: 'Bronzes rituels — Tokyo National Museum TJ-4785', images: ['zun-shang-taotie.jpg'] },
];

export const REFERENCES = [
  ['Vase rituel Shang à taotie — Met Museum', 'https://www.metmuseum.org/art/collection/search/60594'],
  ['Vase jia à taotie — British Museum', 'https://www.britishmuseum.org/collection/object/A_1954-1019-1'],
  ['Vase ding à taotie et cigale — British Museum', 'https://www.britishmuseum.org/collection/object/A_1947-0712-419'],
  ['Vase rituel ding — Smart Museum', 'https://smartcollection.uchicago.edu/objects/4064/ding-ting-ritual-cooking-vessel'],
  ['Vase rituel — Tokyo National Museum', 'https://colbase.nich.go.jp/collection_items/tnm/TJ-4785?locale=en'],
  ['Dragons chinois — Commons', 'https://commons.wikimedia.org/wiki/Category:Chinese_dragons'],
  ['Pixiu — Commons', 'https://commons.wikimedia.org/wiki/Category:Pixiu'],
];

/** Motifs applicables à une créature [id, nom, race, titre, couleur, région, archétype, prompt]. Au plus `max`, par nombre de mots touchés. */
export function bibleFor(creature, max = 2) {
  const [id, nom, race, titre, , , , prompt] = creature;
  const hay = [id, nom, race, titre, prompt].join(' ').toLowerCase().replace(/[\s-]+/g, '_');
  return MOTIFS.map(m => ({ m, n: m.mots.filter(w => hay.includes(w)).length })).filter(x => x.n).sort((a, b) => b.n - a.n).slice(0, max).map(x => x.m);
}

/** Fragment de prompt (anglais) à ajouter à la description d'une créature ; '' si aucun motif. */
export function biblePrompt(creature) {
  return bibleFor(creature).map(m => m.prompt).join(', ');
}

/** Bible complète en texte, à donner en contexte à un LLM qui écrit ou révise des créatures. */
export function bibleText() {
  return ['# Bible graphique du bestiaire', '', '## Règles', ...REGLES_GLOBALES.map(r => '- ' + r), '', '## Motifs',
    ...MOTIFS.flatMap(m => ['### ' + m.nom + ' (`' + m.id + '`)', m.traits, '', '- Prompt : ' + m.prompt, '- Source : ' + m.source,
      ...(m.images.length ? ['- Images : ' + m.images.map(i => '[' + i + '](bible-graphique/' + i + ')').join(', ')] : []), '']),
    '## Références', ...REFERENCES.map(([t, u]) => '- [' + t + '](' + u + ')'), ''].join('\n');
}

if (process.argv[1] && process.argv[1].endsWith('bible-graphique.mjs') && process.argv.includes('--md')) {
  const { writeFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const out = fileURLToPath(new URL('../docs/BIBLE-GRAPHIQUE.md', import.meta.url));
  writeFileSync(out, bibleText());
  console.log('écrit', out);
}
