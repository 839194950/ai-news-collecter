/* ai-radar Service Worker — NetworkFirst only, no pre-cache, instant self-update */
const CACHE = 'ai-radar-v3';

self.addEventListener('install', (_event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 所有同源请求统一走 NetworkFirst + 3s 超时降级缓存
  event.respondWith(networkFirstWithTimeout(request, 3000));
});

async function networkFirstWithTimeout(request, timeoutMs) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), timeoutMs)
  );

  try {
    const res = await Promise.race([fetch(request), timeoutPromise]);
    if (res && res.ok) {
      const clone = res.clone();
      caches.open(CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // 兜底空响应而非抛错
    return new Response('', { status: 200 });
  }
}
