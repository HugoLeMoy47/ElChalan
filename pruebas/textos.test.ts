// Encabezados de día en Movimientos (UX-09).

import { describe, expect, it } from 'vitest'
import { fechaLarga, nombreDelDia } from '../src/interfaz/textos.ts'

describe('nombres de los días', () => {
  it('hoy, ayer y después el día con su fecha', () => {
    expect(nombreDelDia('2026-10-27', '2026-10-27')).toBe('Hoy')
    expect(nombreDelDia('2026-10-26', '2026-10-27')).toBe('Ayer')
    expect(nombreDelDia('2026-10-25', '2026-10-27')).toBe('Domingo 25 de octubre')
  })
  it('agrega el año si no es el actual', () => {
    expect(fechaLarga('2025-12-31', '2026-01-02')).toBe('miércoles 31 de diciembre de 2025')
  })
})
