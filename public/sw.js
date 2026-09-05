/**
 * CaféSmart service worker.
 *
 * Caching strategy (per security + PWA spec):
 * - Sensitive API routes (/api/*): NETWORK-ONLY. Never cached — wallet
 *   balances, orders and session data must never be served stale from
 *   on-device storage (shared-device leakage + stale-balance risk).
 *   (Deliberate deviation from a generic "network-first for APIs" pattern;
 *   approve before changing.)
 * - App navigations: network-first → pages cache → /offline fallback.
 * - Same-origin statics (/_next/static, /icons, fonts, images):
 *   stale-while-revalidate.
 * - Allowlisted remote images/fonts: cache-first (bounded, 60 entries).
 * - Non-GET requests: ignored (pass through to network).
 *
 * Bump CACHE_VERSION on breaking shell changes to force a clean takeover.
 */

/* eslint-disable no-restricted-globals */

const CACHE_VERSION = "cafesmart-v1";
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.webmanifest",
];

const REMOTE_CACHE_HOSTS = new Set([
  "images.unsplash.com",
  "res.cloudinary.com",
  "lh3.googleusercontent.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
]);

const MAX_RUNTIME_ENTRIES = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: "reload" })))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_RUNTIME_ENTRIES) {
    await cache.delete(keys[0]);
    return trimCache(cache);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  const sameOrigin = url.origin === self.location.origin;

  // ── Sensitive APIs: network-only, never cached ──
  if (sameOrigin && url.pathname.startsWith("/api/")) return;

  // ── Navigations: network-first → cache → offline fallback ──
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(PAGES_CACHE);
          cache.put(request, response.clone());
          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match("/offline");
          if (offline) return offline;
          return Response.error();
        }
      })()
    );
    return;
  }

  // ── Statics: stale-while-revalidate ──
  const isSameOriginStatic =
    sameOrigin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      /\.(png|svg|ico|woff2?)$/.test(url.pathname));

  if (isSameOriginStatic || REMOTE_CACHE_HOSTS.has(url.hostname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then(async (response) => {
            if (response && (response.ok || response.type === "opaque")) {
              await cache.put(request, response.clone());
              await trimCache(cache);
            }
            return response;
          })
          .catch(() => undefined);
        return cached || (await network) || Response.error();
      })()
    );
  }
});
