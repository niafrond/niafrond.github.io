export const R1_WORDS = ['SOLEIL','CHIEN','MAISON','VOITURE','FLEUR','LIVRE','EAU','FEUX','LUNE','ENFANT','BOIS','PONT','RIVIÈRE','MONTAGNE','CIEL','PAIN','OISEAU','ARBRE','ROUTE','JARDIN','PORTE','TABLE','FENÊTRE','CUISINE','NUIT','ÉTOILE','VAGUE','HERBE','VENT','NEIGE','NUAGE','FEUILLE','ROCHER','FORÊT','PLAGE','SABLE','MER','CHÂTEAU','CLEF','LETTRE','CHAT','VACHE','PLUIE','DANSE','MUSIQUE','FÊTE','JOIE','RÊVE','COULEUR','IMAGE'];

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
