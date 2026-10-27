// Registra el service worker (solo en la versión construida) y avisa cuando hay una
// versión nueva lista. La versión nueva se activa cuando el usuario lo decide (RNF-19).

export function registrarSinConexion(alHaberVersionNueva: (activar: () => void) => void) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const sw = navigator.serviceWorker
  const yaTeniaVersion = !!sw.controller

  window.addEventListener('load', async () => {
    const registro = await sw.register('./sw.js')
    const avisar = (nuevo: ServiceWorker) => alHaberVersionNueva(() => nuevo.postMessage('activar'))

    if (registro.waiting && sw.controller) avisar(registro.waiting)
    registro.addEventListener('updatefound', () => {
      const nuevo = registro.installing
      nuevo?.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && sw.controller) avisar(nuevo)
      })
    })
  })

  // Al activarse la versión nueva se recarga una vez; en la primera instalación, no.
  let recargando = false
  sw.addEventListener('controllerchange', () => {
    if (!yaTeniaVersion || recargando) return
    recargando = true
    location.reload()
  })
}
