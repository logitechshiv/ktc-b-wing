const CACHE = "bwing-v2";

// Do NOT precache Next.js HTML shells — hashed CSS/JS change every build.
// Precaching old "/" or pages causes unstyled / broken UI after deploys.
const PRECACHE = ["/manifest.json"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function shouldBypassCache(url) {
  const { pathname } = url;
  // Always network for Next internals, APIs, and auth pages
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) return true;
  if (pathname === "/sw.js") return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-only for Next assets & APIs — prevents stale CSS hash mismatches
  if (shouldBypassCache(url)) {
    event.respondWith(fetch(req));
    return;
  }

  // Network-first for app pages; cache successful HTML as offline fallback only
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.mode === "navigate") {
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
            (await caches.match("/login")) ||
            (await caches.match("/dashboard")) ||
            Response.error()
          );
        }
        return Response.error();
      })
  );
});
