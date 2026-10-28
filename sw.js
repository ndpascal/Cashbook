const CACHE = 'cashbook-v3';
const CORE = ['./', 'index.html', 'firebase-config.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png', 'lib-firebase.js', 'lib-pdf.js', 'lib-xlsx.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// The page and its settings come from the network first (so updates show on the next open),
// falling back to the saved copy after 4 seconds or when offline.
function networkFirst(req) {
  return caches.open(CACHE).then(function (cache) {
    const net = fetch(req).then(function (res) {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    const timeout = new Promise(function (resolve) { setTimeout(resolve, 4000); });
    return Promise.race([net, timeout]).then(function (res) {
      return res || cache.match(req, { ignoreSearch: true }).then(function (hit) { return hit || net; });
    }).catch(function () {
      return cache.match(req, { ignoreSearch: true }).then(function (hit) { return hit || cache.match('index.html'); });
    });
  });
}

// Libraries, icons and fonts: answer from the saved copy, refresh it in the background.
function staleWhileRevalidate(req) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      const net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  });
}

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    const p = url.pathname;
    const fresh = e.request.mode === 'navigate' || p.endsWith('/') || p.endsWith('index.html') || p.endsWith('firebase-config.js');
    e.respondWith(fresh ? networkFirst(e.request) : staleWhileRevalidate(e.request));
    return;
  }
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(e.request));
  }
  // Firebase traffic (sign-in, Firestore) is never cached here; Firestore keeps its own offline copy.
});
