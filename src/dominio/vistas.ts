// Vistas calculadas del N1 (CH-04 §8). Nunca se guardan: se recalculan sobre el
// registro de eventos. Solo cuentan los movimientos vigentes en estado `firme`
// o `por_completar`.
//
// Flujos (ventas, gastos…) cuentan dentro de [desde, hasta]. Saldos (tengo,
// me deben, existencias) son acumulados hasta `hasta`, que es la fecha de corte.

import { costoDeCantidad, dividirRedondeando } from './dinero.ts'
import { diasEntre } from './fechas.ts'
import { fechaPromesaEfectiva } from './movimientos.ts'
import { resolverVersiones, vigenteDe } from './versiones.ts'
import type {
  Centavos, Fecha, MedioPago, Milesimas, Movimiento, Negocio, Pendiente, Producto, Uuid,
} from './tipos.ts'

export interface Periodo {
  desde: Fecha
  hasta: Fecha
}

export interface Vistas {
  periodo: Periodo
  // ¿Cuánto tengo?
  saldo_por_medio: Record<MedioPago, Centavos>
  saldo_total: Centavos
  // ¿Cuánto vendí?
  ventas_brutas: Centavos
  ventas_contado: Centavos
  ventas_credito: Centavos
  /** Lo que se le reconoció al cliente: lo devuelto menos la penalización (D-59). */
  devoluciones: Centavos
  /** Lo que el negocio se quedó de las devoluciones (D-59); sigue contando como venta. */
  penalizaciones: Centavos
  ventas_netas: Centavos
  cobros: Centavos
  otros_ingresos: Centavos
  compras: Centavos
  gastos: Centavos
  gastos_por_categoria: Record<string, Centavos>
  // ¿Gané?
  ventas_netas_con_costo: Centavos
  ventas_netas_sin_costo: Centavos
  /** Porcentaje de las ventas brutas que no tienen costo (AN-06), en puntos base. */
  ventas_sin_costo_pb: number | null
  costo_de_lo_vendido: Centavos
  utilidad_bruta: Centavos
  /** «Margen sobre costo» (D-42), en puntos base (1 % = 100). */
  margen_sobre_costo_pb: number | null
  /** Margen bruto sobre ventas de SutraMind; solo para el puente, no en pantalla. */
  margen_sobre_ventas_pb: number | null
  /** «Gané» = Me deja − gastos (D-51); lo vendido sin costo cuenta con costo 0 (D-58). */
  utilidad_del_periodo: Centavos
  /** «Entró − salió» (D-51). */
  flujo_de_caja: Centavos
  // ¿Me deben?
  por_cobrar: Centavos
  por_cobrar_vencido: Centavos
  por_cobrar_por_tercero: Record<Uuid, Centavos>
  // ¿Qué tengo en bodega?
  existencia: Record<Uuid, Milesimas>
  valor_inventario: Centavos
  dias_de_inventario: number | null
  // ¿Cuánto saqué yo?
  aportaciones: Centavos
  retiros: Centavos
  // Advertencias
  movimientos_por_completar: number
  movimientos_por_confirmar: number
  pendientes: Partial<Record<Pendiente, number>>
}

function vacio(): Record<MedioPago, Centavos> {
  return { efectivo: 0, transferencia: 0, tarjeta: 0, otro: 0 }
}

function sumar<K extends string>(obj: Partial<Record<K, number>>, clave: K, valor: number) {
  obj[clave] = (obj[clave] ?? 0) + valor
}

function puntosBase(numerador: number, denominador: number): number | null {
  return denominador > 0 ? dividirRedondeando(numerador * 10_000, denominador) : null
}

interface CostoVenta {
  conCosto: boolean
  /** Costo de lo vendido; los renglones sin costo cuentan como 0 (D-58). */
  costo: Centavos
}

/**
 * Una venta tiene costo si trae renglones y todos tienen costo (del renglón o del catálogo, D-50).
 * Lo que no tiene costo se toma como costo 0 (D-58) y se avisa con el porcentaje sin costo.
 */
function costoDeVenta(venta: Movimiento, productos: ReadonlyMap<Uuid, Producto>): CostoVenta {
  let conCosto = venta.renglones.length > 0
  let costo = 0
  for (const r of venta.renglones) {
    const unitario = r.costo_unitario_centavos
      ?? (r.producto_id ? productos.get(r.producto_id)?.costo_centavos : undefined)
    if (unitario === undefined) conCosto = false
    else costo += costoDeCantidad(r.cantidad_milesimas, unitario)
  }
  return { conCosto, costo }
}

export function calcularVistas(
  registro: readonly Movimiento[],
  negocio: Negocio,
  productos: readonly Producto[],
  periodo: Periodo,
): Vistas {
  const { desde, hasta } = periodo
  const catalogo = new Map(productos.map((p) => [p.producto_id, p]))
  const versiones = resolverVersiones(registro)

  const v: Vistas = {
    periodo,
    saldo_por_medio: vacio(), saldo_total: 0,
    ventas_brutas: 0, ventas_contado: 0, ventas_credito: 0, devoluciones: 0, penalizaciones: 0, ventas_netas: 0,
    cobros: 0, otros_ingresos: 0, compras: 0, gastos: 0, gastos_por_categoria: {},
    ventas_netas_con_costo: 0, ventas_netas_sin_costo: 0, ventas_sin_costo_pb: null,
    costo_de_lo_vendido: 0, utilidad_bruta: 0, margen_sobre_costo_pb: null,
    margen_sobre_ventas_pb: null, utilidad_del_periodo: 0, flujo_de_caja: 0,
    por_cobrar: 0, por_cobrar_vencido: 0, por_cobrar_por_tercero: {},
    existencia: {}, valor_inventario: 0, dias_de_inventario: null,
    aportaciones: 0, retiros: 0,
    movimientos_por_completar: 0, movimientos_por_confirmar: 0, pendientes: {},
  }

  if (negocio.capital_inicial_centavos && (!negocio.inicio_operaciones || negocio.inicio_operaciones <= hasta)) {
    v.saldo_por_medio.efectivo += negocio.capital_inicial_centavos
  }

  // Orden del hecho; a igual fecha, el del registro.
  const indice = new Map(registro.map((m, i) => [m.movimiento_id, i]))
  const cuentan = versiones.vigentes
    .filter((m) => m.fecha <= hasta)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : indice.get(a.movimiento_id)! - indice.get(b.movimiento_id)!))

  /** Saldo pendiente de cada venta a crédito vigente (por id de su alta original). */
  const saldoVenta = new Map<Uuid, Centavos>()
  let ventasBrutasSinCosto = 0

  for (const m of cuentan) {
    if (m.estado_registro === 'por_confirmar') {
      if (m.fecha >= desde) v.movimientos_por_confirmar++
      continue
    }
    const enPeriodo = m.fecha >= desde
    const monto = m.monto_centavos
    const caja = (signo: 1 | -1, importe: Centavos = monto) => {
      v.saldo_por_medio[m.medio_pago] += signo * importe
    }
    const existencia = (signo: 1 | -1) => {
      for (const r of m.renglones) {
        if (r.producto_id) sumar(v.existencia, r.producto_id, signo * r.cantidad_milesimas)
      }
    }

    if (enPeriodo && m.estado_registro === 'por_completar') {
      v.movimientos_por_completar++
      for (const p of m.pendientes) sumar(v.pendientes, p, 1)
    }

    switch (m.tipo) {
      case 'venta': {
        existencia(-1)
        if (m.condicion === 'credito') saldoVenta.set(versiones.raiz.get(m.movimiento_id)!, monto)
        else caja(1)
        if (!enPeriodo) break
        v.ventas_brutas += monto
        if (m.condicion === 'credito') v.ventas_credito += monto
        else v.ventas_contado += monto
        const cv = costoDeVenta(m, catalogo)
        v.costo_de_lo_vendido += cv.costo
        if (cv.conCosto) v.ventas_netas_con_costo += monto
        else ventasBrutasSinCosto += monto
        break
      }
      case 'cobro': {
        caja(1)
        const venta = vigenteDe(versiones, m.origen_id)
        const r = venta && versiones.raiz.get(venta.movimiento_id)!
        if (r && saldoVenta.has(r)) saldoVenta.set(r, saldoVenta.get(r)! - monto)
        if (enPeriodo) v.cobros += monto
        break
      }
      case 'devolucion_venta': {
        existencia(1)
        // D-59: el negocio se queda la penalización y al cliente se le reconoce el resto.
        // Contra una venta a crédito, lo reconocido primero baja lo que debe; lo que
        // sobre se le regresa en dinero.
        const penalizacion = m.penalizacion_centavos ?? 0
        const reconocido = monto - penalizacion
        const venta = vigenteDe(versiones, m.origen_id)
        const r = venta && versiones.raiz.get(venta.movimiento_id)!
        let aDeuda = 0
        if (r && saldoVenta.has(r)) {
          aDeuda = Math.min(reconocido, Math.max(saldoVenta.get(r)!, 0))
          saldoVenta.set(r, saldoVenta.get(r)! - aDeuda)
        }
        caja(-1, reconocido - aDeuda)
        if (!enPeriodo) break
        v.devoluciones += reconocido
        v.penalizaciones += penalizacion
        const cv = venta ? costoDeVenta(venta, catalogo) : { conCosto: false, costo: 0 }
        const costoDevuelto = costoDeVenta(m, catalogo)
        v.costo_de_lo_vendido -= costoDevuelto.costo
        if (cv.conCosto && costoDevuelto.conCosto) v.ventas_netas_con_costo -= reconocido
        break
      }
      case 'aportacion':
        caja(1)
        if (enPeriodo) v.aportaciones += monto
        break
      case 'otro_ingreso':
        caja(1)
        if (enPeriodo) v.otros_ingresos += monto
        break
      case 'compra':
        caja(-1)
        existencia(1)
        if (enPeriodo) v.compras += monto
        break
      case 'gasto':
        caja(-1)
        if (enPeriodo) {
          v.gastos += monto
          sumar(v.gastos_por_categoria, m.categoria_gasto ?? 'sin_categoria', monto)
        }
        break
      case 'retiro':
        caja(-1)
        if (enPeriodo) v.retiros += monto
        break
      case 'ajuste_existencia':
        existencia(1) // la cantidad del renglón ya trae su signo
        break
      case 'ajuste_efectivo':
        caja(m.sentido === 'sale' ? -1 : 1)
        break
    }
  }

  v.saldo_total = Object.values(v.saldo_por_medio).reduce((s, x) => s + x, 0)
  v.ventas_netas = v.ventas_brutas - v.devoluciones
  v.ventas_netas_sin_costo = v.ventas_netas - v.ventas_netas_con_costo
  v.ventas_sin_costo_pb = puntosBase(ventasBrutasSinCosto, v.ventas_brutas)
  // D-58: las ventas sin costo entran a «Me deja» con costo 0.
  v.utilidad_bruta = v.ventas_netas - v.costo_de_lo_vendido
  v.margen_sobre_costo_pb = puntosBase(v.utilidad_bruta, v.costo_de_lo_vendido)
  v.margen_sobre_ventas_pb = puntosBase(v.utilidad_bruta, v.ventas_netas)
  v.utilidad_del_periodo = v.utilidad_bruta - v.gastos
  v.flujo_de_caja = v.ventas_contado + v.cobros + v.otros_ingresos - v.compras - v.gastos

  // Me deben: una venta con cobro de más no resta a las demás (el excedente es AN-09).
  for (const [r, saldo] of saldoVenta) {
    if (saldo <= 0) continue
    const venta = versiones.vigenteDeRaiz.get(r)!
    v.por_cobrar += saldo
    if (venta.tercero_id) sumar(v.por_cobrar_por_tercero, venta.tercero_id, saldo)
    if (fechaPromesaEfectiva(venta) < hasta) v.por_cobrar_vencido += saldo
  }

  // La bodega se valora al costo vigente del catálogo; las existencias negativas
  // no restan valor (se marcan con AN-11).
  for (const [id, cantidad] of Object.entries(v.existencia)) {
    const costo = catalogo.get(id)?.costo_centavos
    if (cantidad > 0 && costo !== undefined) v.valor_inventario += costoDeCantidad(cantidad, costo)
  }
  if (v.costo_de_lo_vendido > 0) {
    const dias = diasEntre(desde, hasta) + 1
    v.dias_de_inventario = dividirRedondeando(v.valor_inventario * dias * 10, v.costo_de_lo_vendido) / 10
  }

  return v
}
