// Entrega del respaldo (F-11): compartir como .json, si no como .txt, y si no descargar.
// Reproduce el fallo del 27-oct en un Android: Chrome no comparte archivos .json.

import { describe, expect, it } from 'vitest'
import { entregarArchivo, type Plataforma } from '../src/exportacion/entregar.ts'
import { leerRespaldo } from '../src/exportacion/respaldo.ts'

const NOMBRE = 'ElChalan_Prueba_2026-10-27.json'

/** Un navegador que comparte solo los tipos que se le indiquen. */
function navegador(tipos: string[], share?: (d: ShareData) => Promise<void>) {
  const compartidos: File[] = []
  const descargados: File[] = []
  const p: Plataforma = {
    canShare: (d) => !!d.files?.every((f) => tipos.includes(f.type)),
    share: share ?? (async (d) => { compartidos.push(...(d.files ?? [])) }),
    descargar: (f) => descargados.push(f),
  }
  return { p, compartidos, descargados }
}

describe('entregar el respaldo', () => {
  it('comparte como .json cuando el navegador lo permite', async () => {
    const n = navegador(['application/json', 'text/plain'])
    expect(await entregarArchivo('{}', NOMBRE, n.p)).toEqual({ entrega: 'compartido' })
    expect(n.compartidos.map((f) => f.name)).toEqual([NOMBRE])
  })

  it('Chrome en Android: no comparte .json, así que lo comparte como .txt con el mismo contenido', async () => {
    const n = navegador(['text/plain', 'image/png'])
    const contenido = '{"formato":"elchalan-respaldo"}'
    expect(await entregarArchivo(contenido, NOMBRE, n.p)).toEqual({ entrega: 'compartido' })
    expect(n.compartidos.map((f) => [f.name, f.type])).toEqual([['ElChalan_Prueba_2026-10-27.txt', 'text/plain']])
    expect(await n.compartidos[0].text()).toBe(contenido)
    expect(n.descargados).toEqual([])
  })

  it('si el navegador rechaza compartir, lo descarga y dice por qué', async () => {
    const n = navegador(['application/json'], async () => {
      throw new DOMException('Permission denied', 'NotAllowedError')
    })
    expect(await entregarArchivo('{}', NOMBRE, n.p)).toEqual({ entrega: 'descargado', fallo: 'NotAllowedError: Permission denied' })
    expect(n.descargados.map((f) => f.name)).toEqual([NOMBRE])
  })

  it('si el usuario cierra la hoja de compartir, no hace nada más', async () => {
    const n = navegador(['application/json'], async () => {
      throw new DOMException('Share canceled', 'AbortError')
    })
    expect(await entregarArchivo('{}', NOMBRE, n.p)).toEqual({ entrega: 'cancelado' })
    expect(n.descargados).toEqual([])
  })

  it('sin compartir (computadora), lo descarga', async () => {
    const descargados: File[] = []
    expect(await entregarArchivo('{}', NOMBRE, { descargar: (f) => descargados.push(f) })).toEqual({ entrega: 'descargado' })
    expect(descargados[0].type).toBe('application/json')
  })

  it('un respaldo compartido como .txt se restaura igual', async () => {
    const respaldo = JSON.stringify({ formato: 'otro' })
    const n = navegador(['text/plain'])
    await entregarArchivo(respaldo, NOMBRE, n.p)
    // La lectura no depende de la extensión: valida el contenido.
    expect((await leerRespaldo(await n.compartidos[0].text())).ok).toBe(false)
    expect(await n.compartidos[0].text()).toBe(respaldo)
  })
})
