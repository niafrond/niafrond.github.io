// Compagnons de route et dialogues contextuels de Match3-Quest (données pures, sans DOM ; propriétaire : agent Scénario).
//
// COMPANIONS : personnages qui rejoignent le héros pendant l'aventure.
//   { id, name, title, npc, joinWhen }
//     - npc      : id d'un PNJ existant dont on réutilise le dessin pour le portrait de dialogue ;
//     - joinWhen : condition d'avancement (id de quête terminée, d'ennemi vaincu, de coffre ouvert ou de PNJ parlé) ; absente = d'emblée.
//
// BANTER : répliques de groupe, jouées UNE FOIS (exploration.js : collectBanter), quand le héros entre dans un lieu ou après un événement.
//   { id, companion, screen?, whenDone?, unless?, lines | scenes }
//     - companion : id (ou liste d'ids) : tous doivent avoir rejoint le groupe ;
//     - screen    : id d'écran (ou liste) où se trouve le héros ; absent = n'importe où ;
//     - whenDone  : condition d'avancement à remplir (événement ou choix récent) ; unless : condition qui annule la réplique ;
//     - scenes    : [{ speaker, lines }] (speaker : { name, title?, npc?, hero? }) ; sinon `speaker` + `lines` pour une seule voix.
//   Un compagnon commente un LIEU, une DÉCISION (chemin pris) ou un ÉVÉNEMENT ; jamais deux fois la même chose, bulles ≤ 160 caractères.

export const COMPANIONS = [];

export const BANTER = [];
