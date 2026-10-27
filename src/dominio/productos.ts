// Catálogo ligero (CH-04 §5.3, §7.5): existencias, valor y el costo tras una compra.

import { costoDeCantidad, costoPromedioPonderado } from './dinero.ts'
import type { Centavos, Fecha, Milesimas, Movimiento, Producto, Uuid } from './tipos.ts'

/** Respuesta a «¿Actualizo el costo de X a $Y?» al registrar una compra (D-50). */
export type DecisionCosto = 'si' | 'no' | 'promedio'

/**
 * Costo del catálogo después de la compra. «Usar el promedio» pondera con lo que había
 * en bodega antes de comprar (D-53); si no había nada, toma el costo de la compra.
 */
export function costoTrasCompra(
  decision: DecisionCosto,
  costoActual: Centavos | undefined,
  existenciaAntes: Milesimas,
  cantidadComprada: Milesimas,
  costoCompra: Centavos,
): Centavos | undefined {
  if (decision === 'no') return costoActual
  if (decision === 'si') return costoCompra
  return costoPromedioPonderado(existenciaAntes, costoActual, cantidadComprada, costoCompra)
}

export interface Existencia {
  producto: Producto
  cantidad: Milesimas
  /** Al costo vigente del catálogo; `null` si no tiene costo o la existencia es negativa. */
  valor: Centavos | null
}

/** Mis productos con cuántos tengo y cuánto vale (F-9). */
export function existencias(productos: readonly Producto[], cantidades: Readonly<Record<string, Milesimas>>): Existencia[] {
  return productos.map((producto) => {
    const cantidad = cantidades[producto.producto_id] ?? 0
    const valor = producto.costo_centavos !== undefined && cantidad > 0 ? costoDeCantidad(cantidad, producto.costo_centavos) : null
    return { producto, cantidad, valor }
  })
}

/** Cantidad vendida de cada producto entre dos fechas, de los movimientos vigentes (UX-15). */
export function vendidoPorProducto(vigentes: readonly Movimiento[], desde: Fecha, hasta: Fecha): Record<Uuid, Milesimas> {
  const vendido: Record<Uuid, Milesimas> = {}
  for (const m of vigentes) {
    if (m.tipo !== 'venta' || m.fecha < desde || m.fecha > hasta) continue
    for (const r of m.renglones) {
      if (r.producto_id) vendido[r.producto_id] = (vendido[r.producto_id] ?? 0) + r.cantidad_milesimas
    }
  }
  return vendido
}

/** «Se está acabando»: lo que queda alcanza para menos de una semana al ritmo de las
 *  últimas dos (UX-15). Sin ventas recientes no se marca. */
export function seEstaAcabando(cantidad: Milesimas, vendidoEn14Dias: Milesimas): boolean {
  return cantidad > 0 && vendidoEn14Dias > 0 && cantidad * 2 <= vendidoEn14Dias
}
