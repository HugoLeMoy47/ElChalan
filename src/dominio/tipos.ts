// Tipos del modelo de datos N1 (CH-04 §4 a §6).
// Nombres internos en español y snake_case (D-16). Sin lógica: los usan el
// dominio, el almacén y el generador de datos sintéticos.

export type Uuid = string

/** Dinero en centavos enteros (D-52). Nunca decimales de coma flotante. */
export type Centavos = number

/** Cantidad en milésimas enteras: 1.25 kg = 1250 (decimal 12,3 de CH-04 §5.6). */
export type Milesimas = number

/** Fecha del hecho, `AAAA-MM-DD`, en la zona del negocio. */
export type Fecha = string

/** Fecha y hora UTC en ISO 8601. */
export type FechaHora = string

// ── Catálogos cerrados (CH-04 §6) ──────────────────────────────────────────

export type TipoMovimiento =
  | 'venta'
  | 'cobro'
  | 'aportacion'
  | 'otro_ingreso'
  | 'compra'
  | 'gasto'
  | 'retiro'
  | 'devolucion_venta'
  | 'ajuste_existencia'
  | 'ajuste_efectivo'

export const TIPOS_MOVIMIENTO: readonly TipoMovimiento[] = [
  'venta', 'cobro', 'aportacion', 'otro_ingreso', 'compra',
  'gasto', 'retiro', 'devolucion_venta', 'ajuste_existencia', 'ajuste_efectivo',
]

export type Operacion = 'alta' | 'correccion' | 'anulacion'

export type MedioPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'otro'

export const MEDIOS_PAGO: readonly MedioPago[] = ['efectivo', 'transferencia', 'tarjeta', 'otro']

export type Sentido = 'entra' | 'sale'

export type Condicion = 'contado' | 'credito'

export type CategoriaGasto =
  | 'renta'
  | 'servicios'
  | 'transporte'
  | 'publicidad'
  | 'comisiones'
  | 'sueldos'
  | 'empaque'
  | 'otros'

export const CATEGORIAS_GASTO: readonly CategoriaGasto[] = [
  'renta', 'servicios', 'transporte', 'publicidad', 'comisiones', 'sueldos', 'empaque', 'otros',
]

export type EstadoRegistro = 'firme' | 'por_confirmar' | 'por_completar'

export type Pendiente =
  | 'sin_tercero'
  | 'sin_producto'
  | 'sin_costo'
  | 'sin_categoria'
  | 'sin_fecha_promesa'
  | 'monto_no_cuadra'
  | 'sin_medio_pago'

/** En la PoC solo se usan `manual` y `ejemplo`; el resto se reserva (D-29 a D-32, D-57). */
export type OrigenCaptura =
  | 'manual'
  | 'ejemplo'
  | 'excel'
  | 'voz'
  | 'foto'
  | 'compartir'
  | 'texto'
  | 'whatsapp'

// ── Capa de cuenta (CH-04 §4) ──────────────────────────────────────────────

export interface Persona {
  persona_id: Uuid
  correo?: string
  nombre?: string
  proveedor_identidad: 'local' | 'google'
  vinculada_en?: FechaHora
  bloqueo_activo: boolean
  creada_en: FechaHora
}

export interface Membresia {
  persona_id: Uuid
  negocio_id: Uuid
  rol: 'propietario'
  desde: Fecha
}

// ── Entidades del negocio (CH-04 §5) ───────────────────────────────────────

export interface Negocio {
  negocio_id: Uuid
  nombre: string
  giro?: string
  nivel: 1
  moneda: 'MXN'
  zona_horaria: string
  inicio_operaciones?: Fecha
  capital_inicial_centavos?: Centavos
  segmento_por_omision?: 'menudeo' | 'mayoreo'
  creado_en: FechaHora
  dispositivo_id: Uuid
}

export interface Tercero {
  tercero_id: Uuid
  negocio_id: Uuid
  nombre: string
  rol: 'cliente' | 'proveedor'
  telefono?: string
  notas?: string
  activo: boolean
  creado_en: FechaHora
  dispositivo_id: Uuid
}

export interface Producto {
  producto_id: Uuid
  negocio_id: Uuid
  clave?: string
  nombre: string
  categoria?: string
  variante?: string
  unidad_medida: string
  precio_venta_centavos?: Centavos
  precio_referencia_centavos?: Centavos
  /** Costo unitario vigente del catálogo; se actualiza al comprar (D-50, D-53). */
  costo_centavos?: Centavos
  etiquetas: string[]
  activo: boolean
  creado_en: FechaHora
  dispositivo_id: Uuid
}

export interface Renglon {
  renglon_id: Uuid
  movimiento_id: Uuid
  producto_id?: Uuid
  descripcion?: string
  /** Con signo solo en `ajuste_existencia`; positiva en los demás tipos. */
  cantidad_milesimas: Milesimas
  unidad_medida: string
  precio_unitario_centavos?: Centavos
  /** Copia del costo del catálogo al vender (D-50). */
  costo_unitario_centavos?: Centavos
  descuento_pct?: number
  importe_centavos: Centavos
}

export interface Movimiento {
  movimiento_id: Uuid
  negocio_id: Uuid
  operacion: Operacion
  corrige_a?: Uuid
  tipo: TipoMovimiento
  fecha: Fecha
  /** Siempre positivo; el signo lo da el tipo (o `sentido` en ajuste_efectivo). */
  monto_centavos: Centavos
  medio_pago: MedioPago
  sentido?: Sentido
  condicion?: Condicion
  fecha_promesa?: Fecha
  origen_id?: Uuid
  /**
   * Solo en devolucion_venta: lo que el negocio se queda de lo devuelto (D-59).
   * `monto_centavos` es el valor de la mercancía devuelta; al cliente se le reconoce
   * `monto_centavos − penalizacion_centavos`.
   */
  penalizacion_centavos?: Centavos
  tercero_id?: Uuid
  categoria_gasto?: CategoriaGasto
  concepto?: string
  notas?: string
  estado_registro: EstadoRegistro
  pendientes: Pendiente[]
  origen_captura: OrigenCaptura
  captura_id?: Uuid
  creado_en: FechaHora
  dispositivo_id: Uuid
  confirmado_en?: FechaHora
  /** Los renglones viajan con su movimiento; el almacén los guarda aparte (ADR-03). */
  renglones: Renglon[]
}

export interface DecisionAlerta {
  decision_id: Uuid
  negocio_id: Uuid
  codigo: string
  objeto_id: Uuid
  decision: 'aceptada' | 'pospuesta' | 'atendida'
  hasta?: Fecha
  nota?: string
  creado_en: FechaHora
}

// ── Reservados para lo diferido (D-57): tipos sin object store en la PoC-1 ─

export interface Captura {
  captura_id: Uuid
  origen: OrigenCaptura
  adjunto_id?: Uuid
  texto_crudo?: string
  estado: 'pendiente' | 'interpretada' | 'descartada'
  interpretada_por?: 'reglas' | 'modelo' | 'usuario'
  interpretada_en?: FechaHora
}

export interface Adjunto {
  adjunto_id: Uuid
  tipo: 'audio' | 'imagen' | 'archivo'
  movimiento_id?: Uuid
  captura_id?: Uuid
  bytes: number
  huella: string
  conservar: boolean
  respaldado_en?: FechaHora
}

export interface CierrePeriodo {
  cierre_id: Uuid
  periodo: string
  estado: 'abierto' | 'cerrado' | 'reabierto'
  efectivo_contado_centavos?: Centavos
  utilidad_declarada_centavos?: Centavos
  cerrado_en?: FechaHora
  notas?: string
}
