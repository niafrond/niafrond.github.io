// Catalogue complet des essences : concatène les fiches ligneuses et herbacées.
import woody from './woody.js';
import herbaceous from './herbaceous.js';

export const plants = [...woody, ...herbaceous];
export const plantsById = Object.fromEntries(plants.map((p) => [p.id, p]));
export default plants;
