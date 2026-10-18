// ============================================================
//  SERVICE WORKER — faz o app abrir sem internet
//  Estratégia: responde na hora com a cópia guardada e, em paralelo,
//  busca a versão nova no GitHub para a próxima abertura.
// ============================================================

const CACHE = "farol-v2";

const ARQUIVOS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/datas.js",
  "js/dados.js",
  "js/contas.js",
  "js/historico.js",
  "js/cupom.js",
  "js/app.js",
  "icones/icone-192.png",
  "icones/icone-512.png",
  "icones/icone-maskable-512.png",
  "icones/icone-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const guardado = await cache.match(e.request, { ignoreSearch: true });
      const daRede = fetch(e.request)
        .then((resp) => { if (resp.ok) cache.put(e.request, resp.clone()); return resp; })
        .catch(() => guardado);
      return guardado || daRede;
    })
  );
});
