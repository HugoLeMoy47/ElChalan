// Service worker de El Chalán (ADR-01, ADR-11, RNF-01): guarda la app en el teléfono
// para que abra y funcione sin conexión. Solo guarda los archivos de la app; los datos
// del negocio viven en IndexedDB y nunca pasan por aquí.
//
// El plugin `pwa/plugin.ts` sustituye __VERSION__ y __ARCHIVOS__ al construir.

const VERSION = '__VERSION__'
const ARCHIVOS = __ARCHIVOS__
const CACHE = `elchalan-${VERSION}`

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ARCHIVOS)))
  // Sin skipWaiting: la versión nueva espera a que el usuario toque «Actualizar»,
  // para no cambiar la app a media captura (RNF-19).
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c.startsWith('elchalan-') && c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (evento) => {
  if (evento.data === 'activar') self.skipWaiting()
})

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== self.location.origin) return
  // Abrir la app (o recargar) siempre sirve la página guardada: no espera a la red.
  const clave = pedido.mode === 'navigate' ? new URL('./', self.registration.scope).href : pedido
  evento.respondWith(caches.match(clave).then((guardado) => guardado ?? fetch(pedido)))
})
