// Detector de anomalías de la PoC-1 (CH-04 §12). Las alertas se calculan, no se
// guardan: lo único que se guarda es lo que el usuario decidió (`decision_alerta`).
//
// Hay tres familias:
// - De cada movimiento, evaluado contra lo anotado antes (AN-03, 04, 05, 06, 07, 08,
//   09, 10, 14, 16). Son las mismas que se avisan al capturar; si el usuario guardó
//   igual, quedan en «Cosas por revisar».
// - Del estado actual (AN-11, 12, 13) y del entorno (AN-17, 18).
// - Al registrar una compra (AN-20): `cambiosDeCosto`, porque la pregunta se hace en
//   ese momento y el catálogo no guarda su historia.
// AN-01 lo bloquea `firmar`; AN-02, 15 y 19 llegan en la PoC-2.

import { diasEntre, sumarDias } from './fechas.ts'
import { resolverVersiones, vigenteDe } from './versiones.ts'
import { calcularVistas } from './vistas.ts'
import type {
  Centavos, DecisionAlerta, Fecha, MedioPago, Movimiento, Negocio, Pendiente, Producto, Uuid,
} from './tipos.ts'

export type Severidad = 'bloqueante' | 'aviso' | 'informativa'

export interface Alerta {
  codigo: string
  /** Versión vigente del movimiento, producto o «negocio:medio» al que se refiere. */
  objeto_id: Uuid
  severidad: Severidad
  /** Frase de calle para «Cosas por revisar» (CH-04 §12.3). */
  mensaje: string
}

export interface Entorno {
  /** Hoy en la zona del negocio: el corte del estado actual. */
  hoy: Fecha
  /** Fecha del último respaldo; sin ella, «sin respaldo» (AN-17). */
  ultimo_respaldo?: Fecha
  /** Lo que reporta el navegador (AN-18). Si se omite, no se evalúa. */
  almacenamiento?: { persistente: boolean; uso_pct?: number }
}

/** Respaldo viejo a los 7 días (D-46). */
export const DIAS_RESPALDO_VIEJO = 7
/** AN-03: más de 10 veces la mediana de los últimos 30 días del mismo tipo… */
export const VECES_MEDIANA_ATIPICA = 10
/** …con al menos estos movimientos para comparar. */
export const MINIMO_PARA_MEDIANA = 5
/**
 * AN-04: un duplicado se anota con segundos de diferencia (doble toque o volver a
 * capturar). En un puesto, dos clientes seguidos compran lo mismo a cada rato.
 */
export const SEGUNDOS_DUPLICADO = 15
/** AN-18: almacenamiento casi lleno. */
export const USO_ALMACENAMIENTO_MAXIMO_PCT = 90

const SEVERIDAD: Record<string, Severidad> = {
  'AN-03': 'aviso', 'AN-04': 'aviso', 'AN-05': 'informativa', 'AN-06': 'aviso',
  'AN-07': 'informativa', 'AN-08': 'aviso', 'AN-09': 'aviso', 'AN-10': 'aviso',
  'AN-11': 'aviso', 'AN-12': 'aviso', 'AN-13': 'informativa', 'AN-14': 'aviso',
  'AN-16': 'aviso', 'AN-17': 'aviso', 'AN-18': 'aviso', 'AN-20': 'informativa',
}

const ORDEN_SEVERIDAD: Record<Severidad, number> = { bloqueante: 0, aviso: 1, informativa: 2 }

/** Pendientes que no tienen una alerta propia y caen en AN-05. */
const PENDIENTES_AN05: Pendiente[] = ['sin_categoria', 'sin_tercero', 'sin_producto', 'sin_medio_pago']

function alerta(codigo: string, objeto_id: Uuid, mensaje: string): Alerta {
  return { codigo, objeto_id, severidad: SEVERIDAD[codigo], mensaje }
}

function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b)
  const mitad = Math.floor(v.length / 2)
  return v.length % 2 ? v[mitad] : (v[mitad - 1] + v[mitad]) / 2
}

function firmaDuplicado(m: Movimiento): string {
  const renglones = m.renglones
    .map((r) => `${r.producto_id ?? r.descripcion}:${r.cantidad_milesimas}`)
    .sort()
    .join(',')
  return [m.tipo, m.fecha, m.monto_centavos, m.tercero_id ?? '', renglones].join('|')
}

function costoDeRenglon(costo: Centavos | undefined, productoId: Uuid | undefined, catalogo: ReadonlyMap<Uuid, Producto>) {
  return costo ?? (productoId ? catalogo.get(productoId)?.costo_centavos : undefined)
}

/** Alertas de un movimiento contra lo anotado antes que él. */
function alertasDelMovimiento(
  m: Movimiento,
  anteriores: readonly Movimiento[],
  anterior: Movimiento | undefined,
  catalogo: ReadonlyMap<Uuid, Producto>,
  saldoAntes: Centavos | undefined,
  ventaOrigen: Movimiento | null,
  relojMaximo: number,
): Alerta[] {
  const fuera: Alerta[] = []
  const id = m.movimiento_id

  // AN-03: monto atípico frente a la mediana de los últimos 30 días del mismo tipo.
  const desde = sumarDias(m.fecha, -30)
  const comparables = anteriores
    .filter((p) => p.tipo === m.tipo && p.fecha >= desde && p.fecha <= m.fecha)
    .map((p) => p.monto_centavos)
  if (comparables.length >= MINIMO_PARA_MEDIANA && m.monto_centavos > VECES_MEDIANA_ATIPICA * mediana(comparables)) {
    fuera.push(alerta('AN-03', id, 'Este monto es mucho más alto que los de costumbre. ¿Es correcto?'))
  }

  // AN-04: lo mismo capturado dos veces seguidas, con segundos de diferencia.
  const segundos = anterior ? Math.abs(Date.parse(m.creado_en) - Date.parse(anterior.creado_en)) / 1000 : Infinity
  if (anterior && segundos <= SEGUNDOS_DUPLICADO && m.tipo !== 'ajuste_existencia' && firmaDuplicado(anterior) === firmaDuplicado(m)) {
    fuera.push(alerta('AN-04', id, 'Este movimiento se parece al anterior. ¿Lo anotaste dos veces?'))
  }

  // AN-05 a AN-08: lo que falta por completar.
  if (m.pendientes.some((p) => PENDIENTES_AN05.includes(p))) {
    fuera.push(alerta('AN-05', id, 'A este movimiento le falta algo.'))
  }
  if (m.pendientes.includes('sin_costo')) {
    fuera.push(alerta('AN-06', id, 'Vendiste un producto que no tiene costo; cuenta como si te hubiera costado $0.'))
  }
  if (m.pendientes.includes('sin_fecha_promesa')) {
    fuera.push(alerta('AN-07', id, '¿Cuándo te paga? Si no lo pones, se cuentan 30 días.'))
  }
  if (m.pendientes.includes('monto_no_cuadra')) {
    fuera.push(alerta('AN-08', id, 'Los productos no suman lo mismo que el total.'))
  }

  // AN-09: cobro mayor a lo que debía esa venta.
  if (m.tipo === 'cobro' && m.monto_centavos > Math.max(saldoAntes ?? 0, 0)) {
    fuera.push(alerta('AN-09', id, 'Cobraste más de lo que te debían de esa venta.'))
  }

  // AN-10: devolución mayor a lo vendido.
  if (m.tipo === 'devolucion_venta' && ventaOrigen) {
    const vendido = new Map<string, number>()
    for (const r of ventaOrigen.renglones) {
      if (r.producto_id) vendido.set(r.producto_id, (vendido.get(r.producto_id) ?? 0) + r.cantidad_milesimas)
    }
    const deMas = m.renglones.some((r) => r.producto_id && r.cantidad_milesimas > (vendido.get(r.producto_id) ?? 0))
    if (deMas || m.monto_centavos > ventaOrigen.monto_centavos) {
      fuera.push(alerta('AN-10', id, 'Te devolvieron más de lo que vendiste en esa venta.'))
    }
  }

  // AN-14: venta bajo el costo.
  if (m.tipo === 'venta') {
    const bajo = m.renglones.some((r) => {
      const costo = costoDeRenglon(r.costo_unitario_centavos, r.producto_id, catalogo)
      return costo !== undefined && r.precio_unitario_centavos !== undefined && r.precio_unitario_centavos < costo
    })
    if (bajo) fuera.push(alerta('AN-14', id, 'Vendiste por debajo de lo que te costó.'))
  }

  // AN-16: el reloj del teléfono retrocedió más de un día.
  if (Date.parse(m.creado_en) < relojMaximo - 86_400_000) {
    fuera.push(alerta('AN-16', id, 'La hora del teléfono parece atrasada. Revisa la fecha.'))
  }
  return fuera
}

/** Todas las alertas abiertas, sin aplicar decisiones (para eso, `alertasAbiertas`). */
export function detectarAlertas(
  registro: readonly Movimiento[],
  negocio: Negocio,
  productos: readonly Producto[],
  entorno: Entorno,
): Alerta[] {
  const catalogo = new Map(productos.map((p) => [p.producto_id, p]))
  const versiones = resolverVersiones(registro)
  const vigentes = new Set(versiones.vigentes.map((m) => m.movimiento_id))
  const fuera: Alerta[] = []

  // Lo que debe cada venta a crédito, en el orden del hecho (para AN-09).
  const indice = new Map(registro.map((m, i) => [m.movimiento_id, i]))
  const enOrden = versiones.vigentes
    .filter((m) => m.estado_registro !== 'por_confirmar')
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : indice.get(a.movimiento_id)! - indice.get(b.movimiento_id)!))
  const saldo = new Map<Uuid, Centavos>()
  const saldoAntesDe = new Map<Uuid, Centavos | undefined>()
  for (const m of enOrden) {
    const raiz = (x: Movimiento | null) => (x ? versiones.raiz.get(x.movimiento_id)! : undefined)
    if (m.tipo === 'venta' && m.condicion === 'credito') saldo.set(raiz(m)!, m.monto_centavos)
    if (m.tipo === 'cobro' || m.tipo === 'devolucion_venta') {
      const r = raiz(vigenteDe(versiones, m.origen_id))
      const antes = r !== undefined ? saldo.get(r) : undefined
      saldoAntesDe.set(m.movimiento_id, antes)
      if (r !== undefined && antes !== undefined) {
        const baja = m.tipo === 'cobro' ? m.monto_centavos : Math.min(m.monto_centavos - (m.penalizacion_centavos ?? 0), Math.max(antes, 0))
        saldo.set(r, antes - baja)
      }
    }
  }

  // Cada movimiento vigente, contra lo anotado antes que él en el registro.
  const anteriores: Movimiento[] = []
  let anterior: Movimiento | undefined
  let relojMaximo = -Infinity
  for (const m of registro) {
    if (vigentes.has(m.movimiento_id) && m.estado_registro !== 'por_confirmar') {
      fuera.push(...alertasDelMovimiento(
        m, anteriores, anterior, catalogo, saldoAntesDe.get(m.movimiento_id),
        vigenteDe(versiones, m.origen_id), relojMaximo,
      ))
    }
    relojMaximo = Math.max(relojMaximo, Date.parse(m.creado_en))
    if (m.operacion === 'alta') anterior = vigentes.has(m.movimiento_id) ? m : undefined
    if (vigentes.has(m.movimiento_id)) anteriores.push(m)
  }

  // Estado actual.
  const inicio = registro.reduce((min, m) => (m.fecha < min ? m.fecha : min), entorno.hoy)
  const hoy = calcularVistas(registro, negocio, productos, { desde: inicio, hasta: entorno.hoy })
  for (const [id, cantidad] of Object.entries(hoy.existencia)) {
    if (cantidad < 0) {
      const nombre = catalogo.get(id)?.nombre ?? 'un producto'
      fuera.push(alerta('AN-11', id, `Según lo anotado, de ${nombre} tienes menos de cero. ¿Falta anotar una compra?`))
    }
  }
  for (const [medio, valor] of Object.entries(hoy.saldo_por_medio) as [MedioPago, Centavos][]) {
    if (valor < 0) {
      fuera.push(alerta('AN-12', `${negocio.negocio_id}:${medio}`, `Tu saldo en ${medio} da menos de cero. ¿Falta anotar algo?`))
    }
  }
  const mes = calcularVistas(registro, negocio, productos, { desde: `${entorno.hoy.slice(0, 7)}-01`, hasta: entorno.hoy })
  if (mes.retiros > 0 && mes.retiros > mes.utilidad_del_periodo) {
    fuera.push(alerta('AN-13', `${negocio.negocio_id}:${entorno.hoy.slice(0, 7)}`, 'Este mes sacaste más dinero del que ganaste.'))
  }

  // Entorno.
  if (!entorno.ultimo_respaldo) {
    fuera.push(alerta('AN-17', negocio.negocio_id, 'Tus datos solo están en este teléfono. Haz un respaldo.'))
  } else if (diasEntre(entorno.ultimo_respaldo, entorno.hoy) > DIAS_RESPALDO_VIEJO) {
    fuera.push(alerta('AN-17', negocio.negocio_id, `Tu último respaldo fue hace ${diasEntre(entorno.ultimo_respaldo, entorno.hoy)} días.`))
  }
  const a = entorno.almacenamiento
  if (a && (!a.persistente || (a.uso_pct ?? 0) > USO_ALMACENAMIENTO_MAXIMO_PCT)) {
    fuera.push(alerta('AN-18', negocio.negocio_id, 'El teléfono podría borrar tus datos. Haz un respaldo.'))
  }

  return fuera.sort((x, y) => ORDEN_SEVERIDAD[x.severidad] - ORDEN_SEVERIDAD[y.severidad])
}

/**
 * Quita las alertas que el usuario ya decidió (T-22): «está bien así» y «atendida»
 * no vuelven mientras el objeto sea el mismo (una corrección crea otra versión y la
 * alerta reaparece); «después» se esconde hasta su fecha.
 */
export function alertasAbiertas(alertas: readonly Alerta[], decisiones: readonly DecisionAlerta[], hoy: Fecha): Alerta[] {
  const ultima = new Map<string, DecisionAlerta>()
  for (const d of decisiones) ultima.set(`${d.codigo}|${d.objeto_id}`, d)
  return alertas.filter((a) => {
    const d = ultima.get(`${a.codigo}|${a.objeto_id}`)
    if (!d) return true
    if (d.decision === 'pospuesta') return d.hasta !== undefined && d.hasta <= hoy
    return false
  })
}

export interface CambioDeCosto {
  producto_id: Uuid
  costo_catalogo: Centavos
  costo_compra: Centavos
}

/** AN-20: al registrar una compra, los productos cuyo costo cambió («¿Actualizo el costo?»). */
export function cambiosDeCosto(compra: Pick<Movimiento, 'renglones'>, productos: readonly Producto[]): CambioDeCosto[] {
  const catalogo = new Map(productos.map((p) => [p.producto_id, p]))
  const cambios: CambioDeCosto[] = []
  for (const r of compra.renglones) {
    const actual = r.producto_id ? catalogo.get(r.producto_id)?.costo_centavos : undefined
    if (r.producto_id && actual !== undefined && r.precio_unitario_centavos !== undefined && r.precio_unitario_centavos !== actual) {
      cambios.push({ producto_id: r.producto_id, costo_catalogo: actual, costo_compra: r.precio_unitario_centavos })
    }
  }
  return cambios
}
