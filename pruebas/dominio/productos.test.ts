// «¿Actualizo el costo?» al comprar (D-50, D-53) y existencias de Mis productos (F-9).

import { describe, expect, it } from 'vitest'
import { costoTrasCompra, existencias, seEstaAcabando, vendidoPorProducto, type Movimiento } from '../../src/dominio/index.ts'
import { producto } from './apoyo.ts'

describe('costo del catálogo tras una compra', () => {
  // Había 10 a $40; compro 5 a $46.
  it('«Sí» toma el costo de la compra', () => {
    expect(costoTrasCompra('si', 4_000, 10_000, 5_000, 4_600)).toBe(4_600)
  })
  it('«No» deja el costo como estaba', () => {
    expect(costoTrasCompra('no', 4_000, 10_000, 5_000, 4_600)).toBe(4_000)
    expect(costoTrasCompra('no', undefined, 0, 5_000, 4_600)).toBeUndefined()
  })
  it('«Usar el promedio» pondera con lo que había: (10 × 40 + 5 × 46) ÷ 15 = 42', () => {
    expect(costoTrasCompra('promedio', 4_000, 10_000, 5_000, 4_600)).toBe(4_200)
  })
  it('«Usar el promedio» sin existencias toma el costo nuevo', () => {
    expect(costoTrasCompra('promedio', 4_000, -2_000, 5_000, 4_600)).toBe(4_600)
  })
})

describe('existencias', () => {
  it('da cuántos tengo y cuánto vale al costo del catálogo', () => {
    const lista = existencias(
      [producto('gorra', 4_000), producto('sin-costo'), producto('termo', 10_000), producto('nuevo', 500)],
      { gorra: 8_000, 'sin-costo': 3_000, termo: -1_000 },
    )
    expect(lista.map((e) => [e.producto.producto_id, e.cantidad, e.valor])).toEqual([
      ['gorra', 8_000, 32_000],
      ['sin-costo', 3_000, null],
      ['termo', -1_000, null], // negativa: se marca (AN-11), no resta valor
      ['nuevo', 0, null],
    ])
  })
})

describe('más vendidos y se está acabando (UX-15)', () => {
  const venta = (fecha: string, ...renglones: [string, number][]) =>
    ({ tipo: 'venta', fecha, renglones: renglones.map(([producto_id, cantidad_milesimas]) => ({ producto_id, cantidad_milesimas })) }) as unknown as Movimiento
  it('suma lo vendido por producto dentro de las fechas', () => {
    const vigentes = [
      venta('2026-10-20', ['gorra', 2_000], ['termo', 1_000]),
      venta('2026-10-25', ['gorra', 3_000]),
      venta('2026-09-01', ['gorra', 50_000]), // fuera
      { tipo: 'compra', fecha: '2026-10-25', renglones: [{ producto_id: 'gorra', cantidad_milesimas: 9_000 }] } as unknown as Movimiento,
    ]
    expect(vendidoPorProducto(vigentes, '2026-10-14', '2026-10-27')).toEqual({ gorra: 5_000, termo: 1_000 })
  })
  it('se acaba si lo que queda no alcanza para una semana', () => {
    expect(seEstaAcabando(3_000, 14_000)).toBe(true) // vende 7 por semana, quedan 3
    expect(seEstaAcabando(7_000, 14_000)).toBe(true)
    expect(seEstaAcabando(8_000, 14_000)).toBe(false)
    expect(seEstaAcabando(1_000, 0)).toBe(false) // no se ha vendido
    expect(seEstaAcabando(0, 14_000)).toBe(false) // ya no hay: se marca aparte
  })
})
