import { describe, expect, it } from 'vitest'
import {
  calcularImporte, claveSemana, costoPromedioPonderado, formatearPesos, pesosACentavos,
  redondearCantidad, textoAMilesimas,
} from '../../src/dominio/index.ts'

describe('dinero en centavos (D-52)', () => {
  it('convierte lo tecleado sin coma flotante', () => {
    expect(pesosACentavos('0.1')).toBe(10)
    expect(pesosACentavos('$1,234.5')).toBe(123_450)
    expect(pesosACentavos('80')).toBe(8_000)
    expect(pesosACentavos('1.234')).toBeNull()
    expect(pesosACentavos('abc')).toBeNull()
  })

  it('formatea en pesos mexicanos', () => {
    expect(formatearPesos(123_450)).toBe('$1,234.50')
  })

  it('redondea cantidades a múltiplos de 0.005', () => {
    expect(redondearCantidad(1_252)).toBe(1_250)
    expect(redondearCantidad(1_253)).toBe(1_255)
    expect(textoAMilesimas('2.75')).toBe(2_750)
    expect(textoAMilesimas('0.333')).toBe(335)
  })

  it('liquida importes fraccionarios en múltiplos de 5 centavos y enteros al centavo', () => {
    expect(calcularImporte(3_000, 1_233)).toBe(3_699)
    expect(calcularImporte(335, 3_200)).toBe(1_070)
    expect(calcularImporte(2_000, 5_000, 10)).toBe(9_000)
  })
})

describe('costo promedio al comprar (D-53)', () => {
  it('pondera con las existencias', () => {
    // (10 × 40 + 5 × 46) ÷ 15 = 42
    expect(costoPromedioPonderado(10_000, 4_000, 5_000, 4_600)).toBe(4_200)
  })
  it('sin existencias toma el costo nuevo', () => {
    expect(costoPromedioPonderado(0, 4_000, 5_000, 4_600)).toBe(4_600)
    expect(costoPromedioPonderado(-2_000, 4_000, 5_000, 4_600)).toBe(4_600)
    expect(costoPromedioPonderado(3_000, undefined, 5_000, 4_600)).toBe(4_600)
  })
})

describe('semanas ISO', () => {
  it('numera como AAAA-Sww', () => {
    expect(claveSemana('2026-07-06')).toBe('2026-S28')
    expect(claveSemana('2026-07-12')).toBe('2026-S28')
    expect(claveSemana('2027-01-01')).toBe('2026-S53')
  })
})
