// Paso 6 (RNF-01, RNF-19, S-4): el service worker y el plugin que lo genera.
// El navegador integrado del entorno de desarrollo no admite service workers, así que
// aquí se ejecuta en un entorno simulado; la prueba en un Android real es S-4.

import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'

const ORIGEN = 'https://chalan.example'
const PLANTILLA = readFileSync(new URL('../pwa/service-worker.js', import.meta.url), 'utf8')

type Manejador = (evento: Record<string, unknown>) => void

/** Un `self` de service worker con caché en memoria y la red apagada o prendida. */
function entorno(archivos: string[], version: string, conRed = true) {
  const manejadores = new Map<string, Manejador>()
  const almacenes = new Map<string, Map<string, string>>()
  const llamadas = { skipWaiting: 0, claim: 0, red: [] as string[] }
  const absoluta = (u: string | { url: string }) => new URL(typeof u === 'string' ? u : u.url, `${ORIGEN}/`).href
  const abrir = (nombre: string) => {
    if (!almacenes.has(nombre)) almacenes.set(nombre, new Map())
    const c = almacenes.get(nombre)!
    return {
      addAll: async (urls: string[]) => urls.forEach((u) => c.set(absoluta(u), `contenido de ${u}`)),
      keys: async () => [...c.keys()].map((url) => ({ url })),
    }
  }
  const self = {
    location: new URL(`${ORIGEN}/sw.js`),
    registration: { scope: `${ORIGEN}/` },
    addEventListener: (tipo: string, f: Manejador) => manejadores.set(tipo, f),
    skipWaiting: () => { llamadas.skipWaiting++ },
    clients: { claim: async () => { llamadas.claim++ } },
  }
  const caches = {
    open: async (nombre: string) => abrir(nombre),
    keys: async () => [...almacenes.keys()],
    delete: async (nombre: string) => almacenes.delete(nombre),
    match: async (pedido: string | { url: string }) => {
      for (const c of almacenes.values()) if (c.has(absoluta(pedido))) return c.get(absoluta(pedido))
      return undefined
    },
  }
  const fetch = async (pedido: { url: string }) => {
    llamadas.red.push(pedido.url)
    if (!conRed) throw new TypeError('Sin conexión')
    return `red: ${pedido.url}`
  }
  const codigo = PLANTILLA
    .replace("VERSION = '__VERSION__'", `VERSION = '${version}'`)
    .replace('ARCHIVOS = __ARCHIVOS__', `ARCHIVOS = ${JSON.stringify(archivos)}`)
  runInNewContext(codigo, { self, caches, fetch, URL })

  async function disparar(tipo: string, extra: Record<string, unknown> = {}) {
    let espera: Promise<unknown> | undefined
    let respuesta: Promise<unknown> | undefined
    manejadores.get(tipo)?.({ ...extra, waitUntil: (p: Promise<unknown>) => (espera = p), respondWith: (p: Promise<unknown>) => (respuesta = p) })
    await espera
    return respuesta
  }
  const pedir = (ruta: string, modo = 'cors', metodo = 'GET') =>
    disparar('fetch', { request: { url: new URL(ruta, `${ORIGEN}/`).href, mode: modo, method: metodo } })

  return { disparar, pedir, almacenes, llamadas }
}

const ARCHIVOS = ['./', './assets/index-abc.js', './assets/index-abc.css', './manifest.webmanifest']

describe('service worker', () => {
  it('al instalarse guarda todos los archivos de la app y no se activa solo (RNF-19)', async () => {
    const sw = entorno(ARCHIVOS, 'v1')
    await sw.disparar('install')
    expect([...sw.almacenes.get('elchalan-v1')!.keys()]).toEqual(ARCHIVOS.map((a) => new URL(a, `${ORIGEN}/`).href))
    expect(sw.llamadas.skipWaiting).toBe(0)
  })

  it('sin conexión, abrir o recargar la app sirve la página guardada (RNF-01, T-15)', async () => {
    const sw = entorno(ARCHIVOS, 'v1', false)
    await sw.disparar('install')
    expect(await sw.pedir('/', 'navigate')).toBe('contenido de ./')
    expect(await sw.pedir('/cualquier/ruta', 'navigate')).toBe('contenido de ./')
    expect(await sw.pedir('/assets/index-abc.js')).toBe('contenido de ./assets/index-abc.js')
    expect(sw.llamadas.red).toEqual([])
  })

  it('no se mete con lo que no es de la app: otros sitios y escrituras', async () => {
    const sw = entorno(ARCHIVOS, 'v1')
    await sw.disparar('install')
    expect(await sw.pedir('https://otro.example/x.js')).toBeUndefined()
    expect(await sw.pedir('/algo', 'cors', 'POST')).toBeUndefined()
    // Lo que no está guardado se pide a la red
    expect(await sw.pedir('/nuevo.png')).toBe(`red: ${ORIGEN}/nuevo.png`)
  })

  it('al activarse borra solo las versiones viejas de El Chalán', async () => {
    const sw = entorno(ARCHIVOS, 'v2')
    sw.almacenes.set('elchalan-v1', new Map())
    sw.almacenes.set('otra-app', new Map())
    await sw.disparar('install')
    await sw.disparar('activate')
    expect([...sw.almacenes.keys()].sort()).toEqual(['elchalan-v2', 'otra-app'])
    expect(sw.llamadas.claim).toBe(1)
  })

  it('la versión nueva se activa solo cuando el usuario toca «Actualizar»', async () => {
    const sw = entorno(ARCHIVOS, 'v2')
    await sw.disparar('message', { data: 'otra cosa' })
    expect(sw.llamadas.skipWaiting).toBe(0)
    await sw.disparar('message', { data: 'activar' })
    expect(sw.llamadas.skipWaiting).toBe(1)
  })
})

describe('construcción instalable', () => {
  it('genera sw.js con todos los archivos, el manifiesto con íconos y la política de contenido', async () => {
    const salida = mkdtempSync(join(tmpdir(), 'elchalan-build-'))
    try {
      await build({ logLevel: 'silent', build: { outDir: salida, emptyOutDir: true } })
      const sw = readFileSync(join(salida, 'sw.js'), 'utf8')
      const archivos = JSON.parse(sw.match(/const ARCHIVOS = (\[.*\])/)![1]) as string[]
      expect(sw).toMatch(/const VERSION = '[0-9a-f]{12}'/)
      for (const a of readdirSync(join(salida, 'assets'))) expect(archivos).toContain(`./assets/${a}`)
      expect(archivos).toEqual(expect.arrayContaining(['./', './manifest.webmanifest', './iconos/icono-192.png', './iconos/icono-512.png']))
      expect(archivos).not.toContain('./sw.js')

      const manifiesto = JSON.parse(readFileSync(join(salida, 'manifest.webmanifest'), 'utf8'))
      expect(manifiesto).toMatchObject({ display: 'standalone', start_url: './', lang: 'es-MX' })
      expect(manifiesto.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))

      const html = readFileSync(join(salida, 'index.html'), 'utf8')
      expect(html).toContain('Content-Security-Policy')
      expect(html).toContain('manifest.webmanifest')
      expect(html).not.toMatch(/(src|href)="\/(?!\/)/) // rutas relativas (ADR-09)

      // Cabeceras para Cloudflare: la página y sw.js nunca en caché (RNF-19), seguridad (RNF-14).
      const cabeceras = readFileSync(join(salida, '_headers'), 'utf8')
      expect(cabeceras).toMatch(/\/sw\.js\n {2}Cache-Control: no-cache/)
      expect(cabeceras).toMatch(/\/index\.html\n {2}Cache-Control: no-cache/)
      expect(cabeceras).toContain("frame-ancestors 'none'")
      expect(archivos).not.toContain('./_headers')
    } finally {
      rmSync(salida, { recursive: true, force: true })
    }
  }, 60_000)
})
