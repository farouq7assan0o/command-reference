/* Service worker - offline app-shell cache. Bump CACHE when assets change. */
const CACHE = 'cmdref-v1';
const ASSETS = [
  '.', 'index.html', 'exam.html',
  'css/styles.css', 'css/icons.css', 'css/exam.css',
  'js/commands.js', 'js/vars.js', 'js/groups.js', 'js/app.js', 'js/exam.js',
  'manifest.webmanifest'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // cache-first (offline reference; reload button + version bump handle updates)
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
