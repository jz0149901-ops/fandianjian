'use strict';

const cachePrefix='fandianjian-static-';
const cacheName=cachePrefix+'v2';
const scope=self.registration.scope;
const assets=new Set(['app-icon-192.png','app-icon-512.png','meal.webp','hero-table.webp','package-rice.webp','package-tea.webp','package-noodle.webp','package-bistro.webp']
  .map(path=>new URL(path,scope).href));

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys
    .filter(key=>key.startsWith(cachePrefix) && key!==cacheName).map(key=>caches.delete(key)))));
});

self.addEventListener('fetch', event => {
  const request=event.request;
  if (request.method!=='GET' || request.destination!=='image' || !assets.has(request.url)) return;
  event.respondWith((async ()=>{
    try {
      const response=await fetch(request);
      if (response.ok && !response.redirected && response.headers.get('Content-Type')?.startsWith('image/')) {
        try {
          const cache=await caches.open(cacheName);
          await cache.put(request,response.clone());
        } catch {}
      }
      return response;
    } catch (error) {
      const image=await caches.match(request,{cacheName});
      if (image) return image;
      throw error;
    }
  })());
});
