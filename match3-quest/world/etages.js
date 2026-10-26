// Étages cachés : une pièce à l'étage de certaines maisons, où se cache un coffre verrouillé par une énigme à plateau (puzzle/levels.js).
// La maison reçoit un escalier (ancre « 9 » posée à l'angle nord-ouest de sa grille, qui doit être un sol libre) et l'étage est un intérieur
// ordinaire (sortie « v » vers la maison). Données seules : `applyEtages` les fusionne dans `map.interiors` à l'assemblage du monde.
const GRIDS = {
    // même gabarit pour tous : le coffret est niché derrière un meuble, à l'angle nord-est
    push: ['##########', '#.##....2#', '#.##.##..#', '#........#', '#...S....#', '#####v####'],
    mirror: ['##########', '#..#...#2#', '#........#', '#.##..##.#', '#...S....#', '#####v####'],
    slide: ['##########', '#2..##...#', '#.#....#.#', '#........#', '#...S....#', '#####v####']
};

const e = (region, house, mode, puzzle, gold, name, arrival, label, openText) => ({ region, house, id: `${house}_etage`, mode, puzzle, gold, name, arrival, label, openText });

export const ETAGES = [
    e('rizieres', 'rizieres_h_grenier', 'push', 'riz_jarres', 15, 'Charpente du grenier', ['Une échelle de meunier grimpe sous le toit : entre les poutres, des jarres de grain s\'alignent comme des soldats.'], 'Coffret de la charpente', 'Un coffret glissé entre deux poutres, derrière les dernières jarres.'),
    e('gobi', 'gobi_h_ma', 'push', 'gobi_jarres', 75, 'Mezzanine de l\'entrepôt', ['Une mezzanine de planches, où le marchand Ma range ce qu\'il ne vend jamais : des jarres d\'eau pleines à ras bord.'], 'Coffret de la mezzanine', 'Un coffret ferré, caché derrière les jarres d\'eau de la mezzanine.'),
    e('fauves', 'fauves_h_wu', 'push', 'fauves_jarres', 165, 'Soupente du pavillon', ['Sous le toit du pavillon, une soupente basse où le chasseur Wu entrepose le grain de ses chevaux dans des jarres de terre.'], 'Coffret de la soupente', 'Un coffret de chasseur, calé derrière les jarres de la soupente.'),
    e('marees', 'marees_h_cormoran', 'push', 'marees_jarres', 300, 'Perchoir des cormorans', ['Une échelle mène au perchoir des cormorans. Des jarres de sel y sèchent, pleines de la dernière marée.'], 'Jarre du perchoir', 'Une jarre à double fond, coincée derrière les jarres de sel du perchoir.'),
    e('volcan', 'volcan_h_yan', 'mirror', 'volcan_miroirs', 135, 'Galerie du petit temple', ['Un escalier de basalte monte à la galerie du temple. Des miroirs de bronze poli y renvoient la lueur du cratère.'], 'Coffret de la galerie', 'Un coffret d\'offrande, scellé dans le mur de la galerie.'),
    e('fleuve', 'fleuve_h_ecrivain', 'mirror', 'fleuve_miroirs', 30, 'Mansarde de l\'écrivain public', ['Sous les tuiles, la mansarde de l\'écrivain public : des miroirs ternis y servent à lire les lettres à contre-jour.'], 'Coffret de la mansarde', 'Un coffret de lettré, rangé derrière les miroirs de la mansarde.'),
    e('lune', 'lune_h_veilleuse', 'mirror', 'lune_miroirs', 240, 'Lanterne de la veilleuse', ['Tout en haut de la maison, la lanterne de la veilleuse : ici, la lumière de la lune se règle à la main, miroir après miroir.'], 'Coffret de la lanterne', 'Un coffret d\'argent, glissé sous la lampe de la veilleuse.'),
    e('fusang', 'fusang_h_astronome', 'mirror', 'fusang_miroirs', 225, 'Coupole de l\'observatoire', ['Une échelle de bambou grimpe jusqu\'à la coupole de Mère Xing, tapissée de miroirs pour suivre le soleil du matin.'], 'Coffret de la coupole', 'Un coffret de laque, tapi sous le télescope de la coupole.'),
    e('bambous', 'bambous_h_the', 'slide', 'bambous_charrette', 45, 'Étage de la maison de thé', ['À l\'étage de la maison de thé, une réserve encombrée de caisses et de brouettes à tirer pour passer.'], 'Coffret de la réserve', 'Un coffret de thé précieux, au fond de la réserve de l\'étage.'),
    e('tonnerre', 'tonnerre_h_auberge', 'slide', 'tonnerre_charrette', 105, 'Grenier de l\'auberge', ['Au grenier de l\'auberge, des charrettes démontées et des tonneaux barrent le passage jusqu\'au fond.'], 'Coffret du grenier', 'Un coffret de voyageur oublié, au fond du grenier de l\'auberge.'),
    e('mer', 'mer_h_marin', 'slide', 'mer_charrette', 195, 'Étage de la maison du marin', ['À l\'étage, le marin Bao entasse ses chariots de filets et ses caisses de lest. Il faudra les pousser pour avancer.'], 'Coffret du marin', 'Un coffret de marin, calé derrière les chariots de filets.'),
    e('marees', 'marees_h_lanternes', 'slide', 'marees_charrette', 480, 'Étage des bateaux-lanternes', ['À l\'étage de l\'atelier, des chariots chargés de coques de bateaux-lanternes barrent la longue salle de séchage.'], 'Caisse de l\'étage', 'Une caisse de cire et de sel, derrière les chariots de séchage.')
];

/** Escalier de la maison (ancre « 9 » à l'angle nord-ouest) et intérieur d'étage pour chaque entrée de `ETAGES` de la région. */
export function applyEtages(region, interiors) {
    const mine = ETAGES.filter(x => x.region === region);
    if (!mine.length) return interiors;
    const floors = [];
    const patched = interiors.map(i => {
        const et = mine.find(x => x.house === i.id);
        if (!et) return i;
        const grid = i.grid.map((row, y) => (y === 1 ? `${row[0]}9${row.slice(2)}` : row));
        floors.push({
            id: et.id, floorOf: i.id, grid: GRIDS[et.mode], name: et.name, arrival: et.arrival,
            chests: [{ id: `${et.id}_chest`, at: '2', gold: et.gold, puzzle: et.puzzle, label: et.label, openText: et.openText }]
        });
        return { ...i, grid, exits: [...(i.exits || []), { at: '9', to: et.id, label: et.name, stairs: 'up' }] };
    });
    return [...patched, ...floors];
}
