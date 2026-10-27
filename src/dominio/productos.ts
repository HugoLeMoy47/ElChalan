// Catálogo ligero (CH-04 §5.3, §7.5): existencias, valor y el costo tras una compra.

import { costoDeCantidad, costoPromedioPonderado } from './dinero.ts'
import type { Centavos, Milesimas, Producto } from './tipos.ts'

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
