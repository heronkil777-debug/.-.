/* STOP! — service worker: jogo 100% offline depois do primeiro acesso */
const VERSAO = "stop-v1.0.0";
const ESSENCIAIS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/data.js",
  "./js/engine.js",
  "./js/app.js",
  "./assets/icone.svg",
  "./assets/icone-192.png",
  "./assets/icone-512.png",
  "./assets/baloo-2-latin-700-normal.woff2",
  "./assets/baloo-2-latin-800-normal.woff2",
  "./assets/nunito-latin-400-normal.woff2",
  "./assets/nunito-latin-600-normal.woff2",
  "./assets/nunito-latin-700-normal.woff2",
  "./assets/nunito-latin-800-normal.woff2"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSAO)
      .then((cache) => cache.addAll(ESSENCIAIS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  evento.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cacheado) => {
      const daRede = fetch(req).then((resposta) => {
        if (resposta && resposta.ok) {
          const copia = resposta.clone();
          caches.open(VERSAO).then((cache) => cache.put(req, copia)).catch(() => {});
        }
        return resposta;
      }).catch(() => cacheado);
      return cacheado || daRede;
    })
  );
});
