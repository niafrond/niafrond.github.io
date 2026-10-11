// Connexions de bordure entre cartes (données configurables, voir ../mapConnections.js).
//
// Chaque entrée : { from, dir: 'north' | 'south' | 'east' | 'west', to, offset?, align?, requires?, lockedMessage?, oneWay? }
//  - offset : décalage (tuiles) de l'origine de `to` dans le repère de `from`, le long de la bordure ;
//  - align  : 'start' | 'center' | 'end' (calcule le décalage à partir des tailles ; `offset` s'y ajoute) ;
//  - requires / lockedMessage : passage fermé tant que la condition de progression n'est pas remplie (comme `exit.requires`) ;
//  - oneWay : pas de connexion inverse automatique.
// Le sens inverse est déduit automatiquement. Une carte sans entrée garde ses bords infranchissables ;
// portes, escaliers et grottes restent des `exits` (WarpTrigger), pas des connexions.
//
// Exemple : { from: 'rizieres_village', dir: 'east', to: 'rizieres_wild', align: 'center' }
export const CONNECTIONS = [];
