// «¿Actualizo el costo?» al comprar (D-50, D-53) y existencias de Mis productos (F-9).

import { describe, expect, it } from 'vitest'
import { costoTrasCompra, existencias } from '../../src/dominio/index.ts'
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
