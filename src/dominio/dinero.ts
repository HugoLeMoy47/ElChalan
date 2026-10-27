// Dinero y cantidades sin coma flotante (D-52, RNF-03).
// Todo se opera en enteros: centavos para el dinero, milésimas para las cantidades.

import type { Centavos, Milesimas } from './tipos.ts'

/** División entera redondeando la mitad hacia arriba (lejos de cero). */
export function dividirRedondeando(numerador: number, divisor: number): number {
  if (divisor <= 0) throw new Error('El divisor debe ser positivo')
  const signo = numerador < 0 ? -1 : 1
  const abs = Math.abs(numerador)
  return signo * Math.floor((abs * 2 + divisor) / (divisor * 2)) || 0 // sin «−0»
}

/** Redondea al múltiplo de 5 más cercano (D-52). */
export function redondearA5(valor: number): number {
  return dividirRedondeando(valor, 5) * 5
}

/** Redondea una cantidad a múltiplos de 0.005 (5 milésimas), según D-52. */
export function redondearCantidad(cantidad: Milesimas): Milesimas {
  return redondearA5(cantidad)
}

/**
 * Importe de un renglón: cantidad × precio, menos descuento.
 * Si la cantidad trae fracción, el importe se liquida en múltiplos de 5 centavos (D-52);
 * con cantidades enteras se conserva al centavo.
 */
export function calcularImporte(
  cantidad: Milesimas,
  precioUnitario: Centavos,
  descuentoPct = 0,
): Centavos {
  const bruto = Math.abs(cantidad) * precioUnitario // en milésimas de centavo
  const conDescuento = descuentoPct ? bruto * (100 - descuentoPct) / 100 : bruto
  const centavos = dividirRedondeando(Math.round(conDescuento), 1000)
  return Math.abs(cantidad) % 1000 === 0 ? centavos : redondearA5(centavos)
}

/** Costo de una cantidad al costo unitario dado, redondeado al centavo. */
export function costoDeCantidad(cantidad: Milesimas, costoUnitario: Centavos): Centavos {
  return dividirRedondeando(cantidad * costoUnitario, 1000)
}

/**
 * «Usar el promedio» al comprar (D-53): promedio ponderado con las existencias.
 * Si la existencia actual es ≤ 0 o no hay costo previo, se adopta el costo de compra.
 */
export function costoPromedioPonderado(
  existenciaActual: Milesimas,
  costoActual: Centavos | undefined,
  cantidadComprada: Milesimas,
  costoCompra: Centavos,
): Centavos {
  if (existenciaActual <= 0 || costoActual === undefined) return costoCompra
  return dividirRedondeando(
    existenciaActual * costoActual + cantidadComprada * costoCompra,
    existenciaActual + cantidadComprada,
  )
}

/** Convierte lo que teclea el usuario («1,234.5», «$80») a centavos. */
export function pesosACentavos(texto: string): Centavos | null {
  const limpio = texto.replace(/[$\s,]/g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(limpio)) return null
  const [enteros, fraccion = ''] = limpio.split('.')
  return Number(enteros) * 100 + Number(fraccion.padEnd(2, '0'))
}

/** Convierte una cantidad tecleada («2.75») a milésimas, redondeada a múltiplos de 5. */
export function textoAMilesimas(texto: string): Milesimas | null {
  const limpio = texto.replace(/[\s,]/g, '')
  if (!/^-?\d+(\.\d{0,3})?$/.test(limpio)) return null
  const negativo = limpio.startsWith('-')
  const [enteros, fraccion = ''] = limpio.replace('-', '').split('.')
  const valor = Number(enteros) * 1000 + Number(fraccion.padEnd(3, '0'))
  return redondearCantidad(negativo ? -valor : valor)
}

const formatoPesos = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
})

/** `$1,234.50` (CH-14 §1). */
export function formatearPesos(centavos: Centavos): string {
  return formatoPesos.format(centavos / 100)
}
