// Exporte les tables d'étiquettes du JS (ports, mares) vers les ressources du noyau Kotlin.
// Usage : node tools/export-tags.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import HABITS_TAGS from '../../jardin/data/plants/habits-tags.js';
import POND_TAGS from '../../jardin/data/plants/pond-tags.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../core/src/main/resources');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'habits-tags.json'), JSON.stringify(HABITS_TAGS));
fs.writeFileSync(path.join(dir, 'pond-tags.json'), JSON.stringify(POND_TAGS));
console.log('habits-tags:', Object.keys(HABITS_TAGS).length, 'pond-tags:', Object.keys(POND_TAGS).length);
