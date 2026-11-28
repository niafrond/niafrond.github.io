// Golden des ambiances : détection, ambiances et scores (catalogue réel + essences synthétiques).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { AMBIANCES, detectAmbiance, plantAmbiances, plantAvoids, plantAmbianceScore, isTypical } from '../../jardin/ambiances.js';
import { allPlants } from '../../jardin/catalog.js';

const here = dirname(fileURLToPath(import.meta.url));
const texts = [
  'Massif bucolique devant la terrasse', 'coin zen', 'Jardin japonais', 'Coin ZEN près du bassin', 'Parterre décoratif', 'Haie champêtre',
  'Espace méditerranéen', 'Carré gourmand', 'Allée romantique', 'Massif contemporain', 'Angle exotique', 'Pour les papillons et les abeilles',
  'Coin calme', 'Bordure colorée', 'Zone sauvage au fond', 'Potager', 'Zenith', '', null, undefined, 'Zone 2', 'un arc en ciel', 'zen calme sauvage',
  'sauvage puis zen', 'Provence', 'le zenitude', 'Cottage anglais', 'DESIGN épuré',
];
const synth = [
  { id: 'x-inconnue', category: 'fruit', edible: true, melliferous: true, sun: ['full'], water: 'medium', bloom: [5] },
  { id: 'x-gram', category: 'grass', sun: ['full'], water: 'low', bloom: [8] },
  { id: 'x-med', category: 'shrub', sun: ['full'], water: 'low', foliage: 'evergreen', bloom: [6, 7], flowerColor: '#8855cc' },
  { id: 'x-vif', category: 'perennial', sun: ['full', 'partial'], water: 'medium', bloom: [5, 6, 7, 8, 9], flowerColor: '#ff2200', maintenance: 'low', melliferous: true },
  { id: 'x-pale', category: 'shrub', sun: ['partial'], water: 'medium', bloom: [4], flowerColor: '#fafafa' },
  { id: 'x-bleu', category: 'groundcover', sun: ['shade'], water: 'high', bloom: [], flowerColor: '#3355ff' },
  { id: 'x-vert', category: 'tree', sun: ['full'], water: 'medium', bloom: [4], flowerColor: '#33aa33', maintenance: 'low', melliferous: true },
  { id: 'x-nu', category: 'aquatic', bloom: [] },
  { id: 'x-bad', category: 'lawn', bloom: [1], flowerColor: 'zzz' },
];
const plants = [...allPlants(), ...synth];
const ids = AMBIANCES.map((a) => a.id);
const out = {
  ambiances: AMBIANCES,
  detect: texts.map((t) => ({ t: t ?? null, r: detectAmbiance(t) })),
  synth,
  plants: plants.map((p) => ({
    id: p.id,
    ambiances: plantAmbiances(p),
    avoids: plantAvoids(p),
    scores: ids.map((a) => plantAmbianceScore(p, a)),
    typical: ids.map((a) => isTypical(p, a)),
  })),
  unknownScore: plantAmbianceScore(allPlants()[0], 'inconnue'),
};
mkdirSync(resolve(here, '../golden'), { recursive: true });
writeFileSync(resolve(here, '../golden/ambiances.json'), JSON.stringify(out));
console.log('golden ambiances ok');
