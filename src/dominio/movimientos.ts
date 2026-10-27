// Firmar, corregir y anular movimientos (CH-04 §7.1, §7.2 y prevención de §12).
// Puro: recibe el contexto (hoy, ids, catálogo) y devuelve el movimiento o los errores.

import { calcularImporte, dividirRedondeando } from './dinero.ts'
import { sumarDias } from './fechas.ts'
import type { Versiones } from './versiones.ts'
import type {
  CategoriaGasto, Centavos, Condicion, EstadoRegistro, Fecha, FechaHora, MedioPago,
  Milesimas, Movimiento, OrigenCaptura, Pendiente, Producto, Renglon, Sentido,
  TipoMovimiento, Uuid,
} from './tipos.ts'
import { TIPOS_MOVIMIENTO } from './tipos.ts'

export interface Contexto {
  negocio_id: Uuid
  dispositivo_id: Uuid
  /** Hoy en la zona del negocio. */
  hoy: Fecha
  ahora: FechaHora
  nuevoId: () => Uuid
  productos?: ReadonlyMap<Uuid, Producto>
}

export interface DatosRenglon {
  producto_id?: Uuid
  descripcion?: string
  cantidad_milesimas: Milesimas
  unidad_medida?: string
  precio_unitario_centavos?: Centavos
  costo_unitario_centavos?: Centavos
  descuento_pct?: number
  importe_centavos?: Centavos
}

export interface DatosMovimiento {
  tipo: TipoMovimiento
  fecha?: Fecha
  /** Si se omite y hay renglones, es la suma de sus importes (D-56). */
  monto_centavos?: Centavos
  medio_pago?: MedioPago
  sentido?: Sentido
  condicion?: Condicion
  fecha_promesa?: Fecha
  origen_id?: Uuid
  /** Solo en devoluciones: lo que se queda el negocio (D-59). */
  penalizacion_centavos?: Centavos
  tercero_id?: Uuid
  categoria_gasto?: CategoriaGasto
  concepto?: string
  notas?: string
  pendientes?: Pendiente[]
  origen_captura?: OrigenCaptura
  por_confirmar?: boolean
  renglones?: DatosRenglon[]
}

export interface ErrorValidacion {
  codigo: string
  mensaje: string
}

export type Resultado =
  | { ok: true; movimiento: Movimiento }
  | { ok: false; errores: ErrorValidacion[] }

/** Días que se proponen para una fecha de promesa vacía (AN-07). */
export const DIAS_PROMESA_POR_OMISION = 30

/** Penalización de costumbre en las devoluciones (D-60). */
export const PENALIZACION_DEVOLUCION_PCT = 50

/**
 * Penalización que la app propone al registrar una devolución: un porcentaje de lo
 * devuelto (50 % salvo que el negocio diga otra cosa). El usuario puede teclear otro monto.
 */
export function penalizacionSugerida(monto: Centavos, pct = PENALIZACION_DEVOLUCION_PCT): Centavos {
  return dividirRedondeando(monto * pct, 100)
}

const TIPOS_CON_ORIGEN: TipoMovimiento[] = ['cobro', 'devolucion_venta']

function armarRenglones(
  datos: DatosMovimiento,
  movimientoId: Uuid,
  ctx: Contexto,
): Renglon[] {
  return (datos.renglones ?? []).map((r) => {
    const producto = r.producto_id ? ctx.productos?.get(r.producto_id) : undefined
    const esVenta = datos.tipo === 'venta'
    // D-50: en la venta el costo se copia solo del catálogo; el precio también.
    const costo = r.costo_unitario_centavos ?? (esVenta ? producto?.costo_centavos : undefined)
    const precio = r.precio_unitario_centavos ?? (esVenta ? producto?.precio_venta_centavos : undefined)
    const importe = r.importe_centavos
      ?? (precio !== undefined ? calcularImporte(r.cantidad_milesimas, precio, r.descuento_pct) : 0)
    const renglon: Renglon = {
      renglon_id: ctx.nuevoId(),
      movimiento_id: movimientoId,
      cantidad_milesimas: r.cantidad_milesimas,
      unidad_medida: r.unidad_medida ?? producto?.unidad_medida ?? 'pieza',
      importe_centavos: importe,
    }
    if (r.producto_id) renglon.producto_id = r.producto_id
    if (r.descripcion) renglon.descripcion = r.descripcion
    if (precio !== undefined) renglon.precio_unitario_centavos = precio
    if (costo !== undefined) renglon.costo_unitario_centavos = costo
    if (r.descuento_pct) renglon.descuento_pct = r.descuento_pct
    return renglon
  })
}

function validar(datos: DatosMovimiento, monto: Centavos, fecha: Fecha, ctx: Contexto): ErrorValidacion[] {
  const errores: ErrorValidacion[] = []
  const err = (codigo: string, mensaje: string) => errores.push({ codigo, mensaje })

  if (!TIPOS_MOVIMIENTO.includes(datos.tipo)) err('tipo', 'No sé qué tipo de movimiento es.')
  const sinDinero = datos.tipo === 'ajuste_existencia'
  if (!Number.isInteger(monto) || monto < 0 || (!sinDinero && monto === 0)) {
    err('monto', '¿Cuánto fue? El monto debe ser mayor que cero.')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) err('fecha', 'La fecha no es válida.')
  else if (fecha > sumarDias(ctx.hoy, 1)) err('AN-01', 'La fecha está en el futuro.')

  if (datos.condicion && datos.tipo !== 'venta') err('condicion', 'Solo una venta puede ser a crédito.')
  if (datos.tipo === 'venta' && datos.condicion === 'credito' && !datos.tercero_id) {
    err('sin_tercero', '¿Quién te debe? Pon al menos un apodo.') // D-55
  }
  if (TIPOS_CON_ORIGEN.includes(datos.tipo) && !datos.origen_id) {
    err('origen', '¿De qué venta es? Elige la venta.')
  }
  if (datos.tipo === 'ajuste_existencia' && !datos.concepto?.trim()) {
    err('concepto', '¿Por qué ajustas la bodega?')
  }
  if (datos.tipo === 'ajuste_efectivo' && !datos.sentido) err('sentido', '¿Sobró o faltó dinero?')
  const pena = datos.penalizacion_centavos
  if (pena !== undefined) {
    if (datos.tipo !== 'devolucion_venta') err('penalizacion', 'Solo una devolución lleva penalización.')
    else if (!Number.isInteger(pena) || pena < 0 || pena > monto) {
      err('penalizacion', 'La penalización no puede ser mayor que lo devuelto.')
    }
  }

  for (const r of datos.renglones ?? []) {
    if (!r.producto_id && !r.descripcion?.trim()) err('renglon', 'Cada renglón necesita producto o descripción.')
    if (!Number.isInteger(r.cantidad_milesimas) || r.cantidad_milesimas === 0) {
      err('cantidad', 'La cantidad no puede ser cero.')
    } else if (r.cantidad_milesimas < 0 && datos.tipo !== 'ajuste_existencia') {
      err('cantidad', 'La cantidad debe ser positiva.')
    }
  }
  return errores
}

function calcularPendientes(datos: DatosMovimiento, monto: Centavos, renglones: Renglon[]): Pendiente[] {
  const p = new Set<Pendiente>(datos.pendientes ?? [])
  if (datos.tipo === 'venta' && datos.condicion === 'credito' && !datos.fecha_promesa) p.add('sin_fecha_promesa')
  if (datos.tipo === 'gasto' && !datos.categoria_gasto) p.add('sin_categoria')
  // AN-06 es de productos sin costo; un renglón con descripción libre no tiene catálogo.
  if (datos.tipo === 'venta' && renglones.some((r) => r.producto_id && r.costo_unitario_centavos === undefined)) {
    p.add('sin_costo')
  }
  if (renglones.length > 0 && datos.tipo !== 'ajuste_existencia') {
    const suma = renglones.reduce((s, r) => s + r.importe_centavos, 0)
    if (suma !== monto) p.add('monto_no_cuadra') // AN-08: gana el monto
  }
  return [...p]
}

function construir(
  datos: DatosMovimiento,
  ctx: Contexto,
  extra: Pick<Movimiento, 'operacion'> & { corrige_a?: Uuid },
): Resultado {
  const id = ctx.nuevoId()
  const renglones = armarRenglones(datos, id, ctx)
  const monto = datos.monto_centavos ?? renglones.reduce((s, r) => s + r.importe_centavos, 0)
  const fecha = datos.fecha ?? ctx.hoy

  const errores = validar(datos, monto, fecha, ctx)
  if (errores.length) return { ok: false, errores }

  const pendientes = calcularPendientes(datos, monto, renglones)
  const estado: EstadoRegistro = datos.por_confirmar
    ? 'por_confirmar'
    : pendientes.length ? 'por_completar' : 'firme'

  const m: Movimiento = {
    movimiento_id: id,
    negocio_id: ctx.negocio_id,
    operacion: extra.operacion,
    tipo: datos.tipo,
    fecha,
    monto_centavos: monto,
    medio_pago: datos.medio_pago ?? 'efectivo',
    estado_registro: estado,
    pendientes,
    origen_captura: datos.origen_captura ?? 'manual',
    creado_en: ctx.ahora,
    dispositivo_id: ctx.dispositivo_id,
    renglones,
  }
  if (extra.corrige_a) m.corrige_a = extra.corrige_a
  if (estado !== 'por_confirmar') m.confirmado_en = ctx.ahora
  if (datos.tipo === 'venta') m.condicion = datos.condicion ?? 'contado'
  if (datos.sentido) m.sentido = datos.sentido
  if (datos.fecha_promesa) m.fecha_promesa = datos.fecha_promesa
  if (datos.origen_id) m.origen_id = datos.origen_id
  if (datos.penalizacion_centavos) m.penalizacion_centavos = datos.penalizacion_centavos
  if (datos.tercero_id) m.tercero_id = datos.tercero_id
  if (datos.categoria_gasto) m.categoria_gasto = datos.categoria_gasto
  if (datos.concepto) m.concepto = datos.concepto
  if (datos.notas) m.notas = datos.notas
  return { ok: true, movimiento: m }
}

/** Firma un movimiento nuevo: basta fecha, tipo y monto (§7.1); lo demás queda pendiente. */
export function firmar(datos: DatosMovimiento, ctx: Contexto): Resultado {
  return construir(datos, ctx, { operacion: 'alta' })
}

function objetivoVigente(versiones: Versiones, id: Uuid): ErrorValidacion | Movimiento {
  const m = versiones.porId.get(id)
  if (!m || m.operacion === 'anulacion') return { codigo: 'objetivo', mensaje: 'No encuentro ese movimiento.' }
  if (versiones.sustituidaPor.has(id)) {
    return { codigo: 'version', mensaje: 'Ese movimiento ya se corrigió o anuló; usa la última versión.' }
  }
  return m
}

/** Corrige con un movimiento nuevo que sustituye a la versión vigente (§7.2). */
export function corregir(
  versiones: Versiones,
  id: Uuid,
  datos: DatosMovimiento,
  ctx: Contexto,
): Resultado {
  const objetivo = objetivoVigente(versiones, id)
  if (!('movimiento_id' in objetivo)) return { ok: false, errores: [objetivo] }
  return construir(datos, ctx, { operacion: 'correccion', corrige_a: id })
}

/** Anula con un movimiento nuevo; el original se conserva y deja de contar (§7.2). */
export function anular(versiones: Versiones, id: Uuid, ctx: Contexto, motivo?: string): Resultado {
  const objetivo = objetivoVigente(versiones, id)
  if (!('movimiento_id' in objetivo)) return { ok: false, errores: [objetivo] }
  const m: Movimiento = {
    ...objetivo,
    movimiento_id: ctx.nuevoId(),
    operacion: 'anulacion',
    corrige_a: id,
    creado_en: ctx.ahora,
    confirmado_en: ctx.ahora,
    dispositivo_id: ctx.dispositivo_id,
    renglones: [],
  }
  if (motivo) m.notas = motivo
  else delete m.notas
  return { ok: true, movimiento: m }
}

/** Fecha de promesa efectiva: la capturada o la fecha de la venta + 30 días (AN-07). */
export function fechaPromesaEfectiva(venta: Movimiento): Fecha {
  return venta.fecha_promesa ?? sumarDias(venta.fecha, DIAS_PROMESA_POR_OMISION)
}
