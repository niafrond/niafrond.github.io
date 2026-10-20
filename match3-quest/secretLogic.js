// Logique pure du menu secret (testable sans charger game.js).
import { MAX_LEVEL, getXPRequiredForLevel } from "./experience.js";

export const SECRET_CLICKS = 6;
export const SECRET_WINDOW_MS = 3000;

// Compteur de clics rapprochés : renvoie true au SECRET_CLICKS-ième clic consécutif (fenêtre glissante).
export function createClickCounter(target = SECRET_CLICKS, windowMs = SECRET_WINDOW_MS, now = () => Date.now()) {
    let count = 0, last = 0;
    return () => {
        const t = now();
        count = t - last > windowMs ? 1 : count + 1;
        last = t;
        if(count >= target) { count = 0; return true; }
        return false;
    };
}

export function setHeroLevel(hero, level) {
    const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level)) || 1));
    hero.level = lvl;
    hero.xp = getXPRequiredForLevel(lvl);
    hero.xpToNextLevel = getXPRequiredForLevel(Math.min(MAX_LEVEL, lvl + 1));
    return lvl;
}
