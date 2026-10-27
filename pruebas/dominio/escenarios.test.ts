// Escenarios obligatorios de CH-08 §5 que aplican al dominio de la PoC-1:
// T-01 a T-11, T-14 y T-17. Cada resultado esperado está calculado a mano
// en el comentario de la prueba, no con la lógica que se prueba.

import { describe, expect, it } from 'vitest'
import { firmar } from '../../src/dominio/index.ts'
import { Libro, NEGOCIO, producto } from './apoyo.ts'

describe('T-01 · venta de contado simple', () => {
  it('sube el efectivo y las ventas', () => {
    const l = new Libro()
    const m = l.anotar({ tipo: 'venta', monto_centavos: 25_000, fecha: '2026-07-10' })
    expect(m.estado_registro).toBe('firme')
    expect(m.medio_pago).toBe('efectivo')
    expect(m.condicion).toBe('contado')
    const v = l.vistas()
    // 1,000 de capital + 250 de la venta
    expect(v.saldo_por_medio.efectivo).toBe(125_000)
    expect(v.ventas_brutas).toBe(25_000)
    expect(v.flujo_de_caja).toBe(25_000)
    expect(v.por_cobrar).toBe(0)
  })
})

describe('T-02 · venta a crédito y cobro total', () => {
  it('me deben baja a cero y el cobro no es venta nueva', () => {
    const l = new Libro()
    const venta = l.anotar({
      tipo: 'venta', monto_centavos: 90_000, fecha: '2026-07-05', condicion: 'credito',
      tercero_id: 'memo', fecha_promesa: '2026-07-20',
    })
    expect(l.vistas({ desde: '2026-07-01', hasta: '2026-07-10' }).por_cobrar).toBe(90_000)
    l.anotar({ tipo: 'cobro', monto_centavos: 90_000, fecha: '2026-07-12', origen_id: venta.movimiento_id })
    const v = l.vistas()
    expect(v.por_cobrar).toBe(0)
    expect(v.ventas_brutas).toBe(90_000)
    expect(v.ventas_credito).toBe(90_000)
    expect(v.cobros).toBe(90_000)
    // 1,000 + 900 cobrados
    expect(v.saldo_por_medio.efectivo).toBe(190_000)
    // Entró − salió: el cobro sí cuenta, la venta a crédito no
    expect(v.flujo_de_caja).toBe(90_000)
  })

  it('exige un apodo en la venta a crédito (D-55)', () => {
    const l = new Libro()
    const r = firmar({ tipo: 'venta', monto_centavos: 1000, condicion: 'credito' }, l.ctx())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores[0].codigo).toBe('sin_tercero')
  })
})

describe('T-03 · cobro parcial', () => {
  it('deja el saldo pendiente correcto', () => {
    const l = new Libro()
    const venta = l.anotar({
      tipo: 'venta', monto_centavos: 90_000, fecha: '2026-07-05', condicion: 'credito',
      tercero_id: 'memo', fecha_promesa: '2026-08-05',
    })
    l.anotar({ tipo: 'cobro', monto_centavos: 50_000, fecha: '2026-07-12', origen_id: venta.movimiento_id })
    const v = l.vistas()
    // 900 − 500 = 400
    expect(v.por_cobrar).toBe(40_000)
    expect(v.por_cobrar_por_tercero).toEqual({ memo: 40_000 })
    expect(v.por_cobrar_vencido).toBe(0)
  })
})

describe('T-04 · crédito vencido al corte', () => {
  it('cuenta lo vencido según la fecha de promesa', () => {
    const l = new Libro()
    l.anotar({ tipo: 'venta', monto_centavos: 30_000, fecha: '2026-07-01', condicion: 'credito', tercero_id: 'a', fecha_promesa: '2026-07-10' })
    l.anotar({ tipo: 'venta', monto_centavos: 20_000, fecha: '2026-07-02', condicion: 'credito', tercero_id: 'b', fecha_promesa: '2026-08-10' })
    // Sin fecha de promesa: se propone la de la venta + 30 días = 2026-07-03 (AN-07)
    const sinPromesa = l.anotar({ tipo: 'venta', monto_centavos: 10_000, fecha: '2026-06-03', condicion: 'credito', tercero_id: 'c' })
    expect(sinPromesa.estado_registro).toBe('por_completar')
    expect(sinPromesa.pendientes).toContain('sin_fecha_promesa')
    const v = l.vistas({ desde: '2026-07-01', hasta: '2026-07-15' })
    expect(v.por_cobrar).toBe(60_000)
    // Vencidas al 15-jul: la de «a» (300) y la de «c» (100)
    expect(v.por_cobrar_vencido).toBe(40_000)
  })
})

describe('T-05 · corrección de un monto', () => {
  it('solo cuenta la versión nueva y el original queda en la historia', () => {
    const l = new Libro()
    const original = l.anotar({ tipo: 'venta', monto_centavos: 10_000, fecha: '2026-07-10' })
    const nueva = l.corregir(original.movimiento_id, { tipo: 'venta', monto_centavos: 12_000, fecha: '2026-07-10' })
    expect(nueva.operacion).toBe('correccion')
    expect(nueva.corrige_a).toBe(original.movimiento_id)
    expect(l.registro).toHaveLength(2)
    const v = l.vistas()
    expect(v.ventas_brutas).toBe(12_000)
    expect(v.saldo_por_medio.efectivo).toBe(112_000)
    // No se puede volver a corregir la versión ya sustituida
    expect(() => l.corregir(original.movimiento_id, { tipo: 'venta', monto_centavos: 1 })).toThrow()
    // Sí se puede corregir la última versión
    l.corregir(nueva.movimiento_id, { tipo: 'venta', monto_centavos: 11_000, fecha: '2026-07-10' })
    expect(l.vistas().ventas_brutas).toBe(11_000)
  })
})

describe('T-06 · anulación de una venta', () => {
  it('sale de las ventas y del efectivo, y el original se conserva', () => {
    const l = new Libro()
    const a = l.anotar({ tipo: 'venta', monto_centavos: 10_000, fecha: '2026-07-10' })
    l.anotar({ tipo: 'venta', monto_centavos: 5_000, fecha: '2026-07-10' })
    const anul = l.anular(a.movimiento_id, 'la capturé dos veces')
    expect(anul.operacion).toBe('anulacion')
    const v = l.vistas()
    expect(v.ventas_brutas).toBe(5_000)
    expect(v.saldo_por_medio.efectivo).toBe(105_000)
    expect(l.registro.find((m) => m.movimiento_id === a.movimiento_id)).toBeDefined()
    expect(() => l.anular(a.movimiento_id)).toThrow()
  })

  it('anular una venta corregida anula toda la cadena', () => {
    const l = new Libro()
    const a = l.anotar({ tipo: 'venta', monto_centavos: 10_000, fecha: '2026-07-10' })
    const b = l.corregir(a.movimiento_id, { tipo: 'venta', monto_centavos: 8_000, fecha: '2026-07-10' })
    l.anular(b.movimiento_id)
    expect(l.vistas().ventas_brutas).toBe(0)
  })
})

describe('T-07 · devolución de venta', () => {
  it('baja las ventas netas, sube la existencia y regresa el costo', () => {
    // Producto: costo 40, precio 60
    const l = new Libro([producto('gorra', 4_000, 6_000)])
    l.anotar({ tipo: 'compra', monto_centavos: 40_000, fecha: '2026-07-01', renglones: [{ producto_id: 'gorra', cantidad_milesimas: 10_000, precio_unitario_centavos: 4_000 }] })
    const venta = l.anotar({ tipo: 'venta', fecha: '2026-07-05', renglones: [{ producto_id: 'gorra', cantidad_milesimas: 3_000 }] })
    // 3 × 60 = 180, autocalculado (D-56); el costo se copió del catálogo (D-50)
    expect(venta.monto_centavos).toBe(18_000)
    expect(venta.renglones[0].costo_unitario_centavos).toBe(4_000)
    l.anotar({ tipo: 'devolucion_venta', monto_centavos: 6_000, fecha: '2026-07-06', origen_id: venta.movimiento_id, renglones: [{ producto_id: 'gorra', cantidad_milesimas: 1_000, precio_unitario_centavos: 6_000, costo_unitario_centavos: 4_000 }] })
    const v = l.vistas()
    expect(v.ventas_netas).toBe(12_000) // 180 − 60
    expect(v.existencia).toEqual({ gorra: 8_000 }) // 10 − 3 + 1
    expect(v.costo_de_lo_vendido).toBe(8_000) // 2 × 40
    expect(v.utilidad_bruta).toBe(4_000) // 120 − 80
    expect(v.margen_sobre_costo_pb).toBe(5_000) // 40 / 80 = 50 %
    // Efectivo: 1,000 − 400 + 180 − 60
    expect(v.saldo_por_medio.efectivo).toBe(72_000)
    expect(v.valor_inventario).toBe(32_000) // 8 × 40
  })

  it('con penalización: el negocio se la queda y lo reconocido baja primero la deuda (D-59)', () => {
    const l = new Libro()
    const venta = l.anotar({ tipo: 'venta', monto_centavos: 30_000, fecha: '2026-07-05', condicion: 'credito', tercero_id: 'memo', fecha_promesa: '2026-08-01' })
    l.anotar({ tipo: 'cobro', monto_centavos: 25_000, fecha: '2026-07-06', origen_id: venta.movimiento_id })
    // Debía 50; devuelve mercancía por 80 con 10 de penalización: se le reconocen 70,
    // 50 bajan la deuda y 20 se le regresan en efectivo
    const dev = l.anotar({ tipo: 'devolucion_venta', monto_centavos: 8_000, penalizacion_centavos: 1_000, fecha: '2026-07-07', origen_id: venta.movimiento_id })
    expect(dev.penalizacion_centavos).toBe(1_000)
    const v = l.vistas()
    expect(v.por_cobrar).toBe(0)
    expect(v.saldo_por_medio.efectivo).toBe(100_000 + 25_000 - 2_000)
    expect(v.devoluciones).toBe(7_000)
    expect(v.penalizaciones).toBe(1_000)
    expect(v.ventas_netas).toBe(23_000) // 300 − 70
  })

  it('la penalización no puede pasar de lo devuelto ni ir en otro tipo', () => {
    const l = new Libro()
    const venta = l.anotar({ tipo: 'venta', monto_centavos: 10_000, fecha: '2026-07-05' })
    const r1 = firmar({ tipo: 'devolucion_venta', monto_centavos: 5_000, penalizacion_centavos: 6_000, origen_id: venta.movimiento_id }, l.ctx())
    const r2 = firmar({ tipo: 'venta', monto_centavos: 5_000, penalizacion_centavos: 100 }, l.ctx())
    expect(r1.ok || r2.ok).toBe(false)
  })

  it('sin penalización, contra una venta a crédito primero baja lo que me deben', () => {
    const l = new Libro()
    const venta = l.anotar({ tipo: 'venta', monto_centavos: 30_000, fecha: '2026-07-05', condicion: 'credito', tercero_id: 'memo', fecha_promesa: '2026-08-01' })
    l.anotar({ tipo: 'cobro', monto_centavos: 25_000, fecha: '2026-07-06', origen_id: venta.movimiento_id })
    // Debía 50; devuelve mercancía por 80: 50 bajan la deuda y 30 se regresan en efectivo
    l.anotar({ tipo: 'devolucion_venta', monto_centavos: 8_000, fecha: '2026-07-07', origen_id: venta.movimiento_id })
    const v = l.vistas()
    expect(v.por_cobrar).toBe(0)
    expect(v.saldo_por_medio.efectivo).toBe(100_000 + 25_000 - 3_000)
    expect(v.ventas_netas).toBe(22_000)
  })
})

describe('T-08 · producto sin costo', () => {
  it('entra a «Me deja» con costo 0 (D-58) y avisa el porcentaje sin costo', () => {
    const l = new Libro([producto('con', 1_000, 2_000), producto('sin', undefined, 5_000)])
    l.anotar({ tipo: 'venta', fecha: '2026-07-05', renglones: [{ producto_id: 'con', cantidad_milesimas: 3_000 }] }) // 60, costo 30
    const sin = l.anotar({ tipo: 'venta', fecha: '2026-07-05', renglones: [{ producto_id: 'sin', cantidad_milesimas: 2_000 }] }) // 100
    l.anotar({ tipo: 'venta', monto_centavos: 4_000, fecha: '2026-07-05' }) // 40, sin renglones
    expect(sin.pendientes).toContain('sin_costo')
    const v = l.vistas()
    expect(v.ventas_brutas).toBe(20_000)
    expect(v.ventas_netas_con_costo).toBe(6_000)
    expect(v.costo_de_lo_vendido).toBe(3_000)
    // 200 vendidos − 30 de costo (lo sin costo vale 0)
    expect(v.utilidad_bruta).toBe(17_000)
    expect(v.ventas_sin_costo_pb).toBe(7_000) // 140 de 200 = 70 %
  })
})

describe('T-09 · movimiento por confirmar', () => {
  it('no cuenta en saldos hasta confirmarse', () => {
    const l = new Libro()
    const m = l.anotar({ tipo: 'gasto', monto_centavos: 20_000, categoria_gasto: 'transporte', fecha: '2026-07-05', por_confirmar: true })
    expect(m.estado_registro).toBe('por_confirmar')
    let v = l.vistas()
    expect(v.gastos).toBe(0)
    expect(v.saldo_por_medio.efectivo).toBe(100_000)
    expect(v.movimientos_por_confirmar).toBe(1)
    // Confirmar = corregir con el mismo contenido ya firme
    l.corregir(m.movimiento_id, { tipo: 'gasto', monto_centavos: 20_000, categoria_gasto: 'transporte', fecha: '2026-07-05' })
    v = l.vistas()
    expect(v.gastos).toBe(20_000)
    expect(v.saldo_por_medio.efectivo).toBe(80_000)
  })
})

describe('T-10 · movimiento por completar', () => {
  it('sí cuenta, con marca de advertencia', () => {
    const l = new Libro()
    const m = l.anotar({ tipo: 'gasto', monto_centavos: 15_000, fecha: '2026-07-05' })
    expect(m.estado_registro).toBe('por_completar')
    expect(m.pendientes).toEqual(['sin_categoria'])
    const v = l.vistas()
    expect(v.gastos).toBe(15_000)
    expect(v.gastos_por_categoria).toEqual({ sin_categoria: 15_000 })
    expect(v.movimientos_por_completar).toBe(1)
    expect(v.pendientes).toEqual({ sin_categoria: 1 })
  })
})

describe('T-11 · renglones que no cuadran con el monto', () => {
  it('marca monto_no_cuadra y gana el monto', () => {
    const l = new Libro([producto('taza', 2_000, 5_000)])
    const m = l.anotar({ tipo: 'venta', monto_centavos: 12_000, fecha: '2026-07-05', renglones: [{ producto_id: 'taza', cantidad_milesimas: 2_000 }] })
    expect(m.pendientes).toContain('monto_no_cuadra')
    const v = l.vistas()
    expect(v.ventas_brutas).toBe(12_000) // no 100
    expect(v.costo_de_lo_vendido).toBe(4_000)
    expect(v.utilidad_bruta).toBe(8_000)
  })
})

describe('T-14 · fecha futura', () => {
  it('rechaza más de un día en el futuro y acepta mañana', () => {
    const l = new Libro([], '2026-07-15')
    const r = firmar({ tipo: 'venta', monto_centavos: 100, fecha: '2026-07-17' }, l.ctx())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores[0].codigo).toBe('AN-01')
    expect(firmar({ tipo: 'venta', monto_centavos: 100, fecha: '2026-07-16' }, l.ctx()).ok).toBe(true)
  })
  // La parte de «periodo cerrado» (AN-02) llega con los cierres en la PoC-2.
})

describe('T-17 · cantidades con decimales', () => {
  it('lleva existencias y costo de ventas sin errores de redondeo', () => {
    // Jitomate: costo 18.50/kg, precio 32.00/kg
    const l = new Libro([producto('jitomate', 1_850, 3_200, 'kilo')])
    l.anotar({ tipo: 'compra', monto_centavos: 18_500, fecha: '2026-07-01', renglones: [{ producto_id: 'jitomate', cantidad_milesimas: 10_000, precio_unitario_centavos: 1_850 }] })
    const v1 = l.anotar({ tipo: 'venta', fecha: '2026-07-02', renglones: [{ producto_id: 'jitomate', cantidad_milesimas: 1_250 }] })
    const v2 = l.anotar({ tipo: 'venta', fecha: '2026-07-02', renglones: [{ producto_id: 'jitomate', cantidad_milesimas: 2_750 }] })
    const v3 = l.anotar({ tipo: 'venta', fecha: '2026-07-02', renglones: [{ producto_id: 'jitomate', cantidad_milesimas: 335 }] })
    // 1.25 × 32 = 40.00 · 2.75 × 32 = 88.00 · 0.335 × 32 = 10.72 → 10.70 (múltiplo de 5 centavos, D-52)
    expect([v1.monto_centavos, v2.monto_centavos, v3.monto_centavos]).toEqual([4_000, 8_800, 1_070])
    l.anotar({ tipo: 'ajuste_existencia', monto_centavos: 0, concepto: 'merma', fecha: '2026-07-03', renglones: [{ producto_id: 'jitomate', cantidad_milesimas: -500 }] })
    const v = l.vistas()
    // 10 − 1.25 − 2.75 − 0.335 − 0.5 = 5.165 kg
    expect(v.existencia).toEqual({ jitomate: 5_165 })
    // Costo: 1.25 × 18.50 = 23.125 → 23.13 · 2.75 × 18.50 = 50.875 → 50.88 · 0.335 × 18.50 = 6.1975 → 6.20
    expect(v.costo_de_lo_vendido).toBe(2_313 + 5_088 + 620)
    // 5.165 × 18.50 = 95.5525 → 95.55
    expect(v.valor_inventario).toBe(9_555)
    expect(v.ventas_brutas).toBe(13_870)
  })
})

describe('Capital inicial', () => {
  it('no cuenta antes del inicio de operaciones', () => {
    const l = new Libro()
    const v = l.vistas({ desde: '2026-06-01', hasta: '2026-06-30' }, { ...NEGOCIO, inicio_operaciones: '2026-07-01' })
    expect(v.saldo_total).toBe(0)
  })
})
