const CACHE_NAME = "talkingston-public-v1";
const PUBLIC_ASSETS = ["/offline.html", "/talkingston-icon-192.svg", "/talkingston-icon-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/") || url.pathname.includes("supabase")) return;
  if (!["document", "image", "style", "font"].includes(request.destination) && url.pathname !== "/manifest.webmanifest") return;
  event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached || (request.destination === "document" ? caches.match("/offline.html") : Response.error()))));
});
