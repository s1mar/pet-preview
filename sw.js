// Pet Preview service worker. a03f91f3f4b9 and the precache list are filled in by scripts/build.mjs.
const VERSION = "a03f91f3f4b9";
// Cache names carry the scope path, so two copies on one origin (for example two sub-paths on a
// shared Pages host) never delete each other's caches.
const CACHE_PREFIX = "petpreview-" + new URL(self.registration.scope).pathname;
const CACHE = CACHE_PREFIX + VERSION;
const PRECACHE = [
  "./",
  "app.571f69e9.js",
  "coat-worker.9c14986b.js",
  "fonts/FONT-LICENSES.txt",
  "fonts/caveat-latin-600-normal.woff2",
  "fonts/fraunces-latin-600-normal.woff2",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "manifest.webmanifest",
  "pets/cloudbird/mascot-stand.json",
  "pets/cloudbird/mascot-stand.webp",
  "pets/cloudbird/painted-stand.json",
  "pets/cloudbird/painted-stand.webp",
  "pets/dragonling/mascot-stand.json",
  "pets/dragonling/mascot-stand.webp",
  "pets/dragonling/painted-stand.json",
  "pets/dragonling/painted-stand.webp",
  "pets/fox/mascot-stand.json",
  "pets/fox/mascot-stand.webp",
  "pets/fox/painted-sleep.json",
  "pets/fox/painted-sleep.webp",
  "pets/fox/painted-stand.json",
  "pets/fox/painted-stand.webp",
  "pets/index.json",
  "pets/mushroompup/mascot-stand.json",
  "pets/mushroompup/mascot-stand.webp",
  "pets/mushroompup/painted-stand.json",
  "pets/mushroompup/painted-stand.webp",
  "pets/sprite/painted-sleep.json",
  "pets/sprite/painted-sleep.webp",
  "pets/sprite/painted-stand.json",
  "pets/sprite/painted-stand.webp",
  "styles.293573e5.css"
];
const HASHED_ASSET = /\.[0-9a-f]{8}\.(?:js|css)$/;
const API_PATH = /\/api\//;
// The phone bench lives under bench/ in the preview packet. It is not part of the app: its files are not precached
// (the engine files are about 3 MB) and this worker leaves every request under that path to the network, so a
// navigation to bench/ is never answered with the cached app page.
const BENCH_PATH = new URL("bench/", self.registration.scope).pathname;

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
