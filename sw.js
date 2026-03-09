const CACHE_NAME = 'kalorijos-v1.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon.png'
];

// Įdiegti SW ir išsaugoti failus podėlyje
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
    // Iš karto perima valdybą nedelsiant
    self.skipWaiting();
});

// Atsikratyti senų cache versijų kai atsiranda naujas SW
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Užsitikrinam, kad naujas cache pradės veikti neuždarius naršyklės tabų
    return self.clients.claim();
});

// Traukti failus - pirmenybė tinklui, tada cache
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // Jei sėkmingai gavom iš interneto - atnaujinam ir cache
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    // Išsaugom tik jei tai ne kokio nors kito domeno keisti failai
                    if (event.request.url.startsWith(self.location.origin)) {
                        cache.put(event.request, responseClone);
                    }
                });
                return networkResponse;
            })
            .catch(() => {
                // Jei nėra interneto - imam iš cache
                return caches.match(event.request);
            })
    );
});
