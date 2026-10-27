// P-2 de CH-12: el dominio, cargado con los datos sintéticos de CH-08, coincide
// al centavo con la verdad de terreno que el generador calculó por su cuenta.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ARQUETIPOS, archivos } from '../datos_sinteticos/arquetipos.ts'
import { calcularVistas, detectarAlertas, firmar, type Movimiento } from '../src/dominio/index.ts'

/** CH-08 §9: las falsas alarmas no pasan del 5 % de las alertas mostradas. */
const UMBRAL_FALSAS_ALARMAS = 0.05
/** Sin tasa sintética: el generador no las inyecta (CH-04 §12.2). */
const NO_INYECTADAS = ['AN-13', 'AN-17', 'AN-18']
/** AN-20 se pregunta al comprar; se prueba con `cambiosDeCosto` en las pruebas del dominio. */
const SOLO_AL_CAPTURAR = ['AN-20']

for (const [id, construir] of Object.entries(ARQUETIPOS)) {
  describe(`arquetipo ${id}`, () => {
    const a = construir()
    const g = a.generador

    it('es determinista y los archivos en disco están al día', () => {
      const otra = construir()
      const nuevos = archivos(otra)
      expect(nuevos).toEqual(archivos(a))
      for (const [nombre, contenido] of Object.entries(nuevos)) {
        const ruta = new URL(`../datos_sinteticos/${id}/${nombre}`, import.meta.url)
        expect(readFileSync(ruta, 'utf8'), `${nombre} desactualizado: corre «npm run generar»`).toBe(contenido)
      }
    })

    const periodos = [...a.esperado.semanas, ...a.esperado.meses, a.esperado.total]
    it.each(periodos.map((p) => [p.clave, p] as const))('coincide al centavo · %s', (_clave, p) => {
      const v = calcularVistas(g.registro, g.negocio, g.productos, { desde: p.desde, hasta: p.hasta })
      const obtenido: Record<string, unknown> = {}
      for (const campo of Object.keys(p.vistas)) obtenido[campo] = v[campo as keyof typeof v]
      expect(obtenido).toEqual(p.vistas)
    })

    it('las reglas del dominio dan los mismos pendientes que el generador', () => {
      const productos = new Map(g.productos.map((x) => [x.producto_id, x]))
      for (const m of g.registro.filter((x: Movimiento) => x.operacion !== 'anulacion')) {
        const r = firmar({
          tipo: m.tipo, fecha: m.fecha, monto_centavos: m.monto_centavos, medio_pago: m.medio_pago,
          condicion: m.condicion, fecha_promesa: m.fecha_promesa, origen_id: m.origen_id,
          tercero_id: m.tercero_id, categoria_gasto: m.categoria_gasto, concepto: m.concepto,
          sentido: m.sentido, origen_captura: m.origen_captura,
          renglones: m.renglones.map((x) => ({ ...x })),
        }, {
          negocio_id: m.negocio_id, dispositivo_id: m.dispositivo_id, hoy: m.fecha,
          ahora: m.creado_en, nuevoId: () => 'x', productos,
        })
        expect(r.ok, `${m.movimiento_id} debería firmarse`).toBe(true)
        if (r.ok) {
          expect([...r.movimiento.pendientes].sort(), m.movimiento_id).toEqual([...m.pendientes].sort())
          expect(r.movimiento.estado_registro).toBe(m.estado_registro)
        }
      }
    })

    it('T-21 · detecta todas las anomalías inyectadas, con pocas falsas alarmas', () => {
      const detectadas = detectarAlertas(g.registro, g.negocio, g.productos, {
        hoy: a.esperado.total.hasta, ultimo_respaldo: a.esperado.total.hasta,
      }).filter((x) => !NO_INYECTADAS.includes(x.codigo))
      const clave = (x: { codigo: string; objeto_id: string }) => `${x.codigo}|${x.objeto_id}`
      const hallado = new Set(detectadas.map(clave))
      const esperadas = a.esperado.alertas_esperadas.filter((x) => !SOLO_AL_CAPTURAR.includes(x.codigo))
      const esperado = new Set(esperadas.map(clave))

      const sinDetectar = esperadas.filter((x) => !hallado.has(clave(x)))
      expect(sinDetectar, 'anomalías inyectadas sin detectar').toEqual([])
      const falsas = detectadas.filter((x) => !esperado.has(clave(x)))
      expect(falsas.length, `falsas alarmas: ${falsas.map(clave).join(', ')}`).toBeLessThanOrEqual(
        Math.floor(detectadas.length * UMBRAL_FALSAS_ALARMAS),
      )
    })

    it('los intentos con fecha futura se rechazan (AN-01)', () => {
      for (const i of a.esperado.intentos_rechazados) {
        const r = firmar({ tipo: i.tipo, fecha: i.fecha, monto_centavos: i.monto_centavos }, {
          negocio_id: g.negocio.negocio_id, dispositivo_id: g.dispositivo, hoy: i.hoy,
          ahora: `${i.hoy}T18:00:00Z`, nuevoId: () => 'x',
        })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.errores.map((e) => e.codigo)).toContain('AN-01')
      }
    })
  })
}
