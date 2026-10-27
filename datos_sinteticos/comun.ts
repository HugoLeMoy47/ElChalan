// Piezas comunes del generador de datos sintéticos (CH-08 §9).
//
// Regla de independencia (CH-08 §7): este código NO importa la lógica del dominio
// (solo sus tipos). Mientras genera, lleva su propio «libro de intenciones» con el
// efecto final de cada hecho, y de ahí sale la verdad de terreno.

import type {
  CategoriaGasto, Condicion, Fecha, FechaHora, MedioPago, Movimiento, Negocio, Pendiente,
  Producto, Renglon, Sentido, Tercero, TipoMovimiento, Uuid,
} from '../src/dominio/tipos.ts'

// ── Azar determinista ─────────────────────────────────────────────────────

export class Azar {
  private estado: number
  constructor(semilla: number) {
    this.estado = semilla >>> 0
  }
  /** mulberry32: [0, 1) */
  siguiente(): number {
    this.estado = (this.estado + 0x6d2b79f5) >>> 0
    let t = this.estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  entero(min: number, max: number): number {
    return min + Math.floor(this.siguiente() * (max - min + 1))
  }
  probabilidad(p: number): boolean {
    return this.siguiente() < p
  }
  elegir<T>(lista: readonly T[]): T {
    return lista[Math.floor(this.siguiente() * lista.length)]
  }
  elegirPesado<T>(lista: readonly T[], pesos: readonly number[]): T {
    const total = pesos.reduce((s, x) => s + x, 0)
    let x = this.siguiente() * total
    for (let i = 0; i < lista.length; i++) {
      x -= pesos[i]
      if (x < 0) return lista[i]
    }
    return lista[lista.length - 1]
  }
  hex(digitos: number): string {
    let s = ''
    for (let i = 0; i < digitos; i++) s += Math.floor(this.siguiente() * 16).toString(16)
    return s
  }
}

/** UUID versión 7 con la hora sintética y bits del azar determinista. */
export function uuidv7(ms: number, azar: Azar): Uuid {
  const t = ms.toString(16).padStart(12, '0')
  const variante = (8 + azar.entero(0, 3)).toString(16)
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-7${azar.hex(3)}-${variante}${azar.hex(3)}-${azar.hex(12)}`
}

// ── Fechas (copia mínima, para no depender del dominio) ───────────────────

const DIA = 86_400_000
export const ms = (f: Fecha) => Date.parse(`${f}T00:00:00Z`)
export const fecha = (t: number): Fecha => new Date(t).toISOString().slice(0, 10)
export const masDias = (f: Fecha, d: number) => fecha(ms(f) + d * DIA)
/** 0 = lunes … 6 = domingo */
export const diaSemana = (f: Fecha) => (new Date(ms(f)).getUTCDay() + 6) % 7

// ── Redondeos (convención de D-52, escrita aparte) ────────────────────────

/** Costo de una cantidad: milésimas × centavos ÷ 1000, mitad hacia arriba. */
export const costoLinea = (milesimas: number, costo: number) => Math.round((milesimas * costo) / 1000)
/** Importe: al centavo con cantidades enteras; múltiplos de 5 centavos con fracción. */
export function importeLinea(milesimas: number, precio: number): number {
  const c = Math.round((milesimas * precio) / 1000)
  return milesimas % 1000 === 0 ? c : Math.round(c / 5) * 5
}

// ── El libro de intenciones ───────────────────────────────────────────────

/** Efecto final de un hecho vigente, tal como el generador lo quiso. */
export interface Efecto {
  orden: number
  fecha: Fecha
  tipo: TipoMovimiento
  monto: number
  medio: MedioPago
  condicion?: Condicion
  tercero?: Uuid
  promesa?: Fecha
  /** Raíz de la venta a la que se aplica un cobro o una devolución. */
  aplicaA?: Uuid
  categoria?: CategoriaGasto
  sentido?: Sentido
  /** Venta con costo: costo de lo vendido. Devolución: costo devuelto. `null` = sin costo. */
  costo: number | null
  /** Si `costo` es null: lo que sí tiene costo (lo demás vale 0, D-58). */
  costoConocido?: number
  existencia: Record<Uuid, number>
  pendientes: Pendiente[]
}

export interface AlertaEsperada {
  codigo: string
  objeto_id: Uuid
  nota?: string
}

export interface IntentoRechazado {
  codigo: string
  tipo: TipoMovimiento
  fecha: Fecha
  monto_centavos: number
  hoy: Fecha
}

export interface DatosAlta {
  tipo: TipoMovimiento
  fecha: Fecha
  monto: number
  medio?: MedioPago
  condicion?: Condicion
  tercero?: Uuid
  promesa?: Fecha
  origen?: Uuid
  categoria?: CategoriaGasto
  concepto?: string
  sentido?: Sentido
  renglones?: Omit<Renglon, 'renglon_id' | 'movimiento_id'>[]
  pendientes?: Pendiente[]
  /** Efecto que el generador quiere (lo que la verdad de terreno contará). */
  efecto: Omit<Efecto, 'orden' | 'fecha' | 'tipo' | 'monto' | 'medio' | 'pendientes'>
}

export class Generador {
  readonly azar: Azar
  readonly registro: Movimiento[] = []
  readonly productos: Producto[] = []
  readonly terceros: Tercero[] = []
  readonly alertas: AlertaEsperada[] = []
  readonly rechazados: IntentoRechazado[] = []
  /** raíz → efecto vigente */
  readonly libro = new Map<Uuid, Efecto>()
  /** raíz → id de la última versión */
  readonly ultima = new Map<Uuid, Uuid>()
  readonly negocio: Negocio
  private reloj = 0
  private orden = 0

  constructor(semilla: number, negocio: Omit<Negocio, 'negocio_id' | 'dispositivo_id' | 'creado_en'>, inicio: Fecha) {
    this.azar = new Azar(semilla)
    this.reloj = ms(inicio) + 14 * 3_600_000
    const creado = new Date(this.reloj).toISOString()
    this.dispositivo = uuidv7(this.reloj, this.azar)
    this.negocio = {
      ...negocio,
      negocio_id: uuidv7(this.reloj, this.azar),
      dispositivo_id: this.dispositivo,
      creado_en: creado,
    }
  }
  readonly dispositivo: Uuid

  /** Avanza el reloj de captura a una hora del día del hecho (hora de México = UTC−6). */
  horaDeCaptura(dia: Fecha, minDesdeLas9: number): void {
    const t = ms(dia) + (15 * 60 + minDesdeLas9) * 60_000
    this.reloj = Math.max(this.reloj + 1000, t)
  }

  private sello(): { ms: number; iso: FechaHora } {
    this.reloj += this.azar.entero(20, 240) * 1000
    return { ms: this.reloj, iso: new Date(this.reloj).toISOString() }
  }

  nuevoProducto(p: Omit<Producto, 'producto_id' | 'negocio_id' | 'creado_en' | 'dispositivo_id' | 'activo'>): Producto {
    const s = this.sello()
    const prod: Producto = {
      producto_id: uuidv7(s.ms, this.azar), negocio_id: this.negocio.negocio_id,
      ...p, activo: true, creado_en: s.iso, dispositivo_id: this.dispositivo,
    }
    this.productos.push(prod)
    return prod
  }

  nuevoTercero(nombre: string, rol: Tercero['rol']): Tercero {
    const s = this.sello()
    const t: Tercero = {
      tercero_id: uuidv7(s.ms, this.azar), negocio_id: this.negocio.negocio_id, nombre, rol,
      activo: true, creado_en: s.iso, dispositivo_id: this.dispositivo,
    }
    this.terceros.push(t)
    return t
  }

  private construir(d: DatosAlta, extra: Partial<Movimiento>, relojAtrasado = false): Movimiento {
    const s = this.sello()
    let creado = s.iso
    if (relojAtrasado) creado = new Date(s.ms - 2 * DIA - 3_600_000).toISOString()
    const id = uuidv7(s.ms, this.azar)
    const pendientes = d.pendientes ?? []
    const m: Movimiento = {
      movimiento_id: id,
      negocio_id: this.negocio.negocio_id,
      operacion: 'alta',
      tipo: d.tipo,
      fecha: d.fecha,
      monto_centavos: d.monto,
      medio_pago: d.medio ?? 'efectivo',
      estado_registro: pendientes.length ? 'por_completar' : 'firme',
      pendientes,
      origen_captura: 'ejemplo',
      creado_en: creado,
      dispositivo_id: this.dispositivo,
      confirmado_en: creado,
      renglones: (d.renglones ?? []).map((r) => ({ renglon_id: uuidv7(s.ms, this.azar), movimiento_id: id, ...r })),
      ...extra,
    }
    if (d.tipo === 'venta') m.condicion = d.condicion ?? 'contado'
    if (d.promesa) m.fecha_promesa = d.promesa
    if (d.origen) m.origen_id = d.origen
    if (d.tercero) m.tercero_id = d.tercero
    if (d.categoria) m.categoria_gasto = d.categoria
    if (d.concepto) m.concepto = d.concepto
    if (d.sentido) m.sentido = d.sentido
    return m
  }

  private efecto(d: DatosAlta): Efecto {
    return {
      ...d.efecto, orden: this.orden++, fecha: d.fecha, tipo: d.tipo, monto: d.monto,
      medio: d.medio ?? 'efectivo', pendientes: d.pendientes ?? [],
    }
  }

  /** Anota un alta. Devuelve el movimiento (su id es la raíz). */
  alta(d: DatosAlta, opciones: { relojAtrasado?: boolean } = {}): Movimiento {
    const m = this.construir(d, {}, opciones.relojAtrasado)
    this.registro.push(m)
    this.libro.set(m.movimiento_id, this.efecto(d))
    this.ultima.set(m.movimiento_id, m.movimiento_id)
    return m
  }

  /** Corrige la última versión de `raiz`; el efecto nuevo sustituye al anterior. */
  corregir(raiz: Uuid, d: DatosAlta): Movimiento {
    const m = this.construir(d, { operacion: 'correccion', corrige_a: this.ultima.get(raiz)! })
    this.registro.push(m)
    this.libro.set(raiz, { ...this.efecto(d), orden: this.libro.get(raiz)!.orden })
    this.ultima.set(raiz, m.movimiento_id)
    return m
  }

  /** Anula la última versión de `raiz`; su efecto desaparece. */
  anular(raiz: Uuid, motivo: string): Movimiento {
    const objetivo = this.registro.find((m) => m.movimiento_id === this.ultima.get(raiz))!
    const s = this.sello()
    const m: Movimiento = {
      ...objetivo, movimiento_id: uuidv7(s.ms, this.azar), operacion: 'anulacion',
      corrige_a: objetivo.movimiento_id, creado_en: s.iso, confirmado_en: s.iso, notas: motivo, renglones: [],
    }
    this.registro.push(m)
    this.libro.delete(raiz)
    this.ultima.set(raiz, m.movimiento_id)
    return m
  }

  alerta(codigo: string, objeto_id: Uuid, nota?: string): void {
    this.alertas.push(nota ? { codigo, objeto_id, nota } : { codigo, objeto_id })
  }
}
