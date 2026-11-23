// Pet Preview service worker. cb384d014d01 and the precache list are filled in by scripts/build.mjs.
const VERSION = "cb384d014d01";
// Cache names carry the scope path, so two copies on one origin (for example two sub-paths on a
// shared Pages host) never delete each other's caches.
const CACHE_PREFIX = "petpreview-" + new URL(self.registration.scope).pathname;
const CACHE = CACHE_PREFIX + VERSION;
const PRECACHE = [
  "./",
  "THIRD_PARTY_NOTICES.txt",
  "app.23e9c7c1.js",
  "coat-worker.3714a492.js",
  "fonts/FONT-LICENSES.txt",
  "fonts/caveat-latin-600-normal.woff2",
  "fonts/fraunces-latin-600-normal.woff2",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "manifest.webmanifest",
  "pets/cloudbird/mascot-sleep.json",
  "pets/cloudbird/mascot-sleep.webp",
  "pets/cloudbird/mascot-stand.json",
  "pets/cloudbird/mascot-stand.webp",
  "pets/cloudbird/painted-sleep.json",
  "pets/cloudbird/painted-sleep.webp",
  "pets/cloudbird/painted-stand.json",
  "pets/cloudbird/painted-stand.webp",
  "pets/dragonling/mascot-sleep.json",
  "pets/dragonling/mascot-sleep.webp",
  "pets/dragonling/mascot-stand.json",
  "pets/dragonling/mascot-stand.webp",
  "pets/dragonling/painted-sleep.json",
  "pets/dragonling/painted-sleep.webp",
  "pets/dragonling/painted-stand.json",
  "pets/dragonling/painted-stand.webp",
  "pets/fox/mascot-sleep.json",
  "pets/fox/mascot-sleep.webp",
  "pets/fox/mascot-stand.json",
  "pets/fox/mascot-stand.webp",
  "pets/fox/painted-sleep.json",
  "pets/fox/painted-sleep.webp",
  "pets/fox/painted-stand.json",
  "pets/fox/painted-stand.webp",
  "pets/index.json",
  "pets/moth/mascot-sleep.json",
  "pets/moth/mascot-sleep.webp",
  "pets/moth/mascot-stand.json",
  "pets/moth/mascot-stand.webp",
  "pets/moth/painted-sleep.json",
  "pets/moth/painted-sleep.webp",
  "pets/moth/painted-stand.json",
  "pets/moth/painted-stand.webp",
  "pets/mushroompup/mascot-sleep.json",
  "pets/mushroompup/mascot-sleep.webp",
  "pets/mushroompup/mascot-stand.json",
  "pets/mushroompup/mascot-stand.webp",
  "pets/mushroompup/painted-sleep.json",
  "pets/mushroompup/painted-sleep.webp",
  "pets/mushroompup/painted-stand.json",
  "pets/mushroompup/painted-stand.webp",
  "pets/otter/mascot-sleep.json",
  "pets/otter/mascot-sleep.webp",
  "pets/otter/mascot-stand.json",
  "pets/otter/mascot-stand.webp",
  "pets/otter/painted-sleep.json",
  "pets/otter/painted-sleep.webp",
  "pets/otter/painted-stand.json",
  "pets/otter/painted-stand.webp",
  "pets/sprite/mascot-sleep.json",
  "pets/sprite/mascot-sleep.webp",
  "pets/sprite/mascot-stand.json",
  "pets/sprite/mascot-stand.webp",
  "pets/sprite/painted-sleep.json",
  "pets/sprite/painted-sleep.webp",
  "pets/sprite/painted-stand.json",
  "pets/sprite/painted-stand.webp",
  "pets/tortoise/mascot-sleep.json",
  "pets/tortoise/mascot-sleep.webp",
  "pets/tortoise/mascot-stand.json",
  "pets/tortoise/mascot-stand.webp",
  "pets/tortoise/painted-sleep.json",
  "pets/tortoise/painted-sleep.webp",
  "pets/tortoise/painted-stand.json",
  "pets/tortoise/painted-stand.webp",
  "styles.f25ae3c0.css"
];
const HASHED_ASSET = /\.[0-9a-f]{8}\.(?:js|css)$/;
const API_PATH = /\/api\//;
// The phone bench lives under bench/ in the preview packet. It is not part of the app: its files are not precached
// (the engine files are about 3 MB) and this worker leaves every request under that path to the network, so a
// navigation to bench/ is never answered with the cached app page.
const BENCH_PATH = new URL("bench/", self.registration.scope).pathname;

// The app's own page: the scope root and its index.html. Every other document is a separate page, not the app.
const SHELL_PATHS = [new URL("./", self.registration.scope).pathname, new URL("index.html", self.registration.scope).pathname];

function abs(path) {
  return new URL(path, self.registration.scope).href;
}

self.addEventListener("install", (event) => {
  // No skipWaiting here: the new version waits until the player opens the app again
  // or taps "Refresh now" (which sends SKIP_WAITING).
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((p) => new Request(abs(p), { cache: "reload" })))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && !k.slice(CACHE_PREFIX.length).includes("/") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();
  if (data.type === "GET_VERSION" && event.source) event.source.postMessage({ type: "VERSION", version: VERSION });
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== new URL(self.registration.scope).origin) return;
  if (url.pathname.startsWith(BENCH_PATH)) return;

  // API: network only, never cached. Offline gives a small JSON error the app can handle.
  if (API_PATH.test(url.pathname)) {
    event.respondWith(
      fetch(req).catch(
        () => new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "Content-Type": "application/json" } }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    // Only the app's own page gets the cached app shell. Any other document on this origin (THIRD_PARTY_NOTICES.txt,
    // FONT-LICENSES.txt, a page a later version adds) comes from the network and is saved for offline; the saved copy
    // answers only when the network fails. It is never the app page.
    if (!SHELL_PATHS.includes(url.pathname)) {
      event.respondWith(
        caches.open(CACHE).then(async (cache) => {
          try {
            const res = await fetch(req);
            if (res.ok) cache.put(req, res.clone());
            return res;
          } catch {
            const saved = await cache.match(req, { ignoreSearch: true });
            if (saved) return saved;
            return new Response("This page is not saved for offline use. Reconnect and try again.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }
        }),
      );
      return;
    }
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = (await cache.match(req, { ignoreSearch: true })) || (await cache.match(abs("./")));
        if (hit) return hit;
        try {
          return await fetch(req);
        } catch {
          return new Response("Pet Preview is offline and has no saved copy yet. Reconnect once and reopen.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      }),
    );
    return;
  }

  // Hashed assets and the rest of the shell: cache first (hashed files never change under one name).
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && HASHED_ASSET.test(url.pathname)) cache.put(req, res.clone());
      return res;
    }),
  );
});
