// Source complet du moteur de combat : game.js + les modules game*.js extraits.
// Les tests « statiques » (recherche dans le source) lisent cet ensemble.
import { readdirSync, readFileSync } from 'fs';

const root = new URL('../../../', import.meta.url);

export const readGameSource = () => readdirSync(root)
    .filter(f => /^game(?:[A-Z].*)?\.js$/.test(f) && f !== 'gameOptions.js')
    .sort()
    .map(f => readFileSync(new URL(f, root), 'utf8'))
    .join('\n');
