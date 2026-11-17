// Source complet de la vue d'exploration : explorationView.js + les modules explorationView*.js extraits.
// Les tests « statiques » (recherche dans le source) lisent cet ensemble.
import { readdirSync, readFileSync } from 'fs';

const root = new URL('../../../', import.meta.url);

export const readExplorationViewSource = () => readdirSync(root)
    .filter(f => /^explorationView.*\.js$/.test(f))
    .sort()
    .map(f => readFileSync(new URL(f, root), 'utf8'))
    .join('\n');
