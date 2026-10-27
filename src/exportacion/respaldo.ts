// Respaldo manual por archivo (M5a, F-11): un JSON legible, con versión y huella
// (RNF-10, RNF-11). Restaurar lo valida antes de tocar nada. La especificación
// formal del formato queda como DT-12; este es el formato v1 de la PoC-1.

import type { DecisionAlerta, Fecha, FechaHora, Movimiento, Negocio, Producto, Tercero } from '../dominio/tipos.ts'
import type { EstadoNegocio } from '../almacen/indexeddb.ts'
import { hoyEn } from '../dominio/fechas.ts'

export const FORMATO_RESPALDO = 'elchalan-respaldo'
export const VERSION_RESPALDO = 1

export interface DatosRespaldo {
  negocio: Negocio
  terceros: Tercero[]
  productos: Producto[]
  movimientos: Movimiento[]
  decisiones_alerta: DecisionAlerta[]
}

export interface ArchivoRespaldo {
  formato: typeof FORMATO_RESPALDO
  version: number
  generado_en: FechaHora
  /** Para revisar a ojo que el archivo está completo. */
  conteos: Record<keyof Omit<DatosRespaldo, 'negocio'>, number>
  /** SHA-256 de `datos` (JSON compacto): detecta un archivo dañado o editado. */
  huella: string
  datos: DatosRespaldo
}

export type Lectura =
  | { ok: true; datos: DatosRespaldo; generado_en: FechaHora }
  | { ok: false; errores: string[] }

async function sha256(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Contenido del archivo de respaldo, listo para guardar o compartir. */
export async function crearRespaldo(estado: EstadoNegocio, ahora: FechaHora): Promise<string> {
  const datos: DatosRespaldo = {
    negocio: estado.negocio,
    terceros: estado.terceros,
    productos: estado.productos,
    movimientos: estado.movimientos,
    decisiones_alerta: estado.decisiones,
  }
  const archivo: ArchivoRespaldo = {
    formato: FORMATO_RESPALDO,
    version: VERSION_RESPALDO,
    generado_en: ahora,
    conteos: {
      terceros: datos.terceros.length,
      productos: datos.productos.length,
      movimientos: datos.movimientos.length,
      decisiones_alerta: datos.decisiones_alerta.length,
    },
    huella: await sha256(JSON.stringify(datos)),
    datos,
  }
  return JSON.stringify(archivo, null, 2)
}

/** `ElChalan_Mi-negocio_2026-10-27.json` */
export function nombreArchivo(negocio: Negocio, fecha: Fecha): string {
  const nombre = negocio.nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'negocio'
  return `ElChalan_${nombre}_${fecha}.json`
}

/** Lee y valida un respaldo. Si algo no cuadra, explica qué y no devuelve datos. */
export async function leerRespaldo(texto: string): Promise<Lectura> {
  let archivo: ArchivoRespaldo
  try {
    archivo = JSON.parse(texto)
  } catch {
    return { ok: false, errores: ['El archivo no es un respaldo de El Chalán.'] }
  }
  if (archivo?.formato !== FORMATO_RESPALDO || !archivo.datos) {
    return { ok: false, errores: ['El archivo no es un respaldo de El Chalán.'] }
  }
  if (typeof archivo.version !== 'number' || archivo.version > VERSION_RESPALDO) {
    return { ok: false, errores: ['Este respaldo es de una versión más nueva de la app. Actualízala y vuelve a intentar.'] }
  }

  const errores: string[] = []
  const d = archivo.datos
  const listas = ['terceros', 'productos', 'movimientos', 'decisiones_alerta'] as const
  if (!d.negocio?.negocio_id || listas.some((l) => !Array.isArray(d[l]))) {
    return { ok: false, errores: ['Al respaldo le faltan partes.'] }
  }
  for (const l of listas) {
    if (archivo.conteos?.[l] !== d[l].length) errores.push(`Faltan registros en «${l}».`)
  }
  if ((await sha256(JSON.stringify(d))) !== archivo.huella) {
    errores.push('El archivo está dañado o fue modificado.')
  }

  // Coherencia del registro: ids únicos y referencias a movimientos anteriores.
  const vistos = new Set<string>()
  for (const m of d.movimientos) {
    if (vistos.has(m.movimiento_id)) errores.push(`Movimiento repetido: ${m.movimiento_id}.`)
    if (m.corrige_a && !vistos.has(m.corrige_a)) errores.push(`Una corrección apunta a un movimiento que no está: ${m.corrige_a}.`)
    if (m.negocio_id !== d.negocio.negocio_id) errores.push(`Un movimiento es de otro negocio: ${m.movimiento_id}.`)
    vistos.add(m.movimiento_id)
  }
  if (errores.length) return { ok: false, errores }
  return { ok: true, datos: d, generado_en: archivo.generado_en }
}

/** Convierte un respaldo leído en el estado que se guarda; el último respaldo es el del archivo. */
export function estadoDesdeRespaldo(datos: DatosRespaldo, generadoEn: FechaHora, versionEsquema: number): EstadoNegocio {
  return {
    negocio: datos.negocio,
    terceros: datos.terceros,
    productos: datos.productos,
    movimientos: datos.movimientos,
    decisiones: datos.decisiones_alerta,
    meta: { version_esquema: versionEsquema, ultimo_respaldo: hoyEn(datos.negocio.zona_horaria, new Date(generadoEn)) },
  }
}
