// Fechas del hecho como texto `AAAA-MM-DD`: se comparan y suman sin zonas horarias.

import type { Fecha } from './tipos.ts'

const DIA_MS = 86_400_000

function aMs(fecha: Fecha): number {
  return Date.parse(`${fecha}T00:00:00Z`)
}

function deMs(ms: number): Fecha {
  return new Date(ms).toISOString().slice(0, 10)
}

export function sumarDias(fecha: Fecha, dias: number): Fecha {
  return deMs(aMs(fecha) + dias * DIA_MS)
}

export function diasEntre(desde: Fecha, hasta: Fecha): number {
  return Math.round((aMs(hasta) - aMs(desde)) / DIA_MS)
}

/** Lunes de la semana ISO que contiene la fecha. */
export function inicioDeSemana(fecha: Fecha): Fecha {
  const dia = new Date(aMs(fecha)).getUTCDay() // 0 = domingo
  return sumarDias(fecha, -((dia + 6) % 7))
}

/** Semana ISO como `AAAA-Sww` (CH-04 §5.8). */
export function claveSemana(fecha: Fecha): string {
  const jueves = sumarDias(inicioDeSemana(fecha), 3)
  const anio = jueves.slice(0, 4)
  const semana = Math.floor(diasEntre(`${anio}-01-01`, jueves) / 7) + 1
  return `${anio}-S${String(semana).padStart(2, '0')}`
}

export function claveMes(fecha: Fecha): string {
  return fecha.slice(0, 7)
}

export function finDeMes(fecha: Fecha): Fecha {
  const [anio, mes] = fecha.split('-').map(Number)
  return deMs(Date.UTC(anio, mes, 0))
}

/** Fecha de hoy en la zona del negocio. */
export function hoyEn(zonaHoraria: string, ahora = new Date()): Fecha {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria }).format(ahora)
}
