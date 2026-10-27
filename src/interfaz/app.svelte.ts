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
  resolverVersiones, type Alerta, type Contexto, type DatosMovimiento, type DecisionAlerta,
  type ErrorValidacion, type Movimiento, type Negocio, type Tercero, type Uuid,
} from '../dominio/index.ts'
import { crearRespaldo, estadoDesdeRespaldo, leerRespaldo, nombreArchivo } from '../exportacion/respaldo.ts'
import { cargarEjemplo } from '../captura/ejemplo.ts'

export type Pantalla =
  | 'cargando' | 'bienvenida' | 'inicio' | 'anotar' | 'captura' | 'deben' | 'cobro'
  | 'devolucion' | 'movimientos' | 'detalle' | 'respaldo' | 'revisar'

/** Avisos que se muestran antes de guardar: el usuario puede guardar igual (CH-04 §12.1). */
const AVISAR_ANTES = ['AN-03', 'AN-04', 'AN-09', 'AN-10', 'AN-14']

const CLAVE_NEGOCIO = 'elchalan:negocio'
const CLAVE_EJEMPLO = 'elchalan:ejemplo'

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
  corrigiendo = $state<Uuid | null>(null)
  seleccion = $state<Uuid | null>(null)
  terceroCobro = $state<Uuid | null>(null)
  error = $state<string | null>(null)
  /** Hay una versión nueva de la app lista; se activa al tocar «Actualizar» (RNF-19). */
  actualizar = $state<(() => void) | null>(null)

  private almacen: AlmacenNegocio | null = null
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
  terceros = $derived(new Map((this.estado?.terceros ?? []).map((t) => [t.tercero_id, t])))

  // ── Arranque ────────────────────────────────────────────────────────────
  async iniciar() {
    this.almacenamiento = await pedirPersistencia().catch(() => undefined)
    const ejemplo = leerClave(CLAVE_EJEMPLO)
    const propio = leerClave(CLAVE_NEGOCIO)
    const id = ejemplo ?? propio
    if (id && (await this.abrir(id))) {
      this.esEjemplo = id === ejemplo
      this.pantalla = 'inicio'
    } else {
      this.pantalla = 'bienvenida'
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
    this.pantalla = 'inicio'
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
    const nombre = nombreArchivo(e.negocio, this.hoy)
    const archivo = new File([texto], nombre, { type: 'application/json' })
    // En Android se ofrece compartir (Drive, WhatsApp, correo…); si no, se descarga.
    if (navigator.canShare?.({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: nombre })
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return
        throw err
      }
    } else {
      const url = URL.createObjectURL(archivo)
      const a = Object.assign(document.createElement('a'), { href: url, download: nombre })
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    await this.almacen!.marcarRespaldo(this.hoy)
    this.estado = { ...e, meta: { ...e.meta, ultimo_respaldo: this.hoy } }
    this.avisar('Respaldo listo')
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
        this.estado = await this.almacen.leer()
        this.esEjemplo = false
        this.pantalla = 'inicio'
        this.avisar('Negocio restaurado')
      },
    }
  }

  // ── Datos de ejemplo (M0, RNF-20): viven en su propia base y se borran de golpe ─
  async probarEjemplo() {
    this.pantalla = 'cargando'
    const estado = await cargarEjemplo(this.hoy)
    this.almacen?.cerrar()
    this.almacen = await AlmacenNegocio.abrir(estado.negocio.negocio_id)
    await this.almacen.reemplazarTodo(estado)
    escribirClave(CLAVE_EJEMPLO, estado.negocio.negocio_id)
    this.estado = await this.almacen.leer()
    this.esEjemplo = true
    this.pantalla = 'inicio'
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
    this.pantalla = propio && (await this.abrir(propio)) ? 'inicio' : 'bienvenida'
  }

  // ── Navegación y avisos ─────────────────────────────────────────────────
  ir(p: Pantalla) {
    this.pantalla = p
    this.error = null
    if (p !== 'inicio') this.aviso = null
    globalThis.scrollTo?.(0, 0)
  }

  anotar(tipo: DatosMovimiento['tipo']) {
    this.corrigiendo = null
    this.tipoCaptura = tipo
    this.ir(tipo === 'cobro' ? 'deben' : tipo === 'devolucion_venta' ? 'devolucion' : 'captura')
  }

  avisar(texto: string, deshacer?: Uuid) {
    this.aviso = { texto, deshacer }
    clearTimeout(this.temporizador)
    this.temporizador = setTimeout(() => (this.aviso = null), 6000)
  }
}

export const app = new App()
