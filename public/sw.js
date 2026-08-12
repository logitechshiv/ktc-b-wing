/* KCT-3 B-Wing PWA service worker
 *
 * Safety rules:
 * - Never cache /api/* (auth + Mongo-backed CRUD)
 * - Never cache login / auth routes
 * - Never cache uploaded private files under /uploads
 * - Network-only for /_next/* (avoid stale hashed CSS/JS after deploy)
 * - Network-first for navigations; HTML shell offline fallback only
 */

const CACHE = "bwing-pwa-v3";

const PRECACHE = [
  "/manifest.json",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function shouldBypassCache(url) {
  const { pathname } = url;

  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/uploads/")) return true;
  if (pathname === "/sw.js") return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return true;
  }
  return false;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Network-only for APIs, auth, uploads, and Next hashed assets
  if (shouldBypassCache(url)) {
    event.respondWith(fetch(req));
    return;
  }

  // Network-first for app pages; keep a shell for offline navigations only
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Only cache successful same-origin navigations (HTML shell — no API data)
        if (
          res.ok &&
          req.mode === "navigate" &&
          (res.type === "basic" || res.type === "cors")
        ) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          return (
            (await caches.match("/offline.html")) ||
            new Response("Offline", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
        return Response.error();
      })
  );
});
