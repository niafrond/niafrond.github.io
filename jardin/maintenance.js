// Niveau d'entretien souhaité (jardin ou zone) et effort demandé par une essence (pur, sans DOM).

/** Niveaux proposés à l'utilisateur, du plus exigeant au plus tranquille. */
export const MAINTENANCE_LEVELS = [
  { id: 'green', label: 'Main verte', emoji: '🧤', desc: 'J’aime jardiner : tout est permis' },
  { id: 'low', label: 'Peu d’entretien', emoji: '🌿', desc: 'Quelques gestes par an' },
  { id: 'none', label: 'Pas d’entretien', emoji: '🛋', desc: 'On plante et on oublie' },
];

/** Niveau par id (undefined si inconnu). */
export function getMaintenanceLevel(id) {
  return MAINTENANCE_LEVELS.find((l) => l.id === id);
}

const BASE = { low: 1, medium: 2, high: 3 };
const PRUNE_LONG = 2; // plus de 2 mois de taille = taille régulière

/**
 * Effort d'entretien d'une essence : 1 (léger), 2 (moyen) ou 3 (soutenu).
 * Base `maintenance` (low=1, medium=2, high=3) ; +1 pour potager, pelouse (tonte), haie taillée, fruitier,
 * grands besoins en eau ou taille étalée sur plus de 2 mois ; −1 pour graminées, couvre-sols, arbustes
 * persistants rustiques et essences tolérantes au vent peu gourmandes en eau. Borné à 1–3.
 */
export function plantEffort(plant) {
  if (!plant) return 2;
  let e = BASE[plant.maintenance] || 2;
  const cat = plant.category;
  const demanding = cat === 'vegetable' || cat === 'lawn' || cat === 'hedge' || cat === 'fruit';
  if (demanding) e += 1;
  if (plant.water === 'high') e += 1;
  const prune = plant.care && Array.isArray(plant.care.pruneMonths) ? plant.care.pruneMonths.length : 0;
  if (prune > PRUNE_LONG) e += 1;
  if (cat === 'grass' || cat === 'groundcover') e -= 1;
  if (cat === 'shrub' && plant.foliage === 'evergreen' && typeof plant.hardiness === 'number' && plant.hardiness <= -10) e -= 1;
  if (!demanding && plant.windTolerant && plant.water === 'low') e -= 1;
  return Math.max(1, Math.min(3, e));
}

const EFFORT_LABEL = { 1: 'léger', 2: 'moyen', 3: 'soutenu' };
/** « léger » | « moyen » | « soutenu ». */
export function effortLabel(effort) {
  return EFFORT_LABEL[Math.max(1, Math.min(3, Math.round(Number(effort) || 2)))];
}
/** « 🧤×2 » : indicateur compact. */
export function effortBadge(effort) {
  return `🧤×${Math.max(1, Math.min(3, Math.round(Number(effort) || 2)))}`;
}

/** Niveau effectif d'une zone : le sien, sinon celui du jardin, sinon « green » (aucune restriction). */
export function levelForZone(garden, zone) {
  const z = zone && zone.maintenance;
  if (getMaintenanceLevel(z)) return z;
  const g = garden && garden.context && garden.context.maintenance;
  return getMaintenanceLevel(g) ? g : 'green';
}

/**
 * Une essence convient-elle au niveau d'entretien ?
 * → {ok, penalty (points retirés au score), bonus (points ajoutés), discouraged (écartée), text}.
 */
export function fitsMaintenance(plant, levelId) {
  const e = plantEffort(plant);
  const none = { ok: true, penalty: 0, bonus: 0, discouraged: false, text: '' };
  if (levelId === 'low') {
    if (e >= 3) return { ok: false, penalty: 25, bonus: 0, discouraged: false, text: 'Demande pas mal d’entretien : déconseillée si vous voulez peu d’entretien' };
    return { ...none, bonus: e === 1 ? 5 : 0, text: e === 1 ? 'Très peu d’entretien, parfait pour un jardin facile' : 'Entretien raisonnable (quelques gestes par an)' };
  }
  if (levelId === 'none') {
    if (e >= 3) return { ok: false, penalty: 60, bonus: 0, discouraged: true, text: 'Demande beaucoup d’entretien : à éviter dans un jardin sans entretien' };
    if (e === 2) return { ok: false, penalty: 30, bonus: 0, discouraged: false, text: 'Demande un entretien régulier : peu adaptée si on ne veut aucun entretien' };
    return { ...none, bonus: 10, text: 'Très peu d’entretien : on plante et on oublie' };
  }
  return none;
}
