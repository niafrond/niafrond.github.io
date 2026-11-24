// Étape 1 : contexte (localisation, exposition, sol, pente, vent).
import { h, toast } from './wizard.js';
import { getPosition, watchHeading, reverseCommune, fetchElevation, searchAddress } from '../geo.js';
import { climateForDepartement, adjustTminForAltitude, hardinessZone } from '../climate.js';

const ORIENT = [
  ['N', 'Nord', 0], ['NE', 'Nord-est', 45], ['E', 'Est', 90], ['SE', 'Sud-est', 135],
  ['S', 'Sud', 180], ['SW', 'Sud-ouest', 225], ['W', 'Ouest', 270], ['NW', 'Nord-ouest', 315],
];
const SOILS = [['clay', 'Argileux'], ['limestone', 'Calcaire'], ['sandy', 'Sableux'], ['loam', 'Limoneux'], ['humus', 'Humifère']];
const SLOPES = [['none', 'Nulle'], ['light', 'Légère'], ['strong', 'Forte']];
const WINDS = [['sheltered', 'Abrité'], ['moderate', 'Modéré'], ['exposed', 'Très exposé']];

export function orientationLabel(az) {
  if (az == null) return 'inconnue';
  const i = Math.round((((az % 360) + 360) % 360) / 45) % 8;
  return `${ORIENT[i][1]} (${Math.round(az)}°)`;
}

export function hardinessText(c) {
  try {
    if (!c || !c.departement) return null;
    const cl = climateForDepartement(c.departement);
    if (!cl) return null;
    let t = cl.tminC;
    if (c.altitude != null && !Number.isNaN(c.altitude)) t = adjustTminForAltitude(t, c.altitude);
    return `Zone de rusticité ${hardinessZone(t)} · températures minimales ≈ ${Math.round(t)} °C · pluviométrie ≈ ${cl.rainMm} mm/an`;
  } catch { return null; }
}

function select(id, label, options, value, onChange, unknownLabel = 'Je ne sais pas') {
  return h('div', { class: 'field' },
    h('label', { for: id }, label),
    h('select', { id, onchange: (e) => onChange(e.target.value || null) },
      h('option', { value: '' }, unknownLabel),
      options.map(([v, l]) => h('option', { value: v, selected: v === value }, l))));
}

export function mountContext(el, { garden, onChange }) {
  const c = garden.context;
  let stopHeading = null;
  let dead = false;
  const change = () => { garden.updatedAt = garden.updatedAt; onChange && onChange(garden); };

  const gpsStatus = h('p', { class: 'muted', role: 'status', 'aria-live': 'polite', id: 'gps-status' });
  const locBox = h('div', { class: 'summary', id: 'loc-summary', 'aria-live': 'polite' });
  const results = h('ul', { class: 'results', 'aria-label': 'Résultats de la recherche' });
  const headingBox = h('div', { class: 'compass', 'aria-live': 'polite' });
  const orientBox = h('div');

  function drawSummary() {
    const rows = [];
    if (c.commune) rows.push(h('li', null, '📍 ', h('strong', null, c.commune), c.region ? ` · ${c.region}` : ''));
    else if (c.location) rows.push(h('li', null, `📍 Position enregistrée (${c.location.lat.toFixed(4)}, ${c.location.lon.toFixed(4)})`));
    else rows.push(h('li', { class: 'muted' }, 'Localisation non renseignée : les essences ne seront pas filtrées selon le climat.'));
    if (c.location && c.location.accuracy != null) rows.push(h('li', { class: 'muted' }, `Précision GPS ≈ ${Math.round(c.location.accuracy)} m`));
    const ht = hardinessText(c);
    if (ht) rows.push(h('li', null, '❄️ ' + ht));
    locBox.replaceChildren(h('ul', null, rows));
  }

  async function resolveLocation(loc) {
    c.location = { lat: loc.lat, lon: loc.lon, ...(loc.accuracy != null ? { accuracy: loc.accuracy } : {}) };
    drawSummary(); change();
    gpsStatus.textContent = 'Recherche de la commune et de l’altitude…';
    const [com, alt] = await Promise.allSettled([reverseCommune(loc.lat, loc.lon), fetchElevation(loc.lat, loc.lon)]);
    if (dead) return;
    if (com.status === 'fulfilled' && com.value) {
      c.commune = com.value.commune ?? null;
      c.departement = com.value.departement ?? null;
      c.region = com.value.region ?? null;
    }
    if (alt.status === 'fulfilled' && typeof alt.value === 'number') {
      c.altitude = Math.round(alt.value);
      altInput.value = String(c.altitude);
    }
    const missing = [com.status === 'rejected' ? 'commune' : null, alt.status === 'rejected' ? 'altitude' : null].filter(Boolean);
    gpsStatus.textContent = missing.length ? `Impossible d’obtenir : ${missing.join(', ')} (hors ligne ?). Vous pourrez les saisir plus tard.` : 'Localisation enregistrée.';
    drawSummary(); change();
  }

  const gpsBtn = h('button', { class: 'btn btn-primary', type: 'button', id: 'btn-gps', onclick: async () => {
    gpsBtn.disabled = true;
    gpsStatus.textContent = 'Recherche de votre position… (patientez quelques secondes)';
    try {
      const pos = await getPosition({ samples: 5, timeoutMs: 20000 });
      if (!dead) await resolveLocation(pos);
    } catch (e) {
      if (!dead) gpsStatus.textContent = 'Position indisponible (' + (e && e.message ? e.message : 'permission refusée') + '). Utilisez la recherche d’adresse ci-dessous.';
    } finally { gpsBtn.disabled = false; }
  } }, '📍 Je suis dans mon jardin');

  const addrInput = h('input', { id: 'addr', type: 'search', placeholder: 'Ex. 12 rue des Lilas, Nantes', autocomplete: 'street-address', enterkeyhint: 'search' });
  const search = async (e) => {
    e && e.preventDefault();
    const q = addrInput.value.trim();
    if (q.length < 3) { toast('Saisissez au moins 3 caractères.'); return; }
    results.replaceChildren(h('li', { class: 'muted' }, 'Recherche…'));
    try {
      const found = await searchAddress(q);
      results.replaceChildren(...(found.length ? found.slice(0, 6).map((r) => h('li', null,
        h('button', { type: 'button', class: 'btn btn-block left', onclick: () => {
          results.replaceChildren();
          addrInput.value = r.label;
          resolveLocation({ lat: r.lat, lon: r.lon });
        } }, r.label))) : [h('li', { class: 'muted' }, 'Aucun résultat.')]));
    } catch { results.replaceChildren(h('li', { class: 'muted' }, 'Recherche impossible (hors ligne ?).')); }
  };

  const altInput = h('input', {
    id: 'altitude', type: 'number', inputmode: 'numeric', min: '-10', max: '4000', step: '1',
    value: c.altitude != null ? String(c.altitude) : '',
    onchange: (e) => { c.altitude = e.target.value === '' ? null : Number(e.target.value); drawSummary(); change(); },
  });

  function setOrientation(az) {
    c.orientation = az == null ? null : Math.round(((az % 360) + 360) % 360);
    c.northAngle = c.orientation == null ? 0 : (360 - c.orientation) % 360;
    drawOrient(); change();
  }
  function stopCompass() { if (stopHeading) { try { stopHeading(); } catch { /* */ } stopHeading = null; } headingBox.replaceChildren(); }
  function drawOrient() {
    const nearest = c.orientation == null ? '' : ORIENT[Math.round(c.orientation / 45) % 8][0];
    orientBox.replaceChildren(
      h('p', { class: 'muted' }, 'Placez-vous dos à la maison, face au jardin : le fond du jardin est la direction à renseigner.'),
      h('p', null, 'Exposition du fond du jardin : ', h('strong', { id: 'orient-label' }, orientationLabel(c.orientation))),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', type: 'button', id: 'btn-compass', onclick: startCompass }, '🧭 Utiliser la boussole')),
      headingBox,
      h('div', { class: 'field' },
        h('label', { for: 'orient-sel' }, 'Ou choisir à la main'),
        h('select', { id: 'orient-sel', onchange: (e) => setOrientation(e.target.value === '' ? null : Number(e.target.value)) },
          h('option', { value: '' }, 'Je ne sais pas'),
          ORIENT.map(([id, l, az]) => h('option', { value: String(az), selected: id === nearest && c.orientation != null && c.orientation % 45 === 0 }, `${l} (${id})`)))));
  }
  function startCompass() {
    if (stopHeading) { stopCompass(); return; }
    let last = null;
    headingBox.replaceChildren(h('p', { class: 'muted' }, 'Pointez le haut du téléphone vers le fond du jardin. Si le cap saute, dessinez un 8 dans l’air pour calibrer.'));
    const val = h('strong', { class: 'heading-val' }, '…');
    const ok = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { if (last != null) { setOrientation(last); stopCompass(); } } }, 'Valider ce cap');
    headingBox.append(h('p', null, 'Cap : ', val), ok);
    try {
      stopHeading = watchHeading((hd) => {
        const deg = typeof hd === 'number' ? hd : hd && hd.heading;
        if (typeof deg !== 'number') return;
        last = deg; val.textContent = orientationLabel(deg);
      }) || null;
    } catch (e) { headingBox.replaceChildren(h('p', { class: 'notice' }, 'Boussole indisponible : choisissez l’exposition à la main.')); }
  }

  el.replaceChildren(
    h('section', { class: 'card' },
      h('h2', null, 'Où est votre jardin ?'),
      h('p', { class: 'muted' }, 'Le lieu sert à déduire le climat, l’altitude et la rusticité des plantes.'),
      gpsBtn, gpsStatus,
      h('form', { class: 'row', onsubmit: search },
        h('label', { class: 'sr-only', for: 'addr' }, 'Adresse ou commune'),
        addrInput,
        h('button', { class: 'btn', type: 'submit', id: 'btn-search' }, 'Rechercher')),
      results, locBox,
      h('div', { class: 'field' }, h('label', { for: 'altitude' }, 'Altitude (m)'), altInput)),
    h('section', { class: 'card' }, h('h2', null, 'Exposition'), orientBox),
    h('section', { class: 'card' },
      h('h2', null, 'Terrain (facultatif)'),
      select('soil', 'Type de sol', SOILS, c.soil, (v) => { c.soil = v; change(); }),
      select('slope', 'Pente', SLOPES, c.slope, (v) => { c.slope = v; change(); }),
      select('wind', 'Exposition au vent', WINDS, c.wind, (v) => { c.wind = v; change(); }),
      h('div', { class: 'field' },
        h('label', { for: 'roof' }, 'Surface de toit pour récupérer l’eau de pluie (m², facultatif)'),
        h('input', { id: 'roof', type: 'number', inputmode: 'decimal', min: '0', step: '1', value: c.roofArea != null ? String(c.roofArea) : '',
          onchange: (e) => { c.roofArea = e.target.value === '' ? null : Number(e.target.value); change(); } }))));
  drawSummary();
  drawOrient();
  return () => { dead = true; stopCompass(); el.replaceChildren(); };
}
