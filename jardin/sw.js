// Service worker : cache hors ligne des fichiers statiques (stale-while-revalidate).
const CACHE = 'jardin-v4';
const FILES = [
  './', 'index.html', 'style.css', 'desktop.css', 'app.js', 'manifest.webmanifest', 'icon.svg',
  'model.js', 'geometry.js', 'sun.js', 'storage.js', 'climate.js', 'catalog.js', 'recommend.js',
  'weather.js', 'geo.js', 'notify.js', 'watering.js', 'advice.js', 'render.js', 'transfer.js', 'qr.js', 'vendor/qrcode.js',
  'data/climate.js', 'data/plants/index.js', 'data/plants/woody.js', 'data/plants/herbaceous.js',
  'ui/home.js', 'ui/wizard.js', 'ui/step-context.js', 'ui/step-wished.js', 'ui/step-sun.js', 'ui/step-plants.js',
  'ui/draw.js', 'ui/draw.css', 'ui/draw-util.js', 'ui/plan-step.js', 'ui/advice-screen.js', 'ui/settings.js', 'ui/share-screen.js', 'ui/import-screen.js',
  'items.js', 'render-items.js', 'render3d.js', 'render-common.js', 'photos.js', 'pricing.js', 'ui/step-items.js', 'ui/draw-items.js', 'ui/draw-items.css', 'ui/pop.js', 'ui/draw-zones.js', 'ui/draw-contour.js', 'ui/gps-survey-ui.js', 'gps-survey.js', 'ui/draw-sun.js', 'ui/north-pop.js',
  'data/plants/extras-woody.js', 'data/plants/extras-herbaceous.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('jardin-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // API météo/géo : réseau direct (leur repli est géré par l'app)
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || (req.mode === 'navigate' ? c.match('index.html') : Response.error());
  }));
});
