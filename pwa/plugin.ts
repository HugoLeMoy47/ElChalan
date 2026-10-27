// Plugin de Vite: al construir, genera `sw.js` con la lista de archivos de esta versión,
// las cabeceras `_headers` para Cloudflare y la política de contenido restrictiva
// (RNF-14) en la página. En desarrollo no hace nada.

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Plugin } from 'vite'

/** Solo archivos propios; nada de red ni código de terceros (RNF-13, RNF-14). */
const POLITICA = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

/**
 * Cabeceras para Cloudflare (formato `_headers`). `sw.js`, la página y el manifiesto
 * nunca se guardan en caché, para que los teléfonos vean las versiones nuevas (RNF-19);
 * lo de `assets/` lleva huella en el nombre y se guarda para siempre.
 */
const CABECERAS = `/*
  Content-Security-Policy: ${POLITICA}; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`

function listar(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre)
    return statSync(ruta).isDirectory() ? listar(ruta) : [ruta]
  })
}

export function sinConexion(): Plugin {
  let publica = ''
  return {
    name: 'elchalan-sin-conexion',
    apply: 'build',
    configResolved(config) {
      publica = config.publicDir
    },
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: POLITICA }, injectTo: 'head-prepend' }]
    },
    generateBundle(_opciones, paquete) {
      const huella = createHash('sha256')
      const deLaApp = Object.keys(paquete).filter((f) => !f.endsWith('.map'))
      const publicos = listar(publica).map((ruta) => {
        huella.update(readFileSync(ruta))
        return relative(publica, ruta).replaceAll('\\', '/')
      })
      const archivos = ['./', ...deLaApp, ...publicos].sort()
      huella.update(archivos.join('\n'))
      const plantilla = readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8')
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: plantilla
          .replace("VERSION = '__VERSION__'", `VERSION = '${huella.digest('hex').slice(0, 12)}'`)
          .replace('ARCHIVOS = __ARCHIVOS__', `ARCHIVOS = ${JSON.stringify(archivos.map((f) => (f === './' ? f : `./${f}`)))}`),
      })
      this.emitFile({ type: 'asset', fileName: '_headers', source: CABECERAS })
    },
  }
}
