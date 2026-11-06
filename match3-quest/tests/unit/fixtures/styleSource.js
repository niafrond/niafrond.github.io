// Source complet de la feuille de style du jeu : style.css + les feuilles style-*.css extraites (hors retro.css).
// Les tests « statiques » (recherche dans le CSS) lisent cet ensemble.
import { readdirSync, readFileSync } from 'fs';

const root = new URL('../../../', import.meta.url);

export const readStyleSource = () => readdirSync(root)
    .filter(f => /^style(?:-[a-z]+)?\.css$/.test(f))
    .sort((a, b) => (a === 'style.css' ? -1 : b === 'style.css' ? 1 : a.localeCompare(b)))
    .map(f => readFileSync(new URL(f, root), 'utf8'))
    .join('\n');
