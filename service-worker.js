const APP_RELEASE = "20260921-1";
const CACHE_PREFIX = "youtube-title-search-shell-";
const CACHE_NAME = `${CACHE_PREFIX}${APP_RELEASE}`;
const STAGING_CACHE_NAME = `${CACHE_NAME}-staging`;
const APP_SHELL = [
  "./index.html",
  "./releases/20260921-1/styles.css",
  "./releases/20260921-1/manifest.webmanifest",
  "./releases/20260921-1/icons/app-icon.svg",
  "./releases/20260921-1/icons/app-icon-192.png",
  "./releases/20260921-1/icons/app-icon-512.png",
  "./releases/20260921-1/icons/apple-touch-icon.png",
  "./releases/20260921-1/js/app.js",
  "./releases/20260921-1/js/history.js",
  "./releases/20260921-1/js/pwaUpdate.js",
  "./releases/20260921-1/js/searchManager.js",
  "./releases/20260921-1/js/settings.js",
  "./releases/20260921-1/js/titleMatcher.js",
  "./releases/20260921-1/js/youtubeApi.js"
];

async function prepareCompleteShell() {
  await caches.delete(STAGING_CACHE_NAME);
  let targetTouched = false;
  try {
    const staging = await caches.open(STAGING_CACHE_NAME);
    const requests = APP_SHELL.map((url) => new Request(url, { cache: "reload" }));
    await staging.addAll(requests);

    const target = await caches.open(CACHE_NAME);
    const alreadyComplete = (await Promise.all(APP_SHELL.map((url) => target.match(url)))).every(Boolean);
    if (alreadyComplete) {
      await caches.delete(STAGING_CACHE_NAME);
      return;
    }
    targetTouched = true;
    await caches.delete(CACHE_NAME);
    const freshTarget = await caches.open(CACHE_NAME);
    for (const request of requests) {
      const response = await staging.match(request);
      if (!response) {
        throw new Error(`Missing staged app shell response: ${request.url}`);
      }
      await freshTarget.put(request, response.clone());
    }
    await caches.delete(STAGING_CACHE_NAME);
  } catch (error) {
    await caches.delete(STAGING_CACHE_NAME);
    if (targetTouched) {
      await caches.delete(CACHE_NAME);
    }
    throw error;
  }
}

async function verifyCurrentShell() {
  const cache = await caches.open(CACHE_NAME);
  for (const url of APP_SHELL) {
    if (!(await cache.match(url))) {
      throw new Error(`Incomplete app shell cache: ${url}`);
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(prepareCompleteShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await verifyCurrentShell();
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const shellUrls = new Set(APP_SHELL.map((path) => new URL(path, self.registration.scope).href));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match("./index.html");
      })
    );
    return;
  }

  if (shellUrls.has(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(request)) ?? fetch(request);
    })());
  }
});
