// Acompañamiento didáctico (CH-19 §14): lo que sigue después del asistente de bienvenida.
// Quien usa El Chalán aprende haciendo, no leyendo un manual (CH-08: comerciante sin
// formación contable, captura 100 % manual). Tres piezas, todas en lenguaje de calle (D-16):
//
// 1. **Primeros pasos**: una lista corta en el inicio que se palomea sola con lo que la
//    persona ya hizo (primera venta, primer gasto, primera compra, respaldo, ver su semana).
// 2. **Pistas**: una tarjeta la primera vez que se abre cada pantalla o tipo de anotación,
//    con para qué sirve y un ejemplo. Se cierra con «Entendido» y no vuelve.
// 3. **¿Qué significa?**: el glosario de CH-13 en palabras de la pantalla, a un toque.
//
// Aquí solo vive la lógica pura y los textos; lo que se recuerda (pistas vistas) se guarda
// en este teléfono, por negocio, como una comodidad: si se pierde, solo se vuelven a ver.

import type { Movimiento, TipoMovimiento } from '../dominio/index.ts'

// ── 1. Primeros pasos ────────────────────────────────────────────────────

export type IdMision = 'venta' | 'gasto' | 'compra' | 'respaldo' | 'semana'

export interface Mision {
  id: IdMision
  titulo: string
  /** Por qué conviene, en una línea. */
  porque: string
  hecho: boolean
}

export interface DatosMisiones {
  movimientos: readonly Pick<Movimiento, 'tipo' | 'operacion'>[]
  ultimoRespaldo?: string | null
  /** Pantallas que ya abrió (para «mira tu semana»). */
  visto: ReadonlySet<string>
  giro?: string
}

const anoto = (ms: DatosMisiones['movimientos'], tipo: TipoMovimiento) =>
  ms.some((m) => m.tipo === tipo && m.operacion !== 'anulacion')

/** La lista de primeros pasos, en orden, palomeada con lo que ya pasó. */
export function misiones(d: DatosMisiones): Mision[] {
  const lista: Mision[] = [
    { id: 'venta', titulo: 'Anota tu primera venta', porque: 'Así empieza a contar «Vendí».', hecho: anoto(d.movimientos, 'venta') },
    { id: 'gasto', titulo: 'Anota un gasto', porque: 'La luz, el pasaje o las bolsas: sin gastos no sabes si ganas.', hecho: anoto(d.movimientos, 'gasto') },
    { id: 'compra', titulo: 'Anota una compra de mercancía', porque: 'Lo que compras para revender; así sabes cuánto te deja cada venta.', hecho: anoto(d.movimientos, 'compra') },
    { id: 'respaldo', titulo: 'Haz tu primer respaldo', porque: 'Si el teléfono se pierde, el respaldo te salva.', hecho: !!d.ultimoRespaldo },
    { id: 'semana', titulo: 'Mira cómo te fue en la semana', porque: 'Vendí, gasté y gané, comparado con la semana pasada.', hecho: d.visto.has('periodo') },
  ]
  // Quien solo da servicios casi no compra mercancía: no se le pide.
  return d.giro === 'servicios' ? lista.filter((m) => m.id !== 'compra') : lista
}

/** Cuántos van hechos de cuántos. */
export function avance(ms: readonly Mision[]): { hechos: number; total: number; completo: boolean } {
  const hechos = ms.filter((m) => m.hecho).length
  return { hechos, total: ms.length, completo: hechos === ms.length }
}

/** La siguiente cosa por hacer, o null si ya está todo. */
export function siguiente(ms: readonly Mision[]): Mision | null {
  return ms.find((m) => !m.hecho) ?? null
}

// ── 2. Pistas por pantalla ───────────────────────────────────────────────

export interface Pista {
  titulo: string
  texto: string
  /** Un ejemplo concreto, si ayuda. */
  ejemplo?: string
}

/** Clave: el nombre de la pantalla, o `captura:<tipo>` para cada tipo de anotación. */
export const PISTAS: Record<string, Pista> = {
  movimientos: {
    titulo: 'Aquí está todo lo que anotaste',
    texto: 'Ordenado por día, con lo que vendiste y gastaste cada día. Toca uno para verlo, corregirlo o anularlo: nada se borra, queda la historia.',
  },
  deben: {
    titulo: 'Lo que te deben',
    texto: 'Cuando vendes fiado (al anotar la venta marca «Me deben»), aquí aparece quién te debe y desde cuándo. Si te paga, toca a la persona y anota cuánto.',
    ejemplo: 'Le fiaste $300 a Doña Mary el lunes; el viernes te da $200: anotas $200 y le quedan $100.',
  },
  revisar: {
    titulo: 'La app te avisa lo que no cuadra',
    texto: 'Por ejemplo, una venta repetida, una venta por debajo de lo que te costó o un cobro que ya se venció. Si está bien así, tócale «Está bien»; si no, corrígelo.',
  },
  productos: {
    titulo: 'Tu bodega',
    texto: 'Cuántas piezas tienes de cada cosa y cuánto vale todo. Se mueve sola: baja cuando vendes y sube cuando anotas una compra. Usar productos es opcional.',
  },
  periodo: {
    titulo: 'Cómo te fue',
    texto: '«Me deja» es lo que vendiste menos lo que te costó la mercancía. «Gané» es eso menos tus gastos. Con las flechas comparas con semanas o meses anteriores.',
    ejemplo: 'Vendiste $1,000 de mercancía que te costó $600: te deja $400. Si gastaste $150 en pasajes, ganaste $250.',
  },
  respaldo: {
    titulo: 'Tu seguro',
    texto: 'Tus datos solo viven en este teléfono. El respaldo es un archivo que mandas a tu correo, WhatsApp o Drive. Si cambias de teléfono, con ese archivo recuperas todo.',
  },
  'captura:venta': {
    titulo: 'Anotar una venta',
    texto: 'Escribe cuánto te pagaron y toca «Listo». Si te lo quedaron a deber, marca «Me deben» y pon quién. Con «Listo y otra» anotas varias seguidas.',
  },
  'captura:compra': {
    titulo: 'Compré mercancía',
    texto: 'Solo lo que compras para volver a vender. Si es luz, renta, pasajes o bolsas, eso va en «Gasté».',
    ejemplo: '10 gorras para revender = Compré. La gasolina para ir por ellas = Gasté.',
  },
  'captura:gasto': {
    titulo: 'Gasté',
    texto: 'Lo que pagas para que el negocio funcione: renta, luz, pasajes, bolsas, sueldos. Lo que compras para revender va en «Compré mercancía».',
  },
  'captura:retiro': {
    titulo: 'Saqué dinero',
    texto: 'Dinero del negocio que tomas para ti o tu casa. No es un gasto del negocio: así no se revuelve lo tuyo con lo del changarro.',
  },
  'captura:aportacion': {
    titulo: 'Puse dinero',
    texto: 'Dinero tuyo que metes al negocio, por ejemplo para surtir. No es una venta.',
  },
}

/** Clave de la pista de una pantalla (o de un tipo de anotación). */
export function clavePista(pantalla: string, tipo?: string): string | null {
  const clave = pantalla === 'captura' && tipo ? `captura:${tipo}` : pantalla
  return clave in PISTAS ? clave : null
}

// ── 3. ¿Qué significa? (glosario de CH-13 con las palabras de la pantalla) ──

export interface Termino {
  id: string
  palabra: string
  significa: string
}

export const GLOSARIO: readonly Termino[] = [
  { id: 'tengo', palabra: 'Tengo', significa: 'Todo el dinero del negocio ahorita: el efectivo de la caja más lo del banco o la tarjeta.' },
  { id: 'vendi', palabra: 'Vendí', significa: 'Lo que vendiste en la semana o el mes, de contado y fiado, menos lo que te devolvieron.' },
  { id: 'gaste', palabra: 'Gasté', significa: 'Lo que pagaste para operar: renta, luz, pasajes, bolsas. No incluye la mercancía que compras para revender.' },
  { id: 'compre', palabra: 'Compré mercancía', significa: 'Lo que compras para volver a vender. Se vuelve costo hasta que lo vendes.' },
  { id: 'medeja', palabra: 'Me deja', significa: 'Lo que vendiste menos lo que te costó eso que vendiste.' },
  { id: 'gane', palabra: 'Gané', significa: '«Me deja» menos tus gastos. Si sale en rojo, ese periodo perdiste.' },
  { id: 'margen', palabra: 'Margen sobre costo', significa: 'Cuánto le ganas a lo que te costó. Si compras en $100 y vendes en $150, tu margen es 50 %.' },
  { id: 'flujo', palabra: 'Entró − salió', significa: 'El dinero que se movió: lo que cobraste menos lo que pagaste, incluida la mercancía. No es lo mismo que «Gané».' },
  { id: 'deben', palabra: 'Me deben', significa: 'Lo que vendiste fiado y todavía no te pagan. «Vencido» es lo que ya pasó de la fecha que te prometieron.' },
  { id: 'saque', palabra: 'Saqué / Puse dinero', significa: 'Dinero tuyo que sale del negocio o que metes. No cuenta como gasto ni como venta.' },
  { id: 'bodega', palabra: 'Bodega', significa: 'La mercancía que tienes guardada para vender, con cuántas piezas hay de cada cosa.' },
  { id: 'respaldo', palabra: 'Respaldo', significa: 'Una copia de tus datos en un archivo que guardas fuera del teléfono.' },
]

export function termino(id: string): Termino | undefined {
  return GLOSARIO.find((t) => t.id === id)
}

// ── Lo que se recuerda en este teléfono ──────────────────────────────────

/** Pistas cerradas y pantallas vistas, como lista de claves. */
export function leerVisto(texto: string | null): Set<string> {
  if (!texto) return new Set()
  try {
    const v: unknown = JSON.parse(texto)
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function escribirVisto(visto: ReadonlySet<string>): string {
  return JSON.stringify([...visto].sort())
}
