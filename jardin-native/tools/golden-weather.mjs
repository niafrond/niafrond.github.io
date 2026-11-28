// Golden de la météo (weather.js, parties pures : analyse de la réponse, URL, clé de cache).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseOpenMeteo, weatherUrl, cacheKey } from '../../jardin/weather.js';

const here = dirname(fileURLToPath(import.meta.url));
const inputs = [
  { daily: { time: ['2026-06-01', '2026-06-02'], precipitation_sum: [0, 4.2], et0_fao_evapotranspiration: [4.1, null], temperature_2m_min: [11, 12], temperature_2m_max: [24, 36] } },
  { daily: { time: ['2026-06-01', '2026-06-02', '2026-06-03'], precipitation_sum: [1.5], temperature_2m_max: ['30', 31.5, null] } },
  { daily: { time: [] } },
  { daily: { time: ['2026-07-01'], precipitation_sum: [-0.5], et0_fao_evapotranspiration: [1e-3], temperature_2m_min: [-12.25], temperature_2m_max: [0] } },
  { daily: {} }, {}, null, { daily: { time: 'x' } },
];
const parsed = inputs.map((j) => { try { return { ok: parseOpenMeteo(j) }; } catch (e) { return { error: e.message }; } });
const coords = [[48.85661, 2.35222], [0, 0], [-1.55, 47.2], [43.6045, 1.4442], [2.0005, 3.0015], [-0.0004, 45.1235], [48.8, 2.3], [12.3456789, -7.7777777]];
const days = [7, 1, 0, 16, 20, 2.5, 7.4, 3.5, -2];
const urls = coords.flatMap(([la, lo]) => days.map((d) => ({ la, lo, d, url: weatherUrl(la, lo, d) })));
const keys = coords.map(([la, lo]) => ({ la, lo, key: cacheKey(la, lo) }));
mkdirSync(resolve(here, '../golden'), { recursive: true });
writeFileSync(resolve(here, '../golden/weather.json'), JSON.stringify({ inputs, parsed, urls, keys }));
console.log('golden weather ok');
