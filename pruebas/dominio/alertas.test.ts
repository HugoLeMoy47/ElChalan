// Detector de alertas (CH-04 §12) con casos armados a mano, y T-22 (decisiones).

import { describe, expect, it } from 'vitest'
import {
  alertasAbiertas, cambiosDeCosto, detectarAlertas, type DecisionAlerta, type Entorno,
} from '../../src/dominio/index.ts'
import { Libro, NEGOCIO, producto } from './apoyo.ts'

const ENTORNO: Entorno = { hoy: '2026-07-31', ultimo_respaldo: '2026-07-30' }

function codigos(l: Libro, entorno: Entorno = ENTORNO) {
  return detectarAlertas(l.registro, NEGOCIO, l.productos, entorno).map((a) => a.codigo)
}

describe('alertas de cada movimiento', () => {
  it('AN-03 · monto mucho mayor que la mediana de 30 días', () => {
    const l = new Libro()
    for (const d of ['01', '02', '03', '04', '05']) l.anotar({ tipo: 'gasto', monto_centavos: 30_000, categoria_gasto: 'transporte', fecha: `2026-07-${d}` })
    l.anotar({ tipo: 'gasto', monto_centavos: 300_000, categoria_gasto: 'transporte', fecha: '2026-07-06' }) // 10× no basta
    expect(codigos(l)).not.toContain('AN-03')
    const raro = l.anotar({ tipo: 'gasto', monto_centavos: 400_000, categoria_gasto: 'transporte', fecha: '2026-07-07' })
    const a = detectarAlertas(l.registro, NEGOCIO, [], ENTORNO).find((x) => x.codigo === 'AN-03')
    expect(a?.objeto_id).toBe(raro.movimiento_id)
  })

  it('AN-04 · la misma venta dos veces seguidas, con segundos de diferencia', () => {
    const l = new Libro()
    l.anotar({ tipo: 'venta', monto_centavos: 5_000, fecha: '2026-07-10' })
    const dup = l.anotar({ tipo: 'venta', monto_centavos: 5_000, fecha: '2026-07-10' })
    expect(detectarAlertas(l.registro, NEGOCIO, [], ENTORNO).filter((a) => a.codigo === 'AN-04').map((a) => a.objeto_id)).toEqual([dup.movimiento_id])
    // Si el duplicado se anula, la alerta desaparece
    l.anular(dup.movimiento_id)
    expect(codigos(l)).not.toContain('AN-04')
  })

  it('AN-04 · no avisa si pasó tiempo entre una y otra (dos clientes compraron lo mismo)', () => {
    const l = new Libro()
    l.anotar({ tipo: 'venta', monto_centavos: 5_000, fecha: '2026-07-10' })
    const segunda = l.anotar({ tipo: 'venta', monto_centavos: 5_000, fecha: '2026-07-10' })
    segunda.creado_en = '2026-07-10T18:05:00Z'
    l.registro[0].creado_en = '2026-07-10T18:00:00Z'
    expect(codigos(l)).not.toContain('AN-04')
  })

  it('AN-05 a AN-08 · lo que falta', () => {
    const l = new Libro([producto('sin')])
    l.anotar({ tipo: 'gasto', monto_centavos: 1_000, fecha: '2026-07-10' })
    l.anotar({ tipo: 'venta', fecha: '2026-07-10', renglones: [{ producto_id: 'sin', cantidad_milesimas: 1_000, precio_unitario_centavos: 2_000 }] })
    l.anotar({ tipo: 'venta', monto_centavos: 1_000, fecha: '2026-07-10', condicion: 'credito', tercero_id: 'memo' })
    l.anotar({ tipo: 'venta', monto_centavos: 1_500, fecha: '2026-07-11', renglones: [{ descripcion: 'varios', cantidad_milesimas: 1_000, precio_unitario_centavos: 1_000 }] })
    expect(codigos(l).sort()).toEqual(['AN-05', 'AN-06', 'AN-07', 'AN-08', 'AN-11'])
  })

  it('AN-09 y AN-10 · cobro de más y devolución de más', () => {
    const l = new Libro([producto('gorra', 4_000, 6_000)])
    const credito = l.anotar({ tipo: 'venta', fecha: '2026-07-05', condicion: 'credito', tercero_id: 'memo', fecha_promesa: '2026-07-30', renglones: [{ producto_id: 'gorra', cantidad_milesimas: 2_000 }] })
    l.anotar({ tipo: 'cobro', monto_centavos: 10_000, fecha: '2026-07-06', origen_id: credito.movimiento_id })
    const deMas = l.anotar({ tipo: 'cobro', monto_centavos: 5_000, fecha: '2026-07-07', origen_id: credito.movimiento_id })
    const contado = l.anotar({ tipo: 'venta', fecha: '2026-07-08', renglones: [{ producto_id: 'gorra', cantidad_milesimas: 1_000 }] })
    const dev = l.anotar({ tipo: 'devolucion_venta', monto_centavos: 12_000, fecha: '2026-07-09', origen_id: contado.movimiento_id, renglones: [{ producto_id: 'gorra', cantidad_milesimas: 2_000, precio_unitario_centavos: 6_000 }] })
    const a = detectarAlertas(l.registro, NEGOCIO, l.productos, ENTORNO)
    expect(a.find((x) => x.codigo === 'AN-09')?.objeto_id).toBe(deMas.movimiento_id)
    expect(a.find((x) => x.codigo === 'AN-10')?.objeto_id).toBe(dev.movimiento_id)
  })

  it('AN-14 · venta bajo el costo', () => {
    const l = new Libro([producto('termo', 10_000, 15_000)])
    l.anotar({ tipo: 'venta', fecha: '2026-07-08', renglones: [{ producto_id: 'termo', cantidad_milesimas: 1_000, precio_unitario_centavos: 9_000 }] })
    expect(codigos(l)).toContain('AN-14')
  })

  it('AN-16 · el reloj del teléfono retrocede más de un día', () => {
    const l = new Libro()
    l.anotar({ tipo: 'venta', monto_centavos: 1_000, fecha: '2026-07-10' })
    const atrasada = l.anotar({ tipo: 'venta', monto_centavos: 2_000, fecha: '2026-07-10' })
    atrasada.creado_en = '2026-07-08T10:00:00Z'
    expect(codigos(l)).toContain('AN-16')
  })
})

describe('alertas del estado y del entorno', () => {
  it('AN-11 y AN-12 · existencia y efectivo debajo de cero', () => {
    const l = new Libro([producto('gorra', 4_000, 6_000)])
    l.anotar({ tipo: 'venta', fecha: '2026-07-08', renglones: [{ producto_id: 'gorra', cantidad_milesimas: 1_000 }] })
    l.anotar({ tipo: 'gasto', monto_centavos: 200_000, categoria_gasto: 'renta', fecha: '2026-07-09' })
    const a = detectarAlertas(l.registro, NEGOCIO, l.productos, ENTORNO)
    expect(a.find((x) => x.codigo === 'AN-11')?.objeto_id).toBe('gorra')
    expect(a.find((x) => x.codigo === 'AN-12')?.objeto_id).toBe('neg-1:efectivo')
  })

  it('AN-13 · sacó más de lo que ganó en el mes', () => {
    const l = new Libro()
    l.anotar({ tipo: 'venta', monto_centavos: 10_000, fecha: '2026-07-08' })
    l.anotar({ tipo: 'retiro', monto_centavos: 20_000, fecha: '2026-07-09' })
    expect(codigos(l)).toContain('AN-13')
  })

  it('AN-17 · sin respaldo o respaldo de más de 7 días (D-46)', () => {
    const l = new Libro()
    expect(codigos(l, { hoy: '2026-07-31' })).toContain('AN-17')
    expect(codigos(l, { hoy: '2026-07-31', ultimo_respaldo: '2026-07-24' })).not.toContain('AN-17')
    expect(codigos(l, { hoy: '2026-07-31', ultimo_respaldo: '2026-07-23' })).toContain('AN-17')
  })

  it('AN-18 · almacenamiento no persistente o casi lleno', () => {
    const l = new Libro()
    expect(codigos(l, { ...ENTORNO, almacenamiento: { persistente: true, uso_pct: 40 } })).not.toContain('AN-18')
    expect(codigos(l, { ...ENTORNO, almacenamiento: { persistente: false } })).toContain('AN-18')
    expect(codigos(l, { ...ENTORNO, almacenamiento: { persistente: true, uso_pct: 95 } })).toContain('AN-18')
  })

  it('ordena por severidad: avisos antes que informativas', () => {
    const l = new Libro()
    l.anotar({ tipo: 'gasto', monto_centavos: 1_000, fecha: '2026-07-10' }) // AN-05 informativa
    const a = detectarAlertas(l.registro, NEGOCIO, [], { hoy: '2026-07-31' }) // + AN-17 aviso
    expect(a.map((x) => x.severidad)).toEqual(['aviso', 'informativa'])
  })
})

describe('AN-20 · al comprar, el costo cambió', () => {
  it('lista los productos con costo distinto al del catálogo', () => {
    const productos = [producto('gorra', 4_000), producto('termo', 10_000), producto('nuevo')]
    const cambios = cambiosDeCosto({
      renglones: [
        { renglon_id: 'r1', movimiento_id: 'm', producto_id: 'gorra', cantidad_milesimas: 5_000, unidad_medida: 'pieza', precio_unitario_centavos: 4_600, importe_centavos: 23_000 },
        { renglon_id: 'r2', movimiento_id: 'm', producto_id: 'termo', cantidad_milesimas: 1_000, unidad_medida: 'pieza', precio_unitario_centavos: 10_000, importe_centavos: 10_000 },
        { renglon_id: 'r3', movimiento_id: 'm', producto_id: 'nuevo', cantidad_milesimas: 1_000, unidad_medida: 'pieza', precio_unitario_centavos: 2_000, importe_centavos: 2_000 },
      ],
    }, productos)
    expect(cambios).toEqual([{ producto_id: 'gorra', costo_catalogo: 4_000, costo_compra: 4_600 }])
  })
})

describe('T-22 · decisión ante una alerta', () => {
  function decision(objeto_id: string, d: DecisionAlerta['decision'], hasta?: string): DecisionAlerta {
    return { decision_id: `d-${objeto_id}-${d}`, negocio_id: 'neg-1', codigo: 'AN-05', objeto_id, decision: d, hasta, creado_en: '2026-07-31T12:00:00Z' }
  }

  it('«está bien así» la quita y no reaparece mientras el movimiento no cambie', () => {
    const l = new Libro()
    const gasto = l.anotar({ tipo: 'gasto', monto_centavos: 1_000, fecha: '2026-07-10' })
    const alertas = detectarAlertas(l.registro, NEGOCIO, [], ENTORNO)
    const decisiones = [decision(gasto.movimiento_id, 'aceptada')]
    expect(alertasAbiertas(alertas, decisiones, '2026-07-31')).toEqual([])
    // Si se corrige (sigue sin categoría), es otro movimiento y la alerta vuelve
    l.corregir(gasto.movimiento_id, { tipo: 'gasto', monto_centavos: 1_200, fecha: '2026-07-10' })
    const despues = alertasAbiertas(detectarAlertas(l.registro, NEGOCIO, [], ENTORNO), decisiones, '2026-07-31')
    expect(despues.map((a) => a.codigo)).toEqual(['AN-05'])
  })

  it('«después» la esconde hasta la fecha indicada', () => {
    const l = new Libro()
    const gasto = l.anotar({ tipo: 'gasto', monto_centavos: 1_000, fecha: '2026-07-10' })
    const alertas = detectarAlertas(l.registro, NEGOCIO, [], ENTORNO)
    const decisiones = [decision(gasto.movimiento_id, 'pospuesta', '2026-08-03')]
    expect(alertasAbiertas(alertas, decisiones, '2026-08-02')).toEqual([])
    expect(alertasAbiertas(alertas, decisiones, '2026-08-03')).toHaveLength(1)
  })

  it('cuenta la última decisión sobre la misma alerta', () => {
    const l = new Libro()
    const gasto = l.anotar({ tipo: 'gasto', monto_centavos: 1_000, fecha: '2026-07-10' })
    const alertas = detectarAlertas(l.registro, NEGOCIO, [], ENTORNO)
    const decisiones = [decision(gasto.movimiento_id, 'pospuesta', '2026-08-03'), decision(gasto.movimiento_id, 'atendida')]
    expect(alertasAbiertas(alertas, decisiones, '2026-09-01')).toEqual([])
  })
})
