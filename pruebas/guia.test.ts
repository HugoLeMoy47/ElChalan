// Acompañamiento didáctico (guia.ts): primeros pasos, pistas y glosario.

import { describe, expect, it } from 'vitest'
import { GLOSARIO, PISTAS, avance, clavePista, escribirVisto, leerVisto, misiones, siguiente, termino } from '../src/interfaz/guia.ts'

const vacio = { movimientos: [], visto: new Set<string>() }

describe('primeros pasos', () => {
  it('un negocio nuevo empieza con todo pendiente y la primera venta como siguiente', () => {
    const ms = misiones(vacio)
    expect(ms.map((m) => m.id)).toEqual(['venta', 'gasto', 'compra', 'respaldo', 'semana'])
    expect(avance(ms)).toEqual({ hechos: 0, total: 5, completo: false })
    expect(siguiente(ms)?.id).toBe('venta')
  })

  it('se palomean solos con lo que ya pasó', () => {
    const ms = misiones({
      movimientos: [{ tipo: 'venta', operacion: 'alta' }, { tipo: 'gasto', operacion: 'correccion' }],
      ultimoRespaldo: '2026-11-16',
      visto: new Set(['periodo']),
    })
    expect(ms.filter((m) => m.hecho).map((m) => m.id)).toEqual(['venta', 'gasto', 'respaldo', 'semana'])
    expect(siguiente(ms)?.id).toBe('compra')
  })

  it('una venta anulada no cuenta como primera venta', () => {
    const ms = misiones({ ...vacio, movimientos: [{ tipo: 'venta', operacion: 'anulacion' }] })
    expect(ms[0].hecho).toBe(false)
  })

  it('a quien da servicios no se le pide anotar compras de mercancía', () => {
    const ms = misiones({ ...vacio, giro: 'servicios' })
    expect(ms.map((m) => m.id)).not.toContain('compra')
    expect(avance(ms).total).toBe(4)
  })

  it('al terminar todo no hay siguiente', () => {
    const ms = misiones({
      movimientos: (['venta', 'gasto', 'compra'] as const).map((tipo) => ({ tipo, operacion: 'alta' as const })),
      ultimoRespaldo: '2026-11-16',
      visto: new Set(['periodo']),
    })
    expect(avance(ms).completo).toBe(true)
    expect(siguiente(ms)).toBeNull()
  })
})

describe('pistas', () => {
  it('cada tipo de anotación tiene su propia pista; las pantallas sin pista no muestran nada', () => {
    expect(clavePista('captura', 'compra')).toBe('captura:compra')
    expect(clavePista('movimientos')).toBe('movimientos')
    expect(clavePista('captura', 'devolucion_venta')).toBeNull()
    expect(clavePista('ajustes')).toBeNull()
  })

  it('compra y gasto se explican uno contra el otro (la confusión más común)', () => {
    expect(PISTAS['captura:compra'].texto).toContain('Gasté')
    expect(PISTAS['captura:gasto'].texto).toContain('Compré mercancía')
  })
})

describe('glosario', () => {
  it('no repite términos y usa las palabras de la pantalla', () => {
    const ids = GLOSARIO.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(termino('gane')?.palabra).toBe('Gané')
    expect(termino('no-existe')).toBeUndefined()
  })

  it('no usa jerga contable (D-16)', () => {
    const todo = [...GLOSARIO.map((t) => t.significa), ...Object.values(PISTAS).map((p) => p.texto)].join(' ').toLowerCase()
    for (const jerga of ['utilidad', 'flujo de caja', 'egreso', 'ingreso bruto', 'cuentas por cobrar']) expect(todo).not.toContain(jerga)
  })
})

describe('lo que se recuerda', () => {
  it('ida y vuelta, y tolera basura', () => {
    expect([...leerVisto(escribirVisto(new Set(['pista:deben', 'vio:periodo'])))]).toEqual(['pista:deben', 'vio:periodo'])
    expect(leerVisto(null).size).toBe(0)
    expect(leerVisto('{roto').size).toBe(0)
    expect(leerVisto('[1, "pista:x"]')).toEqual(new Set(['pista:x']))
  })
})
