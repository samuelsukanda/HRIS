const CACHE="hris-v1";
self.addEventListener("install",e=>{ e.waitUntil(caches.open(CACHE).then(c=> c.addAll(["/","/app","/admin"]))); self.skipWaiting(); });
self.addEventListener("fetch",e=>{
  const url=new URL(e.request.url);
  if(url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request).catch(()=> caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(r=> r|| fetch(e.request).catch(()=> caches.match("/"))));
  }
});
