// Verdad de terreno (CH-08 §7): se calcula sobre el libro de intenciones del
// generador, no sobre el registro de eventos ni con el código del dominio.

import type { Fecha, Producto, Uuid } from '../src/dominio/tipos.ts'
import { costoLinea, masDias, ms, type Efecto } from './comun.ts'

export interface Esperado {
  saldo_por_medio: Record<string, number>
  saldo_total: number
  ventas_brutas: number
  ventas_contado: number
  ventas_credito: number
  devoluciones: number
  ventas_netas: number
  cobros: number
  otros_ingresos: number
  compras: number
  gastos: number
  gastos_por_categoria: Record<string, number>
  ventas_netas_con_costo: number
  costo_de_lo_vendido: number
  utilidad_bruta: number
  margen_sobre_costo_pb: number | null
  utilidad_del_periodo: number
  flujo_de_caja: number
  por_cobrar: number
  por_cobrar_vencido: number
  por_cobrar_por_tercero: Record<string, number>
  existencia: Record<string, number>
  valor_inventario: number
  dias_de_inventario: number | null
  aportaciones: number
  retiros: number
  movimientos_por_completar: number
  pendientes: Record<string, number>
}

/** Puntos base, con la mitad redondeada lejos de cero. */
function pb(a: number, b: number): number | null {
  if (b <= 0) return null
  const r = Math.round(Math.abs(a * 10_000) / b)
  return a < 0 ? -r || 0 : r
}

export function verdad(
  libro: ReadonlyMap<Uuid, Efecto>,
  capitalInicial: number,
  productos: readonly Producto[],
  desde: Fecha,
  hasta: Fecha,
): Esperado {
  const e: Esperado = {
    saldo_por_medio: { efectivo: capitalInicial, transferencia: 0, tarjeta: 0, otro: 0 },
    saldo_total: 0, ventas_brutas: 0, ventas_contado: 0, ventas_credito: 0, devoluciones: 0,
    ventas_netas: 0, cobros: 0, otros_ingresos: 0, compras: 0, gastos: 0, gastos_por_categoria: {},
    ventas_netas_con_costo: 0, costo_de_lo_vendido: 0, utilidad_bruta: 0, margen_sobre_costo_pb: null,
    utilidad_del_periodo: 0, flujo_de_caja: 0, por_cobrar: 0, por_cobrar_vencido: 0,
    por_cobrar_por_tercero: {}, existencia: {}, valor_inventario: 0, dias_de_inventario: null,
    aportaciones: 0, retiros: 0, movimientos_por_completar: 0, pendientes: {},
  }
  const efectos = [...libro.values()].sort((a, b) => a.orden - b.orden)
  const hastaCorte = efectos.filter((x) => x.fecha <= hasta)
  const enPeriodo = (x: Efecto) => x.fecha >= desde

  // Ventas a crédito y lo que se ha cobrado de cada una (el generador solo
  // devuelve ventas de contado, así que aquí las devoluciones no tocan la deuda).
  const creditos = new Map<Uuid, Efecto>()
  const cobrado = new Map<Uuid, number>()
  const costoDeVenta = new Map<Uuid, number | null>()

  for (const [raiz, x] of libro) {
    if (x.tipo === 'venta') costoDeVenta.set(raiz, x.costo)
    if (x.fecha > hasta) continue
    if (x.tipo === 'venta' && x.condicion === 'credito') creditos.set(raiz, x)
    if (x.tipo === 'cobro') cobrado.set(x.aplicaA!, (cobrado.get(x.aplicaA!) ?? 0) + x.monto)
  }

  for (const x of hastaCorte) {
    const signo = ['venta', 'cobro', 'aportacion', 'otro_ingreso'].includes(x.tipo) ? 1 : -1
    const mueveCaja = !(x.tipo === 'venta' && x.condicion === 'credito') && x.tipo !== 'ajuste_existencia'
    if (mueveCaja) {
      const s = x.tipo === 'ajuste_efectivo' ? (x.sentido === 'entra' ? 1 : -1) : signo
      e.saldo_por_medio[x.medio] += s * x.monto
    }
    for (const [p, c] of Object.entries(x.existencia)) e.existencia[p] = (e.existencia[p] ?? 0) + c

    if (!enPeriodo(x)) continue
    if (x.pendientes.length) {
      e.movimientos_por_completar++
      for (const p of x.pendientes) e.pendientes[p] = (e.pendientes[p] ?? 0) + 1
    }
    switch (x.tipo) {
      case 'venta':
        e.ventas_brutas += x.monto
        if (x.condicion === 'credito') e.ventas_credito += x.monto
        else e.ventas_contado += x.monto
        // D-58: lo que no tiene costo cuenta con costo 0.
        e.costo_de_lo_vendido += x.costo ?? x.costoConocido ?? 0
        if (x.costo !== null) e.ventas_netas_con_costo += x.monto
        break
      case 'devolucion_venta':
        e.devoluciones += x.monto
        e.costo_de_lo_vendido -= x.costo ?? x.costoConocido ?? 0
        if (costoDeVenta.get(x.aplicaA!) != null && x.costo !== null) e.ventas_netas_con_costo -= x.monto
        break
      case 'cobro': e.cobros += x.monto; break
      case 'otro_ingreso': e.otros_ingresos += x.monto; break
      case 'compra': e.compras += x.monto; break
      case 'gasto': {
        e.gastos += x.monto
        const c = x.categoria ?? 'sin_categoria'
        e.gastos_por_categoria[c] = (e.gastos_por_categoria[c] ?? 0) + x.monto
        break
      }
      case 'aportacion': e.aportaciones += x.monto; break
      case 'retiro': e.retiros += x.monto; break
    }
  }

  e.saldo_total = Object.values(e.saldo_por_medio).reduce((s, x) => s + x, 0)
  e.ventas_netas = e.ventas_brutas - e.devoluciones
  e.utilidad_bruta = e.ventas_netas - e.costo_de_lo_vendido
  e.margen_sobre_costo_pb = pb(e.utilidad_bruta, e.costo_de_lo_vendido)
  e.utilidad_del_periodo = e.utilidad_bruta - e.gastos
  e.flujo_de_caja = e.ventas_contado + e.cobros + e.otros_ingresos - e.compras - e.gastos

  for (const [raiz, venta] of creditos) {
    const debe = venta.monto - (cobrado.get(raiz) ?? 0)
    if (debe <= 0) continue
    e.por_cobrar += debe
    e.por_cobrar_por_tercero[venta.tercero!] = (e.por_cobrar_por_tercero[venta.tercero!] ?? 0) + debe
    if ((venta.promesa ?? masDias(venta.fecha, 30)) < hasta) e.por_cobrar_vencido += debe
  }

  for (const [p, c] of Object.entries(e.existencia)) {
    const costo = productos.find((x) => x.producto_id === p)?.costo_centavos
    if (c > 0 && costo !== undefined) e.valor_inventario += costoLinea(c, costo)
  }
  if (e.costo_de_lo_vendido > 0) {
    const dias = Math.round((ms(hasta) - ms(desde)) / 86_400_000) + 1
    e.dias_de_inventario = Math.round((e.valor_inventario * dias * 10) / e.costo_de_lo_vendido) / 10
  }
  return e
}

