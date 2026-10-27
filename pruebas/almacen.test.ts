// Almacén local y respaldo manual (paso 4 de CH-18 §5): T-16 con respaldo de archivo,
// atomicidad (ADR-03) y no perder ni duplicar (RNF-02). IndexedDB simulado con
// fake-indexeddb; en el teléfono se mide aparte (S-2, S-4).

import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { AlmacenNegocio, VERSION_ESQUEMA, type EstadoNegocio } from '../src/almacen/indexeddb.ts'
import { ARQUETIPOS } from '../datos_sinteticos/arquetipos.ts'
import { calcularVistas, detectarAlertas, type DecisionAlerta, type Movimiento } from '../src/dominio/index.ts'
import { crearRespaldo, estadoDesdeRespaldo, leerRespaldo, nombreArchivo } from '../src/exportacion/respaldo.ts'

async function cargar(fabrica: IDBFactory, id: keyof typeof ARQUETIPOS) {
  const g = ARQUETIPOS[id]().generador
  const almacen = await AlmacenNegocio.abrir(g.negocio.negocio_id, fabrica)
  await almacen.crearNegocio(g.negocio)
  for (const t of g.terceros) await almacen.guardarTercero(t)
  for (const p of g.productos) await almacen.guardarProducto(p)
  for (const m of g.registro) await almacen.agregarMovimiento(m)
  const decision: DecisionAlerta = {
    decision_id: 'dec-1', negocio_id: g.negocio.negocio_id, codigo: 'AN-05',
    objeto_id: g.registro[0].movimiento_id, decision: 'aceptada', creado_en: '2026-10-04T18:00:00Z',
  }
  await almacen.agregarDecision(decision)
  return { g, almacen }
}

const sinMeta = (e: EstadoNegocio | null) => e && { ...e, meta: undefined }

describe('almacén IndexedDB', () => {
  it('guarda y devuelve el negocio igual, en el orden en que se anotó', async () => {
    const fabrica = new IDBFactory()
    const { g, almacen } = await cargar(fabrica, 'A1')
    almacen.cerrar()
    // Cerrar y volver a abrir la app no pierde nada.
    const otra = await AlmacenNegocio.abrir(g.negocio.negocio_id, fabrica)
    const leido = await otra.leer()
    expect(leido?.negocio).toEqual(g.negocio)
    expect(leido?.movimientos).toEqual(g.registro)
    expect(leido?.productos).toEqual(g.productos)
    expect(leido?.terceros).toEqual(g.terceros)
    expect(leido?.meta).toEqual({ version_esquema: VERSION_ESQUEMA })
  })

  it('un movimiento y sus renglones se guardan juntos o no se guarda nada (ADR-03)', async () => {
    const fabrica = new IDBFactory()
    const { g, almacen } = await cargar(fabrica, 'A1')
    const base = g.registro.find((m) => m.renglones.length >= 1)!
    const roto: Movimiento = {
      ...base, movimiento_id: 'nuevo',
      // El segundo renglón repite id: la transacción falla a la mitad.
      renglones: [{ ...base.renglones[0], renglon_id: 'r-x', movimiento_id: 'nuevo' }, { ...base.renglones[0], renglon_id: 'r-x', movimiento_id: 'nuevo' }],
    }
    await expect(almacen.agregarMovimiento(roto)).rejects.toThrow()
    const leido = (await almacen.leer())!
    expect(leido.movimientos).toHaveLength(g.registro.length)
    expect(leido.movimientos.some((m) => m.movimiento_id === 'nuevo')).toBe(false)
    expect(leido.movimientos.flatMap((m) => m.renglones).some((r) => r.renglon_id === 'r-x')).toBe(false)
  })

  it('volver a guardar el mismo movimiento no lo duplica (RNF-02)', async () => {
    const fabrica = new IDBFactory()
    const { g, almacen } = await cargar(fabrica, 'A1')
    await expect(almacen.agregarMovimiento(g.registro[5])).rejects.toThrow()
    expect((await almacen.leer())!.movimientos).toHaveLength(g.registro.length)
  })

  it('una base vacía se lee como null y cada negocio vive en su propia base (ADR-08)', async () => {
    const fabrica = new IDBFactory()
    await cargar(fabrica, 'A1')
    const vacia = await AlmacenNegocio.abrir('otro-negocio', fabrica)
    expect(await vacia.leer()).toBeNull()
  })

  it('recuerda la fecha del último respaldo', async () => {
    const fabrica = new IDBFactory()
    const { almacen } = await cargar(fabrica, 'A1')
    await almacen.marcarRespaldo('2026-10-04')
    expect((await almacen.leer())!.meta.ultimo_respaldo).toBe('2026-10-04')
  })
})

describe('T-16 · respaldar, borrar y restaurar desde archivo', () => {
  for (const id of ['A1', 'A2'] as const) {
    it(`deja el negocio ${id} idéntico, con los mismos números y alertas`, async () => {
      const fabrica = new IDBFactory()
      const { g, almacen } = await cargar(fabrica, id)
      const antes = (await almacen.leer())!
      const archivo = await crearRespaldo(antes, '2026-10-05T01:30:00Z')

      // Se borran los datos del teléfono.
      almacen.cerrar()
      await AlmacenNegocio.borrar(g.negocio.negocio_id, fabrica)
      const nueva = await AlmacenNegocio.abrir(g.negocio.negocio_id, fabrica)
      expect(await nueva.leer()).toBeNull()

      // Se restaura desde el archivo.
      const lectura = await leerRespaldo(archivo)
      expect(lectura.ok).toBe(true)
      if (!lectura.ok) return
      await nueva.reemplazarTodo(estadoDesdeRespaldo(lectura.datos, lectura.generado_en, VERSION_ESQUEMA))
      const despues = (await nueva.leer())!

      expect(sinMeta(despues)).toEqual(sinMeta(antes))
      // 01:30 UTC del 5-oct es 4-oct en la Ciudad de México.
      expect(despues.meta.ultimo_respaldo).toBe('2026-10-04')
      const periodo = { desde: '2026-07-01', hasta: '2026-10-04' }
      expect(calcularVistas(despues.movimientos, despues.negocio, despues.productos, periodo))
        .toEqual(calcularVistas(antes.movimientos, antes.negocio, antes.productos, periodo))
      const entorno = { hoy: '2026-10-04', ultimo_respaldo: '2026-10-04' }
      expect(detectarAlertas(despues.movimientos, despues.negocio, despues.productos, entorno))
        .toEqual(detectarAlertas(antes.movimientos, antes.negocio, antes.productos, entorno))
    }, 30_000) // A2 tiene 2,228 movimientos y el IndexedDB simulado es lento
  }
})

describe('validación del archivo de respaldo', () => {
  async function respaldoA1() {
    const fabrica = new IDBFactory()
    const { almacen } = await cargar(fabrica, 'A1')
    return { almacen, texto: await crearRespaldo((await almacen.leer())!, '2026-10-05T01:30:00Z') }
  }

  it('es JSON legible con formato, versión, conteos y huella (RNF-11)', async () => {
    const { texto } = await respaldoA1()
    const archivo = JSON.parse(texto)
    expect(archivo.formato).toBe('elchalan-respaldo')
    expect(archivo.version).toBe(1)
    expect(archivo.huella).toMatch(/^[0-9a-f]{64}$/)
    expect(archivo.conteos.movimientos).toBe(archivo.datos.movimientos.length)
  })

  it('rechaza un archivo modificado', async () => {
    const { texto } = await respaldoA1()
    const archivo = JSON.parse(texto)
    archivo.datos.movimientos[3].monto_centavos += 100
    const r = await leerRespaldo(JSON.stringify(archivo))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores).toContain('El archivo está dañado o fue modificado.')
  })

  it('rechaza un archivo incompleto, ajeno o de una versión más nueva', async () => {
    const { texto } = await respaldoA1()
    const corto = JSON.parse(texto)
    corto.datos.movimientos.pop()
    expect((await leerRespaldo(JSON.stringify(corto))).ok).toBe(false)
    expect((await leerRespaldo('no es json')).ok).toBe(false)
    expect((await leerRespaldo('{"formato":"otro"}')).ok).toBe(false)
    const futuro = JSON.parse(texto)
    futuro.version = 99
    const r = await leerRespaldo(JSON.stringify(futuro))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores[0]).toMatch(/versión más nueva/)
  })

  it('si restaurar falla a la mitad, se queda lo que había', async () => {
    const { almacen, texto } = await respaldoA1()
    const antes = await almacen.leer()
    const lectura = await leerRespaldo(texto)
    if (!lectura.ok) throw new Error('debería leerse')
    const estado = estadoDesdeRespaldo(lectura.datos, lectura.generado_en, VERSION_ESQUEMA)
    estado.movimientos = [...estado.movimientos, estado.movimientos[0]] // id repetido
    await expect(almacen.reemplazarTodo(estado)).rejects.toThrow()
    expect(await almacen.leer()).toEqual(antes)
  })

  it('nombra el archivo con el negocio y la fecha', async () => {
    const { almacen } = await respaldoA1()
    const negocio = (await almacen.leer())!.negocio
    expect(nombreArchivo({ ...negocio, nombre: 'Café Doña Chela' }, '2026-10-27')).toBe('ElChalan_Cafe-Dona-Chela_2026-10-27.json')
  })
})
