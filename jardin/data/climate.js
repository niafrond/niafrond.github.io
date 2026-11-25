// Table climatique des départements métropolitains (96 : 01–95 sans 20, + 2A et 2B).
// tminC : minimum extrême annuel moyen de référence (°C, altitude moyenne des zones habitées).
// rainMm : cumul annuel moyen. frostFreeFrom/To : mois de la période sans gel (1–12).
// zoneUSDA : calculée depuis tminC (voir `usdaZone`).

function usdaZone(tminC) {
  const idx = Math.floor((tminC + 51.1) / 2.78);
  if (idx < 0) return '1a';
  return `${Math.floor(idx / 2) + 1}${idx % 2 ? 'b' : 'a'}`;
}

const ARA = 'Auvergne-Rhône-Alpes';
const BFC = 'Bourgogne-Franche-Comté';
const BRE = 'Bretagne';
const CVL = 'Centre-Val de Loire';
const COR = 'Corse';
const GES = 'Grand Est';
const HDF = 'Hauts-de-France';
const IDF = 'Île-de-France';
const NOR = 'Normandie';
const NAQ = 'Nouvelle-Aquitaine';
const OCC = 'Occitanie';
const PDL = 'Pays de la Loire';
const PAC = "Provence-Alpes-Côte d'Azur";

// [code, nom, région, tminC, rainMm, frostFreeFrom, frostFreeTo]
const ROWS = [
  ['01', 'Ain', ARA, -15, 1000, 5, 10],
  ['02', 'Aisne', HDF, -14, 700, 5, 10],
  ['03', 'Allier', ARA, -15, 780, 5, 10],
  ['04', 'Alpes-de-Haute-Provence', PAC, -13, 800, 5, 10],
  ['05', 'Hautes-Alpes', PAC, -20, 800, 5, 9],
  ['06', 'Alpes-Maritimes', PAC, -3, 850, 3, 11],
  ['07', 'Ardèche', ARA, -11, 1000, 4, 10],
  ['08', 'Ardennes', GES, -17, 900, 5, 9],
  ['09', 'Ariège', OCC, -12, 1000, 5, 10],
  ['10', 'Aube', GES, -16, 650, 5, 10],
  ['11', 'Aude', OCC, -7, 600, 4, 11],
  ['12', 'Aveyron', OCC, -14, 850, 5, 10],
  ['13', 'Bouches-du-Rhône', PAC, -6, 550, 3, 11],
  ['14', 'Calvados', NOR, -9, 800, 4, 11],
  ['15', 'Cantal', ARA, -18, 1000, 5, 9],
  ['16', 'Charente', NAQ, -10, 800, 4, 10],
  ['17', 'Charente-Maritime', NAQ, -7, 800, 4, 11],
  ['18', 'Cher', CVL, -14, 700, 5, 10],
  ['19', 'Corrèze', NAQ, -14, 1100, 5, 10],
  ['2A', 'Corse-du-Sud', COR, -3, 650, 3, 11],
  ['2B', 'Haute-Corse', COR, -4, 700, 3, 11],
  ['21', "Côte-d'Or", BFC, -16, 750, 5, 10],
  ['22', "Côtes-d'Armor", BRE, -8, 850, 4, 11],
  ['23', 'Creuse', NAQ, -16, 950, 5, 10],
  ['24', 'Dordogne', NAQ, -10, 850, 4, 10],
  ['25', 'Doubs', BFC, -19, 1200, 5, 9],
  ['26', 'Drôme', ARA, -10, 850, 4, 10],
  ['27', 'Eure', NOR, -12, 700, 5, 10],
  ['28', 'Eure-et-Loir', CVL, -13, 600, 5, 10],
  ['29', 'Finistère', BRE, -6, 1100, 3, 11],
  ['30', 'Gard', OCC, -7, 700, 4, 11],
  ['31', 'Haute-Garonne', OCC, -9, 650, 4, 10],
  ['32', 'Gers', OCC, -10, 700, 4, 10],
  ['33', 'Gironde', NAQ, -7, 900, 4, 11],
  ['34', 'Hérault', OCC, -6, 650, 3, 11],
  ['35', 'Ille-et-Vilaine', BRE, -9, 700, 4, 10],
  ['36', 'Indre', CVL, -13, 700, 5, 10],
  ['37', 'Indre-et-Loire', CVL, -11, 650, 4, 10],
  ['38', 'Isère', ARA, -16, 950, 5, 10],
  ['39', 'Jura', BFC, -18, 1200, 5, 9],
  ['40', 'Landes', NAQ, -6, 1000, 4, 11],
  ['41', 'Loir-et-Cher', CVL, -12, 650, 5, 10],
  ['42', 'Loire', ARA, -16, 800, 5, 10],
  ['43', 'Haute-Loire', ARA, -19, 800, 5, 9],
  ['44', 'Loire-Atlantique', PDL, -8, 800, 4, 11],
  ['45', 'Loiret', CVL, -13, 650, 5, 10],
  ['46', 'Lot', OCC, -11, 800, 4, 10],
  ['47', 'Lot-et-Garonne', NAQ, -9, 700, 4, 10],
  ['48', 'Lozère', OCC, -19, 1000, 5, 9],
  ['49', 'Maine-et-Loire', PDL, -10, 650, 4, 10],
  ['50', 'Manche', NOR, -8, 900, 4, 11],
  ['51', 'Marne', GES, -15, 650, 5, 10],
  ['52', 'Haute-Marne', GES, -17, 850, 5, 10],
  ['53', 'Mayenne', PDL, -10, 750, 4, 10],
  ['54', 'Meurthe-et-Moselle', GES, -18, 750, 5, 9],
  ['55', 'Meuse', GES, -18, 850, 5, 9],
  ['56', 'Morbihan', BRE, -7, 850, 4, 11],
  ['57', 'Moselle', GES, -18, 800, 5, 9],
  ['58', 'Nièvre', BFC, -15, 800, 5, 10],
  ['59', 'Nord', HDF, -12, 750, 4, 10],
  ['60', 'Oise', HDF, -13, 650, 5, 10],
  ['61', 'Orne', NOR, -12, 800, 5, 10],
  ['62', 'Pas-de-Calais', HDF, -11, 800, 4, 10],
  ['63', 'Puy-de-Dôme', ARA, -16, 650, 5, 10],
  ['64', 'Pyrénées-Atlantiques', NAQ, -7, 1250, 4, 11],
  ['65', 'Hautes-Pyrénées', OCC, -12, 1100, 5, 10],
  ['66', 'Pyrénées-Orientales', OCC, -5, 600, 3, 11],
  ['67', 'Bas-Rhin', GES, -17, 750, 5, 9],
  ['68', 'Haut-Rhin', GES, -16, 650, 5, 10],
  ['69', 'Rhône', ARA, -13, 800, 4, 10],
  ['70', 'Haute-Saône', BFC, -18, 1000, 5, 9],
  ['71', 'Saône-et-Loire', BFC, -15, 800, 5, 10],
  ['72', 'Sarthe', PDL, -11, 700, 4, 10],
  ['73', 'Savoie', ARA, -21, 1200, 5, 9],
  ['74', 'Haute-Savoie', ARA, -19, 1200, 5, 9],
  ['75', 'Paris', IDF, -9, 640, 4, 11],
  ['76', 'Seine-Maritime', NOR, -11, 850, 4, 10],
  ['77', 'Seine-et-Marne', IDF, -13, 650, 5, 10],
  ['78', 'Yvelines', IDF, -12, 650, 4, 10],
  ['79', 'Deux-Sèvres', NAQ, -11, 800, 4, 10],
  ['80', 'Somme', HDF, -12, 700, 5, 10],
  ['81', 'Tarn', OCC, -10, 750, 4, 10],
  ['82', 'Tarn-et-Garonne', OCC, -9, 700, 4, 10],
  ['83', 'Var', PAC, -5, 800, 3, 11],
  ['84', 'Vaucluse', PAC, -8, 650, 4, 10],
  ['85', 'Vendée', PDL, -7, 800, 4, 11],
  ['86', 'Vienne', NAQ, -11, 700, 4, 10],
  ['87', 'Haute-Vienne', NAQ, -13, 1000, 5, 10],
  ['88', 'Vosges', GES, -20, 1100, 5, 9],
  ['89', 'Yonne', BFC, -15, 700, 5, 10],
  ['90', 'Territoire de Belfort', BFC, -18, 1100, 5, 9],
  ['91', 'Essonne', IDF, -12, 600, 5, 10],
  ['92', 'Hauts-de-Seine', IDF, -9, 640, 4, 11],
  ['93', 'Seine-Saint-Denis', IDF, -10, 640, 4, 11],
  ['94', 'Val-de-Marne', IDF, -10, 640, 4, 11],
  ['95', "Val-d'Oise", IDF, -12, 650, 5, 10],
];

export const departements = ROWS.map(([code, name, region, tminC, rainMm, frostFreeFrom, frostFreeTo]) => ({
  code, name, region, tminC, rainMm, frostFreeFrom, frostFreeTo, zoneUSDA: usdaZone(tminC),
}));

export default departements;
