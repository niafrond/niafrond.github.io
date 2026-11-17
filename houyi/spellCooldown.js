// Temps de recharge des sorts : un sort doté de `cooldown` (en tours complets) ne peut pas être relancé tout de suite.
// Le compte à rebours avance à la fin de chaque tour de l'ennemi : un tour bonus ne le fait donc pas avancer.
// Remis à zéro au début de chaque combat. Jamais sauvegardé.
const left = new Map();

export const spellCooldownLeft = id => left.get(id) || 0;

export function startSpellCooldown(spell){
    const turns = Math.floor(spell?.cooldown || 0);
    if(turns > 0) left.set(spell.id, turns);
}

// Avance d'un tour ; renvoie les ids des sorts de nouveau disponibles.
export function tickSpellCooldowns(){
    const ready = [];
    for(const [id, n] of [...left]){
        if(n <= 1){ left.delete(id); ready.push(id); }
        else left.set(id, n - 1);
    }
    return ready;
}

export const resetSpellCooldowns = () => left.clear();
