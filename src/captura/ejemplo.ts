// Datos de ejemplo (M0): el arquetipo A1 de CH-08, con las fechas recorridas para que
// su último día sea hoy. Se carga solo cuando se pide (no pesa en la descarga inicial).

import type { EstadoNegocio } from '../almacen/indexeddb.ts'
import { VERSION_ESQUEMA } from '../almacen/indexeddb.ts'
import { diasEntre, sumarDias } from '../dominio/fechas.ts'
import type { Fecha, FechaHora, Movimiento, Negocio, Producto, Tercero } from '../dominio/tipos.ts'

/** Último día de los datos de A1 (CH-08 §3). */
const FIN_A1 = '2026-10-04'

export async function cargarEjemplo(hoy: Fecha): Promise<EstadoNegocio> {
  const [{ default: eventos }, { default: catalogos }] = await Promise.all([
    import('../../datos_sinteticos/A1/registro_eventos.jsonl?raw'),
    import('../../datos_sinteticos/A1/catalogos.json?raw'),
  ])
  const c = JSON.parse(catalogos) as { negocio: Negocio; terceros: Tercero[]; productos: Producto[] }
  const dias = diasEntre(FIN_A1, hoy)
  const fecha = (f: Fecha) => sumarDias(f, dias)
  const hora = (h: FechaHora) => new Date(Date.parse(h) + dias * 86_400_000).toISOString()

  const movimientos = eventos.trim().split('\n').map((linea) => {
    const m = JSON.parse(linea) as Movimiento
    const r: Movimiento = { ...m, fecha: fecha(m.fecha), creado_en: hora(m.creado_en) }
    if (m.fecha_promesa) r.fecha_promesa = fecha(m.fecha_promesa)
    if (m.confirmado_en) r.confirmado_en = hora(m.confirmado_en)
    return r
  })
  return {
    negocio: {
      ...c.negocio,
      nombre: 'Negocio de ejemplo',
      inicio_operaciones: c.negocio.inicio_operaciones && fecha(c.negocio.inicio_operaciones),
    },
    terceros: c.terceros,
    productos: c.productos,
    movimientos,
    decisiones: [],
    meta: { version_esquema: VERSION_ESQUEMA },
  }
}
