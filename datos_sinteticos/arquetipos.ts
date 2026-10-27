// Arma cada arquetipo con su verdad de terreno por semana, por mes y del periodo completo.

import type { Fecha } from '../src/dominio/tipos.ts'
import { A1, generarA1 } from './a1.ts'
import { A2, generarA2 } from './a2.ts'
import { masDias, type AlertaEsperada, type Generador, type IntentoRechazado } from './comun.ts'
import { verdad, type Esperado } from './verdad.ts'

export interface PeriodoEsperado {
  clave: string
  desde: Fecha
  hasta: Fecha
  vistas: Esperado
}

export interface Arquetipo {
  id: string
  semilla: number
  generador: Generador
  esperado: {
    arquetipo: string
    semilla: number
    semanas: PeriodoEsperado[]
    meses: PeriodoEsperado[]
    total: PeriodoEsperado
    alertas_esperadas: AlertaEsperada[]
    intentos_rechazados: IntentoRechazado[]
  }
}

function periodos(inicio: Fecha, fin: Fecha) {
  const semanas: { clave: string; desde: Fecha; hasta: Fecha }[] = []
  for (let d = inicio, n = 1; d <= fin; d = masDias(d, 7), n++) {
    semanas.push({ clave: `semana ${String(n).padStart(2, '0')}`, desde: d, hasta: masDias(d, 6) < fin ? masDias(d, 6) : fin })
  }
  const meses: { clave: string; desde: Fecha; hasta: Fecha }[] = []
  for (let d = inicio; d <= fin;) {
    const mes = d.slice(0, 7)
    let h = d
    while (masDias(h, 1).slice(0, 7) === mes && masDias(h, 1) <= fin) h = masDias(h, 1)
    meses.push({ clave: mes, desde: d, hasta: h })
    d = masDias(h, 1)
  }
  return { semanas, meses }
}

function armar(cfg: { id: string; semilla: number; inicio: Fecha; fin: Fecha; capital: number }, generar: () => Generador): Arquetipo {
  const g = generar()
  const calc = (p: { clave: string; desde: Fecha; hasta: Fecha }): PeriodoEsperado => ({
    ...p, vistas: verdad(g.libro, cfg.capital, g.productos, p.desde, p.hasta),
  })
  const { semanas, meses } = periodos(cfg.inicio, cfg.fin)
  return {
    id: cfg.id,
    semilla: cfg.semilla,
    generador: g,
    esperado: {
      arquetipo: cfg.id,
      semilla: cfg.semilla,
      semanas: semanas.map(calc),
      meses: meses.map(calc),
      total: calc({ clave: 'total', desde: cfg.inicio, hasta: cfg.fin }),
      alertas_esperadas: g.alertas,
      intentos_rechazados: g.rechazados,
    },
  }
}

export const ARQUETIPOS = {
  A1: () => armar(A1, generarA1),
  A2: () => armar(A2, generarA2),
}

/** Contenido de cada archivo de CH-08 §8, tal como se escribe en disco. */
export function archivos(a: Arquetipo): Record<string, string> {
  const g = a.generador
  const json = (x: unknown) => JSON.stringify(x, null, 2) + '\n'
  return {
    'registro_eventos.jsonl': g.registro.map((m) => JSON.stringify(m)).join('\n') + '\n',
    'catalogos.json': json({ negocio: g.negocio, terceros: g.terceros, productos: g.productos }),
    'esperado.json': json(a.esperado),
  }
}
