export const R1_PHRASE_SETS = [
  { phrase: 'Fruits rouges',               words: ['FRAISE', 'CERISE', 'FRAMBOISE', 'GROSEILLE', 'MYRTILLE'] },
  { phrase: 'Pays d\'Amérique du Sud',     words: ['BRÉSIL', 'ARGENTINE', 'COLOMBIE', 'PÉROU', 'CHILI'] },
  { phrase: 'Planètes du système solaire', words: ['MARS', 'VÉNUS', 'SATURNE', 'JUPITER', 'MERCURE'] },
  { phrase: 'Instruments à cordes',        words: ['VIOLON', 'VIOLONCELLE', 'GUITARE', 'HARPE', 'LUTH'] },
  { phrase: 'Sports d\'hiver',             words: ['SKI', 'LUGE', 'BOBSLEIGH', 'CURLING', 'PATINAGE'] },
  { phrase: 'Auteurs classiques français', words: ['MOLIÈRE', 'RACINE', 'CORNEILLE', 'VOLTAIRE', 'HUGO'] },
  { phrase: 'Capitales européennes',       words: ['ROME', 'MADRID', 'BERLIN', 'AMSTERDAM', 'LISBONNE'] },
  { phrase: 'Animaux de la savane',        words: ['LION', 'ÉLÉPHANT', 'GIRAFE', 'ZÈBRE', 'RHINOCÉROS'] },
  { phrase: 'Types de pâtes',              words: ['SPAGHETTI', 'LASAGNE', 'PENNE', 'TAGLIATELLE', 'GNOCCHI'] },
  { phrase: 'Volcans célèbres',            words: ['VÉSUVE', 'ETNA', 'KRAKATOA', 'FUJIYAMA', 'STROMBOLI'] },
  { phrase: 'Types de danse',              words: ['VALSE', 'TANGO', 'SALSA', 'MAMBO', 'CHA-CHA'] },
  { phrase: 'Fleurs du jardin',            words: ['ROSE', 'TULIPE', 'LAVANDE', 'MARGUERITE', 'PIVOINE'] },
  { phrase: 'Fromages français',           words: ['BRIE', 'CAMEMBERT', 'ROQUEFORT', 'COMTÉ', 'MUNSTER'] },
  { phrase: 'Inventeurs célèbres',         words: ['EDISON', 'TESLA', 'CURIE', 'PASTEUR', 'BELL'] },
  { phrase: 'Métiers de la santé',         words: ['MÉDECIN', 'CHIRURGIEN', 'INFIRMIER', 'PHARMACIEN', 'RADIOLOGUE'] },
  { phrase: 'Héros de bande dessinée',     words: ['ASTÉRIX', 'TINTIN', 'SPIROU', 'GASTON', 'BLAKE'] },
  { phrase: 'Épices du monde',             words: ['CUMIN', 'SAFRAN', 'CANNELLE', 'CARDAMOME', 'CURCUMA'] },
  { phrase: 'Monuments parisiens',         words: ['LOUVRE', 'EIFFEL', 'INVALIDES', 'SACRÉ-CŒUR', 'PANTHÉON'] },
  { phrase: 'Outils de jardinage',         words: ['RÂTEAU', 'BÊCHE', 'SÉCATEUR', 'ARROSOIR', 'FOURCHE'] },
  { phrase: 'Sports olympiques d\'été',    words: ['NATATION', 'ATHLÉTISME', 'ESCRIME', 'AVIRON', 'BOXE'] },
  { phrase: 'Types de nuages',             words: ['CUMULUS', 'STRATUS', 'CIRRUS', 'NIMBUS', 'ALTOCUMULUS'] },
  { phrase: 'Animaux nocturnes',           words: ['HIBOU', 'CHAUVE-SOURIS', 'RENARD', 'HÉRISSON', 'LOUP'] },
  { phrase: 'Philosophes grecs',           words: ['SOCRATE', 'PLATON', 'ARISTOTE', 'ÉPICURE', 'DIOGÈNE'] },
  { phrase: 'Légumes du potager',          words: ['TOMATE', 'COURGETTE', 'POIREAU', 'CAROTTE', 'HARICOT'] },
  { phrase: 'Instruments à vent',          words: ['TROMPETTE', 'FLÛTE', 'CLARINETTE', 'TROMBONE', 'HAUTBOIS'] },
  { phrase: 'Pierres précieuses',          words: ['DIAMANT', 'RUBIS', 'ÉMERAUDE', 'SAPHIR', 'TOPAZE'] },
  { phrase: 'Sports de raquette',          words: ['TENNIS', 'BADMINTON', 'SQUASH', 'PING-PONG', 'PADEL'] },
  { phrase: 'Arbres fruitiers',            words: ['POMMIER', 'POIRIER', 'CERISIER', 'PRUNIER', 'FIGUIER'] },
];

// Flat alias kept for backward compatibility
export const R1_WORDS = R1_PHRASE_SETS.flatMap(s => s.words);

export const R2_WORDS = ['LION','AVION','BATEAU','TRAIN','CAFÉ','FROMAGE','BEURRE','POMME','ORANGE','BANANE','CHOCOLAT','SUCRE','SEL','FARINE','PIZZA','SOUPE','SALADE','VIANDE','POISSON','RIZ','PASTA','CAROTTE','TOMATE','OIGNON','AIL','CITRON','FRAISE','CERISE','POIRE','RAISIN'];

export const R3_SETS = [
  { theme: 'Pays du monde', words: ['FRANCE','ESPAGNE','ITALIE','ALLEMAGNE','JAPON','BRÉSIL','CANADA','MEXIQUE','CHINE','RUSSIE','AUSTRALIE','INDE','ÉGYPTE','MAROC','ARGENTINE'] },
  { theme: 'Célébrités françaises', words: ['HUGO','VOLTAIRE','MOLIÈRE','NAPOLÉON','BAUDELAIRE','ZOLA','FLAUBERT','RIMBAUD','VERLAINE','CAMUS','SARTRE','DE GAULLE','PICASSO','MONET','PROUST'] },
  { theme: 'Personnages historiques', words: ['CLÉOPÂTRE','CHARLEMAGNE','CHRISTOPHE COLOMB','EINSTEIN','SHAKESPEARE','DARWIN','GALILÉE','LÉONARD DE VINCI','MOZART','BEETHOVEN','NEWTON','PLATON','SOCRATE','MAGELLAN','PASTEUR'] },
  { theme: 'Villes françaises', words: ['PARIS','LYON','MARSEILLE','BORDEAUX','TOULOUSE','NANTES','NICE','STRASBOURG','MONTPELLIER','RENNES','ROUEN','LILLE','GRENOBLE','DIJON','REIMS'] },
  { theme: 'Pays d\'Afrique', words: ['SÉNÉGAL','MALI','CAMEROUN','CÔTE D\'IVOIRE','TUNISIE','ALGÉRIE','NIGERIA','KENYA','GHANA','ÉTHIOPIE','TANZANIE','MADAGASCAR','MOZAMBIQUE','ANGOLA','ZAMBIE'] },
];

export const R4_SETS = [
  { theme: 'Les animaux de la ferme', words: ['VACHE','COCHON','CHEVAL','MOUTON','POULE','LAPIN','ÂNE'] },
  { theme: 'Les instruments de musique', words: ['PIANO','GUITARE','VIOLON','FLÛTE','TROMPETTE','BATTERIE','HARPE'] },
  { theme: 'Les sports olympiques', words: ['NATATION','CYCLISME','ATHLÉTISME','TENNIS','FOOTBALL','BOXE','ESCRIME'] },
  { theme: 'Les fruits exotiques', words: ['MANGUE','ANANAS','PAPAYE','LITCHI','GRENADE','NOIX DE COCO','KIWI'] },
  { theme: 'Les métiers', words: ['MÉDECIN','BOULANGER','PILOTE','POMPIER','PROFESSEUR','CUISINIER','ARCHITECTE'] },
  { theme: 'Les films', words: ['INTOUCHABLES','AMÉLIE','AVATAR','TITANIC','MATRIX','ALIEN','CASABLANCA'] },
  { theme: 'Les capitales du monde', words: ['ROME','MADRID','BERLIN','TOKYO','OTTAWA','BRASÍLIA','PÉKIN'] },
];

export const FINAL_SETS = [
  ['AVOIR LE CAFARD','CASSER LES PIEDS','IL PLEUT DES CORDES','POSER UN LAPIN','PRENDRE LA POUDRE D\'ESCAMPETTE','TOURNER EN ROND'],
  ['AVOIR LE CŒUR SUR LA MAIN','BRÛLER LES ÉTAPES','DONNER SA LANGUE AU CHAT','METTRE LES PIEDS DANS LE PLAT','NOYER LE POISSON','TOMBER DANS LES POMMES'],
  ['AVOIR D\'AUTRES CHATS À FOUETTER','CASSER DU SUCRE SUR LE DOS','ÊTRE DANS SES PETITS SOULIERS','MANGER À TOUS LES RÂTELIERS','PRENDRE LE TAUREAU PAR LES CORNES','SE JETER À L\'EAU'],
];

/** Returns n non-overlapping phrase sets drawn at random from the pool. */
export function getR1PhraseSets(n) {
  const pool = [...R1_PHRASE_SETS].sort(() => Math.random() - 0.5);
  return pool.slice(0, Math.min(n, pool.length));
}

/** Legacy flat-word getter (kept for existing callers). */
export function getR1Words() {
  return [...R1_WORDS].sort(() => Math.random() - 0.5);
}
export function getR2Words() {
  return [...R2_WORDS].sort(() => Math.random() - 0.5);
}
export function getR3Set() {
  return R3_SETS[Math.floor(Math.random() * R3_SETS.length)];
}
export function getR4Set() {
  return R4_SETS[Math.floor(Math.random() * R4_SETS.length)];
}
export function getFinalSet() {
  return [...FINAL_SETS[Math.floor(Math.random() * FINAL_SETS.length)]];
}
