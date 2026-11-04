// Instantané du monde assemblé : world/snapshot.js = résultat de assembleWorld (écrans + quêtes) avec la configuration d'événements par défaut.
// Pourquoi : l'assemblage procédural (world/levelDesign, expand, junctions, structures…) coûte ≈ 2 s sur un PC et plus de 10 s sur un vieux
// téléphone à chaque démarrage, pour un résultat identique à chaque fois. story.js lit l'instantané quand aucun événement n'est forcé par
// l'URL (?events=) et retombe sur l'assemblage sinon.
// À relancer après toute modification de story.js, world/ ou events/ :  npm run world:snapshot
// (tests/unit/worldSnapshot.test.js vérifie que l'instantané est à jour).
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

export const SNAPSHOT_FILE = new URL('../world/snapshot.js', import.meta.url);
const HEADER = '// Généré par tools/build-world-snapshot.mjs (npm run world:snapshot) — ne pas modifier à la main.\n';

/** Contenu attendu de world/snapshot.js pour un monde donné. */
export const snapshotSource = world => `${HEADER}export default ${JSON.stringify(world)};\n`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { buildWorld } = await import('../story.js');
    const source = snapshotSource(buildWorld());
    writeFileSync(SNAPSHOT_FILE, source);
    console.log(`world/snapshot.js : ${(source.length / 1024).toFixed(0)} Ko`);
}
