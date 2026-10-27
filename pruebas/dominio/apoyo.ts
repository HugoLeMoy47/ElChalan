// Apoyo para las pruebas: un negocio de prueba con ids legibles y un registro en memoria.

import {
  anular, corregir, firmar, resolverVersiones, calcularVistas,
  type Contexto, type DatosMovimiento, type Movimiento, type Negocio, type Periodo, type Producto,
} from '../../src/dominio/index.ts'

export const NEGOCIO: Negocio = {
  negocio_id: 'neg-1',
  nombre: 'Prueba',
  nivel: 1,
  moneda: 'MXN',
  zona_horaria: 'America/Mexico_City',
  capital_inicial_centavos: 100_000, // $1,000
  creado_en: '2026-07-01T12:00:00Z',
  dispositivo_id: 'disp-1',
}

export function producto(id: string, costo?: number, precio?: number, unidad = 'pieza'): Producto {
  const p: Producto = {
    producto_id: id, negocio_id: 'neg-1', nombre: id, unidad_medida: unidad,
    etiquetas: [], activo: true, creado_en: '2026-07-01T12:00:00Z', dispositivo_id: 'disp-1',
  }
  if (costo !== undefined) p.costo_centavos = costo
  if (precio !== undefined) p.precio_venta_centavos = precio
  return p
}

export class Libro {
  registro: Movimiento[] = []
  private n = 0
  productos: Producto[]
  hoy: string
  constructor(productos: Producto[] = [], hoy = '2026-07-15') {
    this.productos = productos
    this.hoy = hoy
  }

  ctx(): Contexto {
    return {
      negocio_id: 'neg-1',
      dispositivo_id: 'disp-1',
      hoy: this.hoy,
      ahora: `${this.hoy}T18:00:00Z`,
      nuevoId: () => `id-${String(++this.n).padStart(4, '0')}`,
      productos: new Map(this.productos.map((p) => [p.producto_id, p])),
    }
  }

  private guardar(r: ReturnType<typeof firmar>): Movimiento {
    if (!r.ok) throw new Error(r.errores.map((e) => e.mensaje).join(' '))
    this.registro.push(r.movimiento)
    return r.movimiento
  }

  anotar(datos: DatosMovimiento): Movimiento {
    return this.guardar(firmar(datos, this.ctx()))
  }

  corregir(id: string, datos: DatosMovimiento): Movimiento {
    return this.guardar(corregir(resolverVersiones(this.registro), id, datos, this.ctx()))
  }

  anular(id: string, motivo?: string): Movimiento {
    return this.guardar(anular(resolverVersiones(this.registro), id, this.ctx(), motivo))
  }

  vistas(periodo: Periodo = { desde: '2026-07-01', hasta: '2026-07-31' }, negocio = NEGOCIO) {
    return calcularVistas(this.registro, negocio, this.productos, periodo)
  }
}
