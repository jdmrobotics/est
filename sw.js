const CACHE = 'ecosurvey-field-v0.8.0';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './src/styles.css',
  './src/main.js', './src/schema.js', './src/db.js', './src/export.js', './src/qaqc.js', './src/map.js', './src/basemap.js', './src/media_capture.js', './src/tracking.js', './src/zip.js',
  './src/validation.js', './src/species.js', './src/debrief.js', './icons/ecosurvey-icon.svg', './examples/Synthetic_Demo_Basemap.png', './examples/Synthetic_Demo_Basemap_metadata.json', './examples/EcoSurvey_species_list_template.csv'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
