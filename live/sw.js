'use strict';
const cacheName='fandianjian-live-v1';
const resources=['/','/live.js','/nju.css','/live/theme.css','/hero-table.webp','/app-icon-192.png','/app-icon-512.png','/live/manifest.webmanifest'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(resources)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('fandianjian-live-') && key!==cacheName).map(key=>caches.delete(key)))));
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if (event.request.method!=='GET' || url.origin!==self.location.origin || !resources.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(()=>caches.match(url.pathname).then(response=>response||Response.error())));
});
