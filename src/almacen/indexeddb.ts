// Almacén local en IndexedDB (ADR-03): una base por negocio (ADR-08) y escrituras
// compuestas en una sola transacción (RNF-02). El registro de movimientos solo se
// agrega (CH-04 P-2): no hay operación para editar ni borrar un movimiento.
//
// Object stores de la PoC-1 (D-57): negocio, movimientos, renglones, terceros,
// productos, decisiones_alerta, y `meta` (versión del esquema y último respaldo).

import type {
  DecisionAlerta, Fecha, Movimiento, Negocio, Producto, Renglon, Tercero, Uuid,
} from '../dominio/tipos.ts'

/** Versión del esquema local; cada cambio trae su migración en `actualizar` (RNF-12). */
export const VERSION_ESQUEMA = 1

const PREFIJO = 'elchalan-'

export interface Meta {
  version_esquema: number
  ultimo_respaldo?: Fecha
}

export interface EstadoNegocio {
  negocio: Negocio
  terceros: Tercero[]
  productos: Producto[]
  /** En el orden en que se anotaron, con sus renglones. */
  movimientos: Movimiento[]
  decisiones: DecisionAlerta[]
  meta: Meta
}

type Store = 'negocio' | 'movimientos' | 'renglones' | 'terceros' | 'productos' | 'decisiones_alerta' | 'meta'
const TODOS: Store[] = ['negocio', 'movimientos', 'renglones', 'terceros', 'productos', 'decisiones_alerta', 'meta']

export function nombreBase(negocioId: Uuid): string {
  return `${PREFIJO}${negocioId}`
}

function pedir<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((ok, mal) => {
    req.onsuccess = () => ok(req.result)
    req.onerror = () => mal(req.error)
  })
}

/** Espera a que la transacción se confirme; si algo falla, no queda nada escrito. */
function terminar(tx: IDBTransaction): Promise<void> {
  return new Promise((ok, mal) => {
    tx.oncomplete = () => ok()
    // Un error en cualquier escritura cancela la transacción completa (no se usa
    // preventDefault: eso la dejaría confirmar a medias).
    tx.onabort = () => mal(tx.error ?? new Error('Transacción cancelada'))
  })
}

function actualizar(db: IDBDatabase, desde: number) {
  if (desde < 1) {
    db.createObjectStore('negocio', { keyPath: 'negocio_id' })
    // Llave autoincremental: getAll devuelve el orden en que se anotaron (lo usan
    // las versiones y AN-04). El id del movimiento es único.
    const movs = db.createObjectStore('movimientos', { autoIncrement: true })
    movs.createIndex('movimiento_id', 'movimiento_id', { unique: true })
    const renglones = db.createObjectStore('renglones', { autoIncrement: true })
    renglones.createIndex('renglon_id', 'renglon_id', { unique: true })
    renglones.createIndex('movimiento_id', 'movimiento_id')
    db.createObjectStore('terceros', { keyPath: 'tercero_id' })
    db.createObjectStore('productos', { keyPath: 'producto_id' })
    db.createObjectStore('decisiones_alerta', { keyPath: 'decision_id' })
    db.createObjectStore('meta')
  }
}

export class AlmacenNegocio {
  private readonly db: IDBDatabase
  private constructor(db: IDBDatabase) {
    this.db = db
  }

  static async abrir(negocioId: Uuid, fabrica: IDBFactory = indexedDB): Promise<AlmacenNegocio> {
    const req = fabrica.open(nombreBase(negocioId), VERSION_ESQUEMA)
    req.onupgradeneeded = (e) => actualizar(req.result, e.oldVersion)
    return new AlmacenNegocio(await pedir(req))
  }

  /** Borra la base completa de un negocio (por ejemplo, los datos de ejemplo, RNF-20). */
  static async borrar(negocioId: Uuid, fabrica: IDBFactory = indexedDB): Promise<void> {
    await pedir(fabrica.deleteDatabase(nombreBase(negocioId)))
  }

  cerrar(): void {
    this.db.close()
  }

  async crearNegocio(negocio: Negocio): Promise<void> {
    const tx = this.db.transaction(['negocio', 'meta'], 'readwrite')
    tx.objectStore('negocio').add(negocio)
    tx.objectStore('meta').put({ version_esquema: VERSION_ESQUEMA } satisfies Meta, 'meta')
    await terminar(tx)
  }

  /** Todo el negocio, o `null` si la base está vacía. */
  async leer(): Promise<EstadoNegocio | null> {
    const tx = this.db.transaction(TODOS, 'readonly')
    const de = <T>(s: Store) => pedir(tx.objectStore(s).getAll()) as Promise<T[]>
    const [negocios, movs, renglones, terceros, productos, decisiones, meta] = await Promise.all([
      de<Negocio>('negocio'), de<Omit<Movimiento, 'renglones'>>('movimientos'), de<Renglon>('renglones'),
      de<Tercero>('terceros'), de<Producto>('productos'), de<DecisionAlerta>('decisiones_alerta'),
      pedir(tx.objectStore('meta').get('meta')) as Promise<Meta | undefined>,
    ])
    await terminar(tx)
    if (!negocios.length) return null
    const porMovimiento = new Map<Uuid, Renglon[]>()
    for (const r of renglones) porMovimiento.set(r.movimiento_id, [...(porMovimiento.get(r.movimiento_id) ?? []), r])
    return {
      negocio: negocios[0],
      terceros,
      productos,
      movimientos: movs.map((m) => ({ ...m, renglones: porMovimiento.get(m.movimiento_id) ?? [] })),
      decisiones,
      meta: meta ?? { version_esquema: VERSION_ESQUEMA },
    }
  }

  /**
   * Agrega un movimiento con sus renglones en una sola transacción: o queda todo o
   * nada (ADR-03). Un id repetido se rechaza, así que reintentar no duplica (RNF-02).
   */
  async agregarMovimiento(m: Movimiento): Promise<void> {
    const tx = this.db.transaction(['movimientos', 'renglones'], 'readwrite')
    const { renglones, ...movimiento } = m
    tx.objectStore('movimientos').add(movimiento)
    for (const r of renglones) tx.objectStore('renglones').add(r)
    await terminar(tx)
  }

  /** Los datos del negocio (nombre, penalización de costumbre) se pueden cambiar. */
  async guardarNegocio(negocio: Negocio): Promise<void> {
    const tx = this.db.transaction('negocio', 'readwrite')
    tx.objectStore('negocio').put(negocio)
    await terminar(tx)
  }

  /** Productos y terceros sí se actualizan (costo del catálogo, archivar); no se borran. */
  async guardarProducto(p: Producto): Promise<void> {
    const tx = this.db.transaction('productos', 'readwrite')
    tx.objectStore('productos').put(p)
    await terminar(tx)
  }

  async guardarTercero(t: Tercero): Promise<void> {
    const tx = this.db.transaction('terceros', 'readwrite')
    tx.objectStore('terceros').put(t)
    await terminar(tx)
  }

  async agregarDecision(d: DecisionAlerta): Promise<void> {
    const tx = this.db.transaction('decisiones_alerta', 'readwrite')
    tx.objectStore('decisiones_alerta').add(d)
    await terminar(tx)
  }

  async marcarRespaldo(fecha: Fecha): Promise<void> {
    const tx = this.db.transaction('meta', 'readwrite')
    const meta = tx.objectStore('meta')
    const actual = ((await pedir(meta.get('meta'))) as Meta | undefined) ?? { version_esquema: VERSION_ESQUEMA }
    meta.put({ ...actual, ultimo_respaldo: fecha } satisfies Meta, 'meta')
    await terminar(tx)
  }

  /** Restaurar: reemplaza todo el negocio en una sola transacción (si falla, queda lo de antes). */
  async reemplazarTodo(estado: EstadoNegocio): Promise<void> {
    const tx = this.db.transaction(TODOS, 'readwrite')
    for (const s of TODOS) tx.objectStore(s).clear()
    tx.objectStore('negocio').add(estado.negocio)
    for (const t of estado.terceros) tx.objectStore('terceros').add(t)
    for (const p of estado.productos) tx.objectStore('productos').add(p)
    for (const { renglones, ...m } of estado.movimientos) {
      tx.objectStore('movimientos').add(m)
      for (const r of renglones) tx.objectStore('renglones').add(r)
    }
    for (const d of estado.decisiones) tx.objectStore('decisiones_alerta').add(d)
    tx.objectStore('meta').put({ ...estado.meta, version_esquema: VERSION_ESQUEMA } satisfies Meta, 'meta')
    await terminar(tx)
  }
}
