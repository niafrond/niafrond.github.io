import { connectionRows, DIRS } from '../../../mapConnections.js';
import { tryMove, talkToNpc } from '../../../exploration.js';

// Sorties d'une carte : portes (`exits`) + repères des passages de bord (connexions, voir mapConnections.js). Les bordures de mer (`sea`,
// world/connections.js : tout un bord d'eau, franchi avec le Pas de Yu) ne sont pas des passages à pied : tests/unit/seaRoutes.test.js.
export const exitsOf = (screen, screens) => [...screen.exits, ...connectionRows(screens, screen).filter(r => !r.sea)];

// Franchit une sortie : marche jusqu'à sa case (`walkTo(s, x, y)`), puis, pour un passage de bord, fait le pas qui sort de la carte.
export function crossExit(s, exit, walkTo) {
    const res = walkTo(s, exit.x, exit.y);
    if (!exit.connection || res.type === 'transition') return res;
    const d = DIRS[exit.edge];
    let out = tryMove(s, d.dx, d.dy);
    if (out.type === 'talk' && out.recruit) { talkToNpc(s, out.npcId); out = tryMove(s, d.dx, d.dy); }   // une recrue attend sur la route : on lui parle d'abord
    return { ...out, fights: res.fights };
}
