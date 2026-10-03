// Textes du Grand Monde, un par région : textes de base (world/text/<région>.js)
// fusionnés avec les textes additionnels (world/text/extra/<région>.js).
import rizieres from './rizieres.js';
import fleuve from './fleuve.js';
import bambous from './bambous.js';
import gobi from './gobi.js';
import tonnerre from './tonnerre.js';
import volcan from './volcan.js';
import fauves from './fauves.js';
import mer from './mer.js';
import fusang from './fusang.js';
import lune from './lune.js';
import rizieresX from './extra/rizieres.js';
import fleuveX from './extra/fleuve.js';
import bambousX from './extra/bambous.js';
import gobiX from './extra/gobi.js';
import tonnerreX from './extra/tonnerre.js';
import volcanX from './extra/volcan.js';
import fauvesX from './extra/fauves.js';
import merX from './extra/mer.js';
import fusangX from './extra/fusang.js';
import luneX from './extra/lune.js';
import { mergeTexts } from './merge.js';

export const TEXTS = {
  rizieres: mergeTexts(rizieres, rizieresX),
  fleuve: mergeTexts(fleuve, fleuveX),
  bambous: mergeTexts(bambous, bambousX),
  gobi: mergeTexts(gobi, gobiX),
  tonnerre: mergeTexts(tonnerre, tonnerreX),
  volcan: mergeTexts(volcan, volcanX),
  fauves: mergeTexts(fauves, fauvesX),
  mer: mergeTexts(mer, merX),
  fusang: mergeTexts(fusang, fusangX),
  lune: mergeTexts(lune, luneX)
};
