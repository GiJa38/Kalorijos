// Paprastas Service Workeris skirtas tenkinti PWA (Progressive Web App) diegimo reikalavimus Chrome naršyklėje.
// Ši versija nieko ne-cache'ina, tik "klauso" (listen) tam, kad telefonas suprastų, jog tai tikra programėlė.

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Tiesiog praleidžiama užklausa internetui
    event.respondWith(fetch(event.request));
});
