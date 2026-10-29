/* GEAP — un cache par portée et par version. */
'use strict';
const PREFIX='geap-'+"a0a62e43"+'-'+(()=>{let h=0;for(const c of self.registration.scope)h=(Math.imul(31,h)+c.charCodeAt(0))|0;return(h>>>0).toString(16);})()+'-';
const CACHE=PREFIX+"v_2c4bd20350614b228542";
const ASSETS=['./','./index.html','./app.css','./core.js','./runtime.js','./app.js','./manifest.webmanifest','./project.geap.json','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(caches.open(CACHE).then(async cache=>{if(event.request.mode==='navigate')return await cache.match('./index.html')||fetch(event.request);const cached=await cache.match(event.request,{ignoreSearch:true});return cached||fetch(event.request);}));
});