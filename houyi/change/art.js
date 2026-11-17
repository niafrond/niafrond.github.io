// Dessins des tuiles du mode Chang'e : cinq énergies de soin et la pleine lune (joker), en SVG en ligne (pas d'emoji, pas de police).
// Contour sombre unique, à-plats, mêmes conventions que icons.js. Aucune tuile de crâne ni de flèche n'existe dans ce mode.

const OL = '#2b2140';
const ART = {
    // Jade : disque bi percé, vert profond avec un éclat clair
    jade: `<circle cx="16" cy="16" r="12.5" fill="#2f9a6a" stroke="${OL}" stroke-width="1.6"/><circle cx="16" cy="16" r="4.6" fill="#173d2c" stroke="${OL}" stroke-width="1.2"/><path d="M8.2 11.5 A9 9 0 0 1 14 7.3" stroke="#a6efc8" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    // Lotus : cinq pétales roses autour d'un cœur doré
    lotus: `<g stroke="${OL}" stroke-width="1.3" fill="#ef8fb0"><path d="M16 4 C20 9 20 14 16 18 C12 14 12 9 16 4Z"/><path d="M5 12 C11 10 15 13 16 18 C10 19 6 17 5 12Z"/><path d="M27 12 C21 10 17 13 16 18 C22 19 26 17 27 12Z"/><path d="M9 25 C9 20 12 18 16 18 C15 23 13 26 9 25Z" fill="#f6b6cb"/><path d="M23 25 C23 20 20 18 16 18 C17 23 19 26 23 25Z" fill="#f6b6cb"/></g><circle cx="16" cy="17.5" r="2.6" fill="#f2c94c" stroke="${OL}" stroke-width="1"/>`,
    // Perle lunaire : perle violette nacrée avec un reflet
    perle: `<circle cx="16" cy="16" r="12" fill="#9b7fd1" stroke="${OL}" stroke-width="1.6"/><circle cx="16" cy="16" r="8.4" fill="#b9a2e6"/><ellipse cx="12.4" cy="11.8" rx="3.6" ry="2.2" fill="#f3ecff" transform="rotate(-30 12.4 11.8)"/><circle cx="21.5" cy="21" r="1.4" fill="#e0d3fb"/>`,
    // Eau céleste : goutte bleue
    eau: `<path d="M16 3.4 C22.5 11.4 25.6 15.6 25.6 19.8 A9.6 9.6 0 0 1 6.4 19.8 C6.4 15.6 9.5 11.4 16 3.4Z" fill="#4c9be0" stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"/><path d="M11 19.6 A5.4 5.4 0 0 0 15.4 25" stroke="#bfe0ff" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    // Énergie argentée : étoile à quatre branches
    argent: `<path d="M16 3 L19.2 12.8 L29 16 L19.2 19.2 L16 29 L12.8 19.2 L3 16 L12.8 12.8Z" fill="#cdd6e2" stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 8 L17.6 14.4 L24 16 L17.6 17.6 L16 24 L14.4 17.6 L8 16 L14.4 14.4Z" fill="#f5f8fc"/>`,
    // Goutte d'élixir (joker) : goutte ambrée lumineuse, éclat et deux étincelles. (Clé de moteur `lune` conservée ; rien de lunaire ici.)
    lune: `<path d="M16 2.8 C22.4 10.6 25.8 15 25.8 19.6 A9.8 9.8 0 0 1 6.2 19.6 C6.2 15 9.6 10.6 16 2.8Z" fill="#f2b632" stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 8 C20 13 22.4 16 22.4 19.4 A6.4 6.4 0 0 1 9.6 19.4 C9.6 16 12 13 16 8Z" fill="#ffd96a"/><path d="M11.2 19 A5 5 0 0 0 15 24.6" stroke="#fff6cf" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M25 5 L26 7.4 L28.4 8.4 L26 9.4 L25 11.8 L24 9.4 L21.6 8.4 L24 7.4Z" fill="#fff6cf" stroke="${OL}" stroke-width="0.8"/>`
};

export const TILE_ART = Object.keys(ART);

/** SVG de la tuile `kind` (viewBox 32×32) ; vide pour tout type inconnu : rien d'autre que les énergies et la lune n'existe ici. */
export function tileSvg(kind) {
    const body = ART[kind];
    return body ? `<svg class="change-tile-art" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${body}</svg>` : '';
}
