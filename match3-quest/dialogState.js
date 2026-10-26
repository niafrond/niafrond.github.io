// État d'affichage d'un dialogue d'exploration (explorationView.js). Module pur (sans DOM).
//
// Un dialogue à choix doit montrer ses boutons dès sa dernière réplique, même si d'autres dialogues attendent derrière lui dans la file :
// on ne peut pas le fermer autrement (advanceDialog refuse d'avancer sans réponse), donc sans boutons il bloquerait toute la file.

/** { lastLine, showChoices, closing } : dernière réplique de l'entrée, boutons de choix à afficher, et vrai si le clic ferme la file entière. */
export function dialogFlags(entry, index, queueLength) {
    const lastLine = index >= entry.lines.length - 1;
    return {
        lastLine,
        showChoices: Boolean(entry.choices) && lastLine,
        closing: lastLine && queueLength === 1
    };
}
