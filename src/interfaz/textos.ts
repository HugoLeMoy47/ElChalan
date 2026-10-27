// Textos de calle (CH-16 §4, D-16). Los nombres internos nunca se muestran.

import { formatearPesos, type CategoriaGasto, type MedioPago, type TipoMovimiento } from '../dominio/index.ts'

export const TIPO: Record<TipoMovimiento, { texto: string; icono: string; entra: boolean }> = {
  venta: { texto: 'Vendí', icono: '🛒', entra: true },
  cobro: { texto: 'Me pagaron', icono: '💰', entra: true },
  aportacion: { texto: 'Puse dinero', icono: '➕', entra: true },
  otro_ingreso: { texto: 'Otro ingreso', icono: '➕', entra: true },
  compra: { texto: 'Compré mercancía', icono: '📦', entra: false },
  gasto: { texto: 'Gasté', icono: '💸', entra: false },
  retiro: { texto: 'Saqué dinero', icono: '🏧', entra: false },
  devolucion_venta: { texto: 'Me devolvieron', icono: '↩️', entra: false },
  ajuste_existencia: { texto: 'Ajusté mi bodega', icono: '📋', entra: false },
  ajuste_efectivo: { texto: 'Ajusté mi caja', icono: '🧮', entra: false },
}

export const MEDIO: Record<MedioPago, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro',
}

export const CATEGORIA: Record<CategoriaGasto, string> = {
  renta: 'Renta', servicios: 'Luz, agua, internet', transporte: 'Transporte', publicidad: 'Publicidad',
  comisiones: 'Comisiones', sueldos: 'Sueldos', empaque: 'Empaque', otros: 'Otros',
}

/** Por qué se ajustó la bodega (F-9), en lenguaje de calle. */
export const MOTIVO_AJUSTE: Record<string, string> = {
  conteo: 'Conté', merma: 'Se echó a perder', regalo: 'Lo regalé', 'uso propio': 'Lo usé yo',
  'inventario inicial': 'Inventario inicial',
}

/** `$1,234.50` */
export const pesos = formatearPesos

/** dd/mm/aaaa (CH-14 §1). */
export function fechaCorta(f: string): string {
  const [a, m, d] = f.split('-')
  return `${d}/${m}/${a}`
}

/** «hoy», «ayer», «hace 3 días». */
export function haceDias(dias: number): string {
  return dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`
}

/** «13 piezas», «1.25 kilos», «1 caja». */
export function cantidadCon(milesimas: number, unidad: string): string {
  const n = milesimas / 1000
  const plural = Math.abs(n) === 1 ? '' : /[aeiou]$/.test(unidad) ? 's' : 'es'
  return `${n.toLocaleString('es-MX', { maximumFractionDigits: 3 }).replace('-', '−')} ${unidad}${plural}`
}

/** Puntos base → «48.8 %». */
export function porcentaje(pb: number | null): string {
  return pb === null ? '—' : `${(pb / 100).toLocaleString('es-MX', { maximumFractionDigits: 1 })} %`
}
