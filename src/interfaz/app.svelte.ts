// Estado de la app: une el dominio (reglas), el almacén (IndexedDB) y el respaldo.
// Las pantallas solo leen de aquí y llaman a sus acciones.
//
// El estado del negocio se guarda como `$state.raw` y se reemplaza entero en cada
// cambio: IndexedDB copia los objetos y no acepta los proxies reactivos de Svelte.

import { uuidv7 } from 'uuidv7'
import { AlmacenNegocio, VERSION_ESQUEMA, type EstadoNegocio } from '../almacen/indexeddb.ts'
import { pedirPersistencia, type EstadoAlmacenamiento } from '../almacen/persistencia.ts'
import {
  alertasAbiertas, anular, calcularVistas, corregir, detectarAlertas, firmar, hoyEn, inicioDeSemana,
  resolverVersiones, type Alerta, type Centavos, type Contexto, type DatosMovimiento, type DecisionAlerta,
  type ErrorValidacion, type Milesimas, type Movimiento, type Negocio, type Producto, type Tercero, type Uuid,
} from '../dominio/index.ts'
import { descargarEnNavegador, entregarArchivo } from '../exportacion/entregar.ts'
import { crearRespaldo, estadoDesdeRespaldo, leerRespaldo, nombreArchivo } from '../exportacion/respaldo.ts'
import { cargarEjemplo } from '../captura/ejemplo.ts'
import { Navegacion } from './navegacion.ts'

export type Pantalla =
  | 'cargando' | 'bienvenida' | 'inicio' | 'captura' | 'deben' | 'cobro' | 'mas'
  | 'devolucion' | 'movimientos' | 'detalle' | 'respaldo' | 'revisar'
  | 'productos' | 'producto' | 'periodo' | 'ajustes' | 'bloqueo'

/** Pantallas desde las que «atrás» sale de la app (UX-01). */
const RAICES: Pantalla[] = ['cargando', 'bienvenida', 'inicio', 'bloqueo']

/** Avisos que se muestran antes de guardar: el usuario puede guardar igual (CH-04 §12.1). */
const AVISAR_ANTES = ['AN-03', 'AN-04', 'AN-09', 'AN-10', 'AN-14']

const CLAVE_NEGOCIO = 'elchalan:negocio'
const CLAVE_EJEMPLO = 'elchalan:ejemplo'
/** El candado vive solo en este teléfono: nunca entra al respaldo (CH-04 §4.1). */
const CLAVE_PIN = (negocio: Uuid) => `elchalan:pin:${negocio}`

async function huellaPin(pin: string, sal: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${sal}:${pin}`))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const ZONA = 'America/Mexico_City'

function leerClave(clave: string): string | null {
  try { return localStorage.getItem(clave) } catch { return null }
}
function escribirClave(clave: string, valor: string | null) {
  try { valor === null ? localStorage.removeItem(clave) : localStorage.setItem(clave, valor) } catch { /* sin almacenamiento */ }
}

export type Preparado =
  | { ok: true; movimiento: Movimiento; avisos: Alerta[] }
  | { ok: false; errores: ErrorValidacion[] }

class App {
  pantalla = $state<Pantalla>('cargando')
  estado = $state.raw<EstadoNegocio | null>(null)
  periodo = $state<'semana' | 'mes'>('semana')
  hoy = $state(hoyEn(ZONA))
  /** «Anotado · Deshacer» (F-2). */
  aviso = $state<{ texto: string; deshacer?: Uuid } | null>(null)
  almacenamiento = $state<EstadoAlmacenamiento | undefined>(undefined)
  esEjemplo = $state(false)
  /** Lo que abre cada pantalla: tipo a anotar, movimiento a ver o corregir, persona que pagó. */
  tipoCaptura = $state<DatosMovimiento['tipo']>('venta')
  /** Cuántas se anotaron seguidas con «Listo y otra», y la vuelta del formulario. */
  seguidas = $state(0)
  vuelta = $state(0)
  corrigiendo = $state<Uuid | null>(null)
  seleccion = $state<Uuid | null>(null)
  terceroCobro = $state<Uuid | null>(null)
  productoSeleccionado = $state<Uuid | null>(null)
  error = $state<string | null>(null)
  /** Hay una versión nueva de la app lista; se activa al tocar «Actualizar» (RNF-19). */
  actualizar = $state<(() => void) | null>(null)
  /** Con el candado puesto, solo se ve la pantalla del PIN y la de restaurar (F-13). */
  bloqueado = $state(false)

  private almacen: AlmacenNegocio | null = null
  private readonly nav = typeof history === 'undefined' ? null : new Navegacion<Pantalla>(history, 'cargando', RAICES, (p) => this.mostrar(p))

  constructor() {
    globalThis.addEventListener?.('popstate', () => this.nav?.alIrAtras())
  }
  private temporizador: ReturnType<typeof setTimeout> | undefined

  // ── Lo que ve la pantalla ───────────────────────────────────────────────
  rango = $derived(
    this.periodo === 'semana'
      ? { desde: inicioDeSemana(this.hoy), hasta: this.hoy }
      : { desde: `${this.hoy.slice(0, 7)}-01`, hasta: this.hoy },
  )
  vistas = $derived(this.estado && calcularVistas(this.estado.movimientos, this.estado.negocio, this.estado.productos, this.rango))
  versiones = $derived(this.estado ? resolverVersiones(this.estado.movimientos) : null)
  alertas = $derived.by(() => {
    const e = this.estado
    if (!e) return []
    const todas = detectarAlertas(e.movimientos, e.negocio, e.productos, {
      hoy: this.hoy, ultimo_respaldo: e.meta.ultimo_respaldo, almacenamiento: this.almacenamiento,
    })
    // El respaldo y el almacenamiento tienen su propio aviso en el inicio.
    return alertasAbiertas(todas, e.decisiones, this.hoy).filter((a) => a.codigo !== 'AN-17' && a.codigo !== 'AN-18')
  })
  existenciaHoy = $derived(
    this.estado ? calcularVistas(this.estado.movimientos, this.estado.negocio, this.estado.productos, { desde: this.hoy, hasta: this.hoy }).existencia : {},
  )
  terceros = $derived(new Map((this.estado?.terceros ?? []).map((t) => [t.tercero_id, t])))

  // ── Arranque ────────────────────────────────────────────────────────────
  async iniciar() {
    this.almacenamiento = await pedirPersistencia().catch(() => undefined)
    const ejemplo = leerClave(CLAVE_EJEMPLO)
    const propio = leerClave(CLAVE_NEGOCIO)
    const id = ejemplo ?? propio
    if (id && (await this.abrir(id))) {
      this.esEjemplo = id === ejemplo
      this.bloqueado = this.tienePin()
      this.ir(this.bloqueado ? 'bloqueo' : 'inicio')
    } else {
      this.ir('bienvenida')
    }
  }

  private async abrir(id: Uuid): Promise<boolean> {
    this.almacen?.cerrar()
    this.almacen = await AlmacenNegocio.abrir(id)
    this.estado = await this.almacen.leer()
    return this.estado !== null
  }

  async crearNegocio(nombre: string, capital?: number) {
    const ahora = new Date().toISOString()
    const negocio: Negocio = {
      negocio_id: uuidv7(), nombre: nombre.trim(), nivel: 1, moneda: 'MXN', zona_horaria: ZONA,
      inicio_operaciones: this.hoy, creado_en: ahora, dispositivo_id: uuidv7(),
    }
    if (capital) negocio.capital_inicial_centavos = capital
    this.almacen?.cerrar()
    this.almacen = await AlmacenNegocio.abrir(negocio.negocio_id)
    await this.almacen.crearNegocio(negocio)
    escribirClave(CLAVE_NEGOCIO, negocio.negocio_id)
    this.estado = await this.almacen.leer()
    this.esEjemplo = false
    this.ir('inicio')
  }

  // ── Anotar ──────────────────────────────────────────────────────────────
  private contexto(): Contexto {
    const e = this.estado!
    return {
      negocio_id: e.negocio.negocio_id, dispositivo_id: e.negocio.dispositivo_id, hoy: this.hoy,
      ahora: new Date().toISOString(), nuevoId: uuidv7,
      productos: new Map(e.productos.map((p) => [p.producto_id, p])),
    }
  }

  /** Firma sin guardar y dice qué avisar antes (duplicado, cobro de más…). */
  preparar(datos: DatosMovimiento): Preparado {
    const e = this.estado!
    const r = this.corrigiendo
      ? corregir(this.versiones!, this.corrigiendo, datos, this.contexto())
      : firmar(datos, this.contexto())
    if (!r.ok) return r
    const m = r.movimiento
    const avisos = detectarAlertas([...e.movimientos, m], e.negocio, e.productos, { hoy: this.hoy, ultimo_respaldo: this.hoy })
      .filter((a) => a.objeto_id === m.movimiento_id && AVISAR_ANTES.includes(a.codigo))
    return { ok: true, movimiento: m, avisos }
  }

  async guardar(movimiento: Movimiento, texto = 'Anotado') {
    // IndexedDB no copia proxies reactivos: se guarda una copia simple.
    const m = $state.snapshot(movimiento) as Movimiento
    await this.almacen!.agregarMovimiento(m)
    this.estado = { ...this.estado!, movimientos: [...this.estado!.movimientos, m] }
    this.corrigiendo = null
    this.avisar(texto, m.operacion === 'alta' ? m.movimiento_id : undefined)
  }

  /** «Deshacer» no borra: anula lo recién anotado (CH-04 P-2). */
  async deshacer(id: Uuid) {
    await this.anular(id, 'Deshacer')
    this.avisar('Listo, se anuló')
  }

  async anular(id: Uuid, motivo?: string) {
    const r = anular(this.versiones!, id, this.contexto(), motivo)
    if (!r.ok) throw new Error(r.errores[0].mensaje)
    await this.almacen!.agregarMovimiento(r.movimiento)
    this.estado = { ...this.estado!, movimientos: [...this.estado!.movimientos, r.movimiento] }
  }

  /** Busca un cliente o proveedor por nombre; si no existe, lo crea ahí mismo (F-4). */
  async tercero(nombre: string, rol: Tercero['rol']): Promise<Uuid> {
    const limpio = nombre.trim()
    const existente = this.estado!.terceros.find((t) => t.activo && t.rol === rol && t.nombre.toLowerCase() === limpio.toLowerCase())
    if (existente) return existente.tercero_id
    const t: Tercero = {
      tercero_id: uuidv7(), negocio_id: this.estado!.negocio.negocio_id, nombre: limpio, rol, activo: true,
      creado_en: new Date().toISOString(), dispositivo_id: this.estado!.negocio.dispositivo_id,
    }
    await this.almacen!.guardarTercero(t)
    this.estado = { ...this.estado!, terceros: [...this.estado!.terceros, t] }
    return t.tercero_id
  }

  // ── Productos (F-9) ───────────────────────────────────────────────────────
  async guardarProducto(p: Producto) {
    const limpio = $state.snapshot(p) as Producto
    await this.almacen!.guardarProducto(limpio)
    const otros = this.estado!.productos.filter((x) => x.producto_id !== limpio.producto_id)
    this.estado = { ...this.estado!, productos: [...otros, limpio].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) }
  }

  nuevoProducto(datos: Pick<Producto, 'nombre' | 'unidad_medida'> & { precio?: Centavos; costo?: Centavos }): Producto {
    const p: Producto = {
      producto_id: uuidv7(), negocio_id: this.estado!.negocio.negocio_id, nombre: datos.nombre.trim(),
      unidad_medida: datos.unidad_medida, etiquetas: [], activo: true,
      creado_en: new Date().toISOString(), dispositivo_id: this.estado!.negocio.dispositivo_id,
    }
    if (datos.precio !== undefined) p.precio_venta_centavos = datos.precio
    if (datos.costo !== undefined) p.costo_centavos = datos.costo
    return p
  }

  /** Conteo de bodega: anota la diferencia entre lo que hay y lo que dice la app. */
  async ajustarExistencia(productoId: Uuid, cantidadReal: Milesimas, concepto: string) {
    const diferencia = cantidadReal - (this.existenciaHoy[productoId] ?? 0)
    if (diferencia === 0) return
    const p = this.estado!.productos.find((x) => x.producto_id === productoId)!
    const r = firmar({
      tipo: 'ajuste_existencia', monto_centavos: 0, concepto,
      renglones: [{ producto_id: productoId, cantidad_milesimas: diferencia, unidad_medida: p.unidad_medida, importe_centavos: 0 }],
    }, this.contexto())
    if (!r.ok) throw new Error(r.errores[0].mensaje)
    await this.guardar(r.movimiento, 'Bodega ajustada')
  }

  // ── Ajustes (F-13) ────────────────────────────────────────────────────────
  async actualizarNegocio(cambios: Partial<Pick<Negocio, 'nombre' | 'penalizacion_devolucion_pct'>>) {
    const negocio = { ...this.estado!.negocio, ...cambios }
    await this.almacen!.guardarNegocio(negocio)
    this.estado = { ...this.estado!, negocio }
  }

  tienePin(): boolean {
    return !!this.estado && leerClave(CLAVE_PIN(this.estado.negocio.negocio_id)) !== null
  }

  async ponerPin(pin: string) {
    const sal = uuidv7()
    escribirClave(CLAVE_PIN(this.estado!.negocio.negocio_id), JSON.stringify({ sal, huella: await huellaPin(pin, sal) }))
  }

  quitarPin() {
    escribirClave(CLAVE_PIN(this.estado!.negocio.negocio_id), null)
  }

  async desbloquear(pin: string): Promise<boolean> {
    const guardado = leerClave(CLAVE_PIN(this.estado!.negocio.negocio_id))
    if (!guardado) return true
    const { sal, huella } = JSON.parse(guardado) as { sal: string; huella: string }
    const ok = (await huellaPin(pin, sal)) === huella
    if (ok && this.bloqueado) {
      this.bloqueado = false
      this.ir('inicio')
    }
    return ok
  }

  async decidir(alerta: Alerta, decision: DecisionAlerta['decision'], hasta?: string) {
    const d: DecisionAlerta = {
      decision_id: uuidv7(), negocio_id: this.estado!.negocio.negocio_id, codigo: alerta.codigo,
      objeto_id: alerta.objeto_id, decision, creado_en: new Date().toISOString(),
    }
    if (hasta) d.hasta = hasta
    await this.almacen!.agregarDecision(d)
    this.estado = { ...this.estado!, decisiones: [...this.estado!.decisiones, d] }
  }

  // ── Respaldo (F-11) ─────────────────────────────────────────────────────
  async respaldar() {
    const e = this.estado!
    const texto = await crearRespaldo(e, new Date().toISOString())
    const { entrega, fallo } = await entregarArchivo(texto, nombreArchivo(e.negocio, this.hoy), {
      canShare: navigator.canShare?.bind(navigator),
      share: navigator.share?.bind(navigator),
      descargar: descargarEnNavegador,
    })
    if (fallo) console.warn('No se pudo compartir el respaldo; se descargó.', fallo)
    if (entrega === 'cancelado') return
    await this.almacen!.marcarRespaldo(this.hoy)
    this.estado = { ...e, meta: { ...e.meta, ultimo_respaldo: this.hoy } }
    this.avisar(entrega === 'compartido'
      ? 'Respaldo listo'
      : 'Respaldo guardado en Descargas de este teléfono. Mándatelo por correo o súbelo a tu Drive.')
  }

  /** Lee el archivo; si es válido, devuelve una función para confirmar el reemplazo. */
  async revisarRespaldo(archivo: File) {
    const lectura = await leerRespaldo(await archivo.text())
    if (!lectura.ok) return lectura
    return {
      ok: true as const,
      negocio: lectura.datos.negocio.nombre,
      movimientos: lectura.datos.movimientos.length,
      fecha: lectura.generado_en,
      restaurar: async () => {
        const id = lectura.datos.negocio.negocio_id
        this.almacen?.cerrar()
        this.almacen = await AlmacenNegocio.abrir(id)
        await this.almacen.reemplazarTodo(estadoDesdeRespaldo(lectura.datos, lectura.generado_en, VERSION_ESQUEMA))
        escribirClave(CLAVE_NEGOCIO, id)
        escribirClave(CLAVE_EJEMPLO, null)
        // Restaurar es como estrenar teléfono: el candado no viaja en el respaldo.
        escribirClave(CLAVE_PIN(id), null)
        this.bloqueado = false
        this.estado = await this.almacen.leer()
        this.esEjemplo = false
        this.ir('inicio')
        this.avisar('Negocio restaurado')
      },
    }
  }

  // ── Datos de ejemplo (M0, RNF-20): viven en su propia base y se borran de golpe ─
  async probarEjemplo() {
    this.ir('cargando')
    const estado = await cargarEjemplo(this.hoy)
    this.almacen?.cerrar()
    this.almacen = await AlmacenNegocio.abrir(estado.negocio.negocio_id)
    await this.almacen.reemplazarTodo(estado)
    escribirClave(CLAVE_EJEMPLO, estado.negocio.negocio_id)
    this.estado = await this.almacen.leer()
    this.esEjemplo = true
    this.ir('inicio')
  }

  /** Hay un negocio propio al cual volver al salir del ejemplo (UX-17). */
  get tieneNegocioPropio(): boolean {
    return leerClave(CLAVE_NEGOCIO) !== null
  }

  async borrarEjemplo() {
    const id = this.estado!.negocio.negocio_id
    this.almacen?.cerrar()
    this.almacen = null
    await AlmacenNegocio.borrar(id)
    escribirClave(CLAVE_EJEMPLO, null)
    this.esEjemplo = false
    this.estado = null
    const propio = leerClave(CLAVE_NEGOCIO)
    this.ir(propio && (await this.abrir(propio)) ? 'inicio' : 'bienvenida')
  }

  // ── Navegación y avisos ─────────────────────────────────────────────────
  /** Cambia de pantalla y lo anota en el historial, para que «atrás» regrese. */
  ir(p: Pantalla) {
    if (this.nav) this.nav.ir(p)
    else this.mostrar(p)
  }

  /** «‹ Volver»: lo mismo que el botón atrás del teléfono. */
  /** Pestaña de la barra inferior (D-62): atrás desde ella vuelve al inicio. */
  pestana(p: Pantalla) {
    if (this.nav) this.nav.pestana(p)
    else this.mostrar(p)
  }

  atras() {
    this.nav?.atras()
  }

  /** Una hoja abierta se cierra con atrás (UX-13); devuelve su id. */
  abrirHoja(cerrar: () => void): number {
    return this.nav?.abrirHoja(cerrar) ?? -1
  }

  cerrarHoja(id: number) {
    this.nav?.cerrarHoja(id)
  }

  private mostrar(p: Pantalla) {
    this.pantalla = p
    this.error = null
    globalThis.scrollTo?.(0, 0)
  }

  anotar(tipo: DatosMovimiento['tipo']) {
    this.corrigiendo = null
    this.seguidas = 0
    this.tipoCaptura = tipo
    this.ir(tipo === 'cobro' ? 'deben' : tipo === 'devolucion_venta' ? 'devolucion' : 'captura')
  }

  /** «Listo y otra» (UX-06): el formulario vuelve a empezar sin salir de la pantalla. */
  otraCaptura() {
    this.seguidas++
    this.vuelta++
    globalThis.scrollTo?.(0, 0)
  }

  avisar(texto: string, deshacer?: Uuid) {
    this.aviso = { texto, deshacer }
    clearTimeout(this.temporizador)
    this.temporizador = setTimeout(() => (this.aviso = null), 6000)
  }
}

export const app = new App()
