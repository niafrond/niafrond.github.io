// Golden de habits.js : ports, déduction, paramètres de modélisation.
import * as Hb from '../../jardin/habits.js';
import { writeGolden, writeFixtures } from './golden-lib.mjs';

const { plants } = writeFixtures();
const extra = [
  { id: 'x-palm', commonName: 'Palmier', latinName: 'Trachycarpus fortunei', category: 'tree', heightAdult: 8, widthAdult: 3 },
  { id: 'x-forced', commonName: 'Forcé', latinName: 'Zzz', category: 'tree', heightAdult: 3, widthAdult: 3, habit: 'palm' },
  { id: 'x-badhabit', commonName: 'Mauvais', latinName: 'Zzz', category: 'shrub', heightAdult: 1, widthAdult: 1, habit: 'nope' },
  { id: 'x-conifer', commonName: 'Conifère', latinName: 'Cupressus sempervirens', category: 'tree', heightAdult: 20, widthAdult: 4 },
  { id: 'x-pinus', commonName: 'Pin', latinName: 'Pinus nigra', category: 'tree', heightAdult: 20, widthAdult: 12 },
  { id: 'x-pend', commonName: 'Pleureur', latinName: 'Betula pendula', category: 'tree', heightAdult: 10, widthAdult: 6 },
  { id: 'x-bamboo', commonName: 'Bambou', latinName: 'Phyllostachys aurea', category: 'shrub', heightAdult: 4, widthAdult: 1.5 },
  { id: 'x-fern', commonName: 'Fougère', latinName: 'Dryopteris filix-mas', category: 'perennial', heightAdult: 1, widthAdult: 1 },
  { id: 'x-hosta', commonName: 'Hosta', latinName: 'Hosta sieboldiana', category: 'perennial', heightAdult: 0.6, widthAdult: 0.9 },
  { id: 'x-nodim', commonName: 'Sans dim', latinName: '', category: 'weird' },
  { id: 'x-nodim2', commonName: 'Sans dim 2', latinName: '', category: 'tree' },
  { id: 'x-evg', commonName: 'Persistant', latinName: 'Zzz', category: 'shrub', heightAdult: 2, widthAdult: 1.5, foliage: 'evergreen' },
  { id: 'x-bulb', commonName: 'Bulbe', latinName: 'Zzz', category: 'bulb', heightAdult: 0.9, widthAdult: 0.2 },
  { id: 'x-fruit8', commonName: 'Fruitier', latinName: 'Zzz', category: 'fruit', heightAdult: 9, widthAdult: 6 },
  { id: 'x-fruit2', commonName: 'Petit fruit', latinName: 'Zzz', category: 'fruit', heightAdult: 1.5, widthAdult: 1 },
  { id: 'x-vine', commonName: 'Vigne', latinName: 'Zzz', category: 'climber', heightAdult: 12, widthAdult: 3 },
];
const all = [...plants, ...extra];
const out = { plants: all };
out.habits = Hb.HABITS;
out.ids = Hb.HABIT_IDS;
out.supports = Hb.SUPPORTS;
out.tagCount = Object.keys(Hb.TAGS_BY_PLANT).length;
out.getHabit = ['tree-round', 'zzz', null].map((id) => ({ id, r: Hb.getHabit(id)?.id ?? null }));
out.habitOf = all.map((p) => Hb.habitOf(p).id);
out.habitOfNull = Hb.habitOf(null).id;
const ages = [1, 0, 0.5, 'young', 'adult', 0.25, 3, -1, '0.7'];
out.ages = ages;
out.params = all.map((p) => ages.map((a) => Hb.habitParams(p, { age: a })));
out.paramsOverride = all.slice(0, 20).map((p) => [Hb.habitParams(p, { height: 3, width: 2 }), Hb.habitParams(p, { age: 0.4, height: 1.5 }), Hb.habitParams(p, { width: 0.5 })]);
out.paramsNull = [Hb.habitParams(null), Hb.habitParams(undefined, { age: 0.3 })];
out.describe = all.map((p) => Hb.describeHabit(p));
out.describeNull = Hb.describeHabit(null);
writeGolden('habits', out);
