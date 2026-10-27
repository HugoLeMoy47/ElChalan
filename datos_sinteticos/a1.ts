// A1 · Reventa a mayoreo («PE420 sintético», CH-08 §3). Nombres y cifras inventados.

import type { CategoriaGasto, MedioPago, Producto, Renglon, Tercero, Uuid } from '../src/dominio/tipos.ts'
import { costoLinea, diaSemana, Generador, importeLinea, masDias, type DatosAlta } from './comun.ts'

export const A1 = {
  id: 'A1',
  semilla: 20260706,
  inicio: '2026-07-06',
  fin: '2026-10-04', // 13 semanas
  capital: 1_500_000,
}

const CATEGORIAS = ['Bolsas', 'Gorras', 'Termos', 'Llaveros', 'Encendedores', 'Estuches']
const NOMBRES = ['Clásico', 'Mini', 'Grande', 'Pro', 'Eco', 'Plus', 'Viaje', 'Doble']
const COLORES = ['negro', 'verde', 'rojo', 'azul', 'arena', 'blanco']
const CLIENTES = [
  'Abarrotes Doña Chela', 'Tienda La Esquina', 'Novedades Rubí', 'Bazar del Centro',
  'Kiosco Memo', 'Mercería Tere', 'Regalos Lalo', 'Puesto de Ramiro',
  'Tianguis Paco', 'Accesorios Nena', 'Mini súper Toño', 'Variedades Lupita',
]

type Linea = Omit<Renglon, 'renglon_id' | 'movimiento_id'>

export function generarA1() {
  const g = new Generador(A1.semilla, {
    nombre: 'Mayoreo Ejemplo (A1)', giro: 'reventa', nivel: 1, moneda: 'MXN',
    zona_horaria: 'America/Mexico_City', inicio_operaciones: A1.inicio,
    capital_inicial_centavos: A1.capital, segmento_por_omision: 'mayoreo',
  }, A1.inicio)
  const az = g.azar

  // ── Catálogo: 140 productos; 3 sin costo (AN-06) ─────────────────────────
  const sinCosto = new Set([118, 129, 137])
  const catalogo: Producto[] = []
  for (let i = 0; i < 140; i++) {
    const etiqueta = i < 40 ? 'A' : 'B'
    const costo = az.entero(40, 300) * 50 // $20 a $150
    const factor = etiqueta === 'A' ? 125 + az.entero(0, 25) : 150 + az.entero(0, 40)
    const p = g.nuevoProducto({
      clave: `CAT-${String(i + 1).padStart(4, '0')}`,
      nombre: `${CATEGORIAS[i % 6].replace(/s$/, '').replace(/e$/, '')} ${NOMBRES[i % 8]} ${Math.floor(i / 48) + 1}`,
      categoria: CATEGORIAS[i % 6],
      variante: COLORES[i % 6],
      unidad_medida: 'pieza',
      precio_venta_centavos: Math.round((costo * factor) / 100 / 500) * 500,
      precio_referencia_centavos: Math.round((costo * (160 + az.entero(0, 60))) / 100 / 100) * 100,
      etiquetas: [etiqueta],
    })
    if (!sinCosto.has(i)) p.costo_centavos = costo
    catalogo.push(p)
  }
  // Pareto: el 20 % de los productos (28) se lleva el 70 % de los renglones.
  const pesos = catalogo.map((_, i) => (i < 28 ? 0.7 / 28 : 0.3 / 112))

  const proveedores = [g.nuevoTercero('Distribuidora Norte', 'proveedor'), g.nuevoTercero('Mayorista Sur', 'proveedor'), g.nuevoTercero('Importadora Lago', 'proveedor')]
  const clientes: Tercero[] = CLIENTES.map((n) => g.nuevoTercero(n, 'cliente'))
  const pesosClientes = clientes.map((_, i) => (i < 8 ? 3 : 1))

  const existencia = new Map<Uuid, number>(catalogo.map((p) => [p.producto_id, 0]))
  const agenda = new Map<string, (() => void)[]>()
  const programar = (dia: string, f: () => void) => {
    if (dia > A1.fin) return
    agenda.set(dia, [...(agenda.get(dia) ?? []), f])
  }

  // Cuotas de casos especiales (escenarios T-xx y anomalías).
  const cuotas = { cobroParcial: 1, cobroDeMas: 1, gastoAtipico: 1 }
  // Casos fijos sobre la n-ésima venta de contado «limpia» (T-05, T-06, T-07, AN-10).
  const CASOS: Record<number, 'correccion' | 'anulacion' | 'devolucion' | 'devolucion_mayor'> = {
    8: 'correccion', 30: 'correccion', 55: 'correccion', 15: 'anulacion', 45: 'anulacion',
    12: 'devolucion', 25: 'devolucion', 40: 'devolucion', 60: 'devolucion_mayor',
  }
  let contadoLimpias = 0
  let creditos = 0
  /** Lo que hay en el banco, para pagar compras por transferencia solo si alcanza. */
  let banco = 0

  // ── Compras ─────────────────────────────────────────────────────────────
  function comprar(dia: string, renglonesMin: number, renglonesMax: number) {
    const elegidos = new Set<Producto>()
    const n = az.entero(renglonesMin, renglonesMax)
    // Primero lo que se está acabando (los de más rotación antes), luego por rotación.
    const meta = (p: Producto) => (p.etiquetas[0] === 'A' ? 16_000 : 5_000)
    for (const p of catalogo) if (elegidos.size < n && existencia.get(p.producto_id)! < meta(p) / 2) elegidos.add(p)
    while (elegidos.size < renglonesMin) elegidos.add(az.elegirPesado(catalogo, pesos))

    const lineas: Linea[] = []
    const efectoExistencia: Record<Uuid, number> = {}
    const cambiosCosto: string[] = []
    for (const p of elegidos) {
      const cantidad = Math.max(1_000, meta(p) - Math.max(0, existencia.get(p.producto_id)!))
      let costo = p.costo_centavos ?? az.entero(40, 300) * 50
      // AN-20: el proveedor cambió el precio (6 % de los renglones).
      const cambio = p.costo_centavos !== undefined && az.probabilidad(0.06)
      if (cambio) costo = Math.round((costo * (100 + az.elegir([-12, -8, 7, 10, 15]))) / 100 / 10) * 10
      lineas.push({ producto_id: p.producto_id, cantidad_milesimas: cantidad, unidad_medida: 'pieza', precio_unitario_centavos: costo, importe_centavos: costoLinea(cantidad, costo) })
      efectoExistencia[p.producto_id] = cantidad
      if (cambio) {
        // «¿Actualizo el costo?» (D-50): Sí, No o Usar el promedio (D-53).
        const decision = az.elegirPesado(['si', 'no', 'promedio'], [4, 3, 3])
        const exist = existencia.get(p.producto_id)!
        if (decision === 'si') p.costo_centavos = costo
        if (decision === 'promedio') {
          p.costo_centavos = exist <= 0 ? costo : Math.round((exist * p.costo_centavos! + cantidad * costo) / (exist + cantidad))
        }
        cambiosCosto.push(`${p.clave}: ${decision}`)
      }
      existencia.set(p.producto_id, existencia.get(p.producto_id)! + cantidad)
    }
    const monto = lineas.reduce((s, l) => s + l.importe_centavos, 0)
    const medio: MedioPago = banco >= monto ? 'transferencia' : 'efectivo'
    if (medio === 'transferencia') banco -= monto
    const m = g.alta({
      tipo: 'compra', fecha: dia, monto, medio, tercero: az.probabilidad(0.85) ? proveedores[0].tercero_id : az.elegir(proveedores.slice(1)).tercero_id,
      renglones: lineas, efecto: { costo: null, existencia: efectoExistencia },
    })
    if (cambiosCosto.length) g.alerta('AN-20', m.movimiento_id, cambiosCosto.join('; '))
  }

  // ── Ventas ──────────────────────────────────────────────────────────────
  function vender(dia: string) {
    const lineas: Linea[] = []
    const efectoExistencia: Record<Uuid, number> = {}
    let costoTotal: number | null = 0
    let costoConocido = 0
    let bajoCosto = false
    const usados = new Set<Producto>()
    for (let k = az.entero(1, 5); k > 0; k--) {
      const p = az.elegirPesado(catalogo, pesos)
      if (usados.has(p)) continue
      let cantidad = az.entero(1, 6) * 1000
      const hay = existencia.get(p.producto_id)!
      if (cantidad > hay) {
        // AN-11: casi siempre se vende lo que hay; a veces se olvidó anotar una compra.
        if (!az.probabilidad(0.04)) cantidad = Math.max(0, Math.floor(hay / 1000) * 1000)
      }
      if (cantidad === 0) continue
      usados.add(p)
      let precio = p.precio_venta_centavos!
      if (p.costo_centavos !== undefined && az.probabilidad(0.02)) {
        precio = Math.round((p.costo_centavos * 0.9) / 100) * 100 // AN-14: remate bajo el costo
        bajoCosto = true
      }
      const linea: Linea = { producto_id: p.producto_id, cantidad_milesimas: cantidad, unidad_medida: 'pieza', precio_unitario_centavos: precio, importe_centavos: importeLinea(cantidad, precio) }
      if (p.costo_centavos !== undefined) {
        linea.costo_unitario_centavos = p.costo_centavos // D-50: copia del catálogo
        costoConocido += costoLinea(cantidad, p.costo_centavos)
        if (costoTotal !== null) costoTotal += costoLinea(cantidad, p.costo_centavos)
      } else {
        costoTotal = null
      }
      lineas.push(linea)
      efectoExistencia[p.producto_id] = -cantidad
      existencia.set(p.producto_id, hay - cantidad)
    }
    if (!lineas.length) return

    const suma = lineas.reduce((s, l) => s + l.importe_centavos, 0)
    let monto = suma
    const pendientes: DatosAlta['pendientes'] = []
    if (costoTotal === null) pendientes.push('sin_costo')
    // AN-08: «redondeé el total» (2 %).
    const noCuadra = az.probabilidad(0.02)
    if (noCuadra) {
      monto = Math.floor(suma / 1000) * 1000
      if (monto === suma) monto -= 500
      pendientes.push('monto_no_cuadra')
    }

    const cliente = az.elegirPesado(clientes, pesosClientes)
    const credito = az.probabilidad(0.4)
    let promesa: string | undefined
    if (credito) {
      if (az.probabilidad(0.075)) pendientes.unshift('sin_fecha_promesa') // AN-07
      else promesa = masDias(dia, az.entero(7, 30))
    }
    const medio: MedioPago = credito ? 'efectivo' : az.elegirPesado(['efectivo', 'transferencia', 'tarjeta'], [5, 4, 1])
    const datos: DatosAlta = {
      tipo: 'venta', fecha: dia, monto, medio, condicion: credito ? 'credito' : 'contado', tercero: cliente.tercero_id,
      promesa, renglones: lineas, pendientes,
      efecto: { condicion: credito ? 'credito' : 'contado', tercero: cliente.tercero_id, promesa, costo: costoTotal, costoConocido, existencia: efectoExistencia },
    }
    const reloj = az.probabilidad(0.01) // AN-16
    const venta = g.alta(datos, { relojAtrasado: reloj })
    if (!credito && medio !== 'efectivo') banco += monto
    if (reloj) g.alerta('AN-16', venta.movimiento_id)
    if (costoTotal === null) g.alerta('AN-06', venta.movimiento_id)
    if (noCuadra) g.alerta('AN-08', venta.movimiento_id)
    if (bajoCosto) g.alerta('AN-14', venta.movimiento_id)
    if (pendientes.includes('sin_fecha_promesa')) g.alerta('AN-07', venta.movimiento_id)

    // AN-04 / T-18: la misma venta capturada dos veces seguidas (2 %); la mitad se anula al otro día.
    if (az.probabilidad(0.02)) {
      for (const [pid, c] of Object.entries(efectoExistencia)) existencia.set(pid, existencia.get(pid)! + c)
      const dup = g.alta(datos, { inmediato: true })
      g.alerta('AN-04', dup.movimiento_id)
      // La copia trae las mismas fallas que la original (menos el reloj, que ya va bien).
      for (const al of g.alertas.filter((x) => x.objeto_id === venta.movimiento_id && x.codigo !== 'AN-16')) {
        g.alerta(al.codigo, dup.movimiento_id)
      }
      if (az.probabilidad(0.5)) {
        programar(masDias(dia, 1), () => {
          g.anular(dup.movimiento_id, 'Se capturó dos veces')
          for (const [pid, c] of Object.entries(efectoExistencia)) existencia.set(pid, existencia.get(pid)! - c)
        })
      }
    }

    const raiz = venta.movimiento_id
    if (credito) {
      // D-59: un cliente devuelve una pieza de una venta a crédito con penalización;
      // lo reconocido baja su deuda y después paga el resto.
      if (++creditos === 6 && !noCuadra) {
        const l = lineas[0]
        const pieza = importeLinea(1000, l.precio_unitario_centavos!)
        const reconocido = pieza - Math.round(pieza / 2)
        programar(masDias(dia, 2), () => { devolver(raiz, l, 1000, medio, cliente.tercero_id, true) })
        programarCobro(raiz, { ...datos, monto: monto - reconocido }, cliente.tercero_id)
        return
      }
      programarCobro(raiz, datos, cliente.tercero_id)
      return
    }
    // Casos sobre ventas de contado: corrección (T-05), anulación (T-06), devolución (T-07, AN-10).
    if (noCuadra || bajoCosto || reloj) return
    const caso = CASOS[++contadoLimpias]
    if (caso === 'correccion') {
      programar(masDias(dia, 1), () => {
        const nuevas = lineas.map((l, i) => i === 0 ? { ...l, precio_unitario_centavos: l.precio_unitario_centavos! + 500, importe_centavos: importeLinea(l.cantidad_milesimas, l.precio_unitario_centavos! + 500) } : l)
        const nuevoMonto = nuevas.reduce((s, l) => s + l.importe_centavos, 0)
        g.corregir(raiz, { ...datos, monto: nuevoMonto, renglones: nuevas, efecto: { ...datos.efecto } })
      })
    } else if (caso === 'anulacion') {
      programar(masDias(dia, az.entero(1, 3)), () => {
        g.anular(raiz, 'Error de captura')
        for (const [pid, c] of Object.entries(efectoExistencia)) existencia.set(pid, existencia.get(pid)! - c)
      })
    } else if (caso === 'devolucion' || caso === 'devolucion_mayor') {
      const mayor = caso === 'devolucion_mayor'
      const l = lineas[0]
      const cantidad = mayor ? l.cantidad_milesimas + 1000 : 1000
      // La primera devolución va sin penalización; las demás, con la de costumbre (50 %, D-60).
      const penaliza = !mayor && contadoLimpias > 12
      programar(masDias(dia, az.entero(1, 5)), () => {
        const dev = devolver(raiz, l, cantidad, medio, cliente.tercero_id, penaliza)
        if (mayor) g.alerta('AN-10', dev.movimiento_id)
      })
    }
  }

  /** Devolución de una pieza o más de un renglón; con penalización, el negocio se queda el 50 % (D-60). */
  function devolver(raiz: Uuid, l: Linea, cantidad: number, medio: MedioPago, tercero: Uuid, penaliza: boolean) {
    const importe = importeLinea(cantidad, l.precio_unitario_centavos!)
    const penalizacion = penaliza ? Math.round(importe / 2) : 0
    const dl: Linea = { ...l, cantidad_milesimas: cantidad, importe_centavos: importe }
    const costoDev = l.costo_unitario_centavos !== undefined ? costoLinea(cantidad, l.costo_unitario_centavos) : null
    const dev = g.alta({
      tipo: 'devolucion_venta', fecha: diaHoy, monto: importe, medio, origen: raiz,
      penalizacion: penalizacion || undefined, tercero, renglones: [dl],
      efecto: { aplicaA: raiz, costo: costoDev, penalizacion, existencia: { [l.producto_id!]: cantidad } },
    })
    existencia.set(l.producto_id!, existencia.get(l.producto_id!)! + cantidad)
    if (medio !== 'efectivo') banco -= importe - penalizacion
    return { movimiento_id: dev.movimiento_id, reconocido: importe - penalizacion }
  }

  /** AN-11: se vende más de lo que consta (se olvidó anotar una compra). */
  function venderDeMas(dia: string) {
    const p = catalogo[100]
    const cantidad = Math.max(0, existencia.get(p.producto_id)!) + 3_000
    const precio = p.precio_venta_centavos!
    g.alta({
      tipo: 'venta', fecha: dia, monto: importeLinea(cantidad, precio), condicion: 'contado', tercero: clientes[0].tercero_id,
      renglones: [{ producto_id: p.producto_id, cantidad_milesimas: cantidad, unidad_medida: 'pieza', precio_unitario_centavos: precio, costo_unitario_centavos: p.costo_centavos, importe_centavos: importeLinea(cantidad, precio) }],
      efecto: { condicion: 'contado', tercero: clientes[0].tercero_id, costo: costoLinea(cantidad, p.costo_centavos!), existencia: { [p.producto_id]: -cantidad } },
    })
    existencia.set(p.producto_id, existencia.get(p.producto_id)! - cantidad)
  }

  function programarCobro(raiz: Uuid, venta: DatosAlta, tercero: Uuid) {
    const promesa = venta.promesa ?? masDias(venta.fecha, 30)
    if (az.probabilidad(0.08)) return // moroso: no paga (T-04)
    const dia = masDias(promesa, az.entero(-4, 3))
    const cobrar = (monto: number) => {
      const medio: MedioPago = az.probabilidad(0.5) ? 'transferencia' : 'efectivo'
      if (medio === 'transferencia') banco += monto
      const c = g.alta({
        tipo: 'cobro', fecha: diaHoy, monto, medio,
        origen: raiz, tercero, efecto: { aplicaA: raiz, costo: null, existencia: {} },
      })
      return c
    }
    if (cuotas.cobroParcial > 0 && az.probabilidad(0.1)) {
      cuotas.cobroParcial-- // T-03: paga la mitad y el resto nunca
      programar(dia < venta.fecha ? venta.fecha : dia, () => cobrar(Math.round(venta.monto / 2 / 100) * 100))
      return
    }
    if (cuotas.cobroDeMas > 0 && az.probabilidad(0.05)) {
      cuotas.cobroDeMas-- // AN-09: le cobré de más
      programar(dia < venta.fecha ? venta.fecha : dia, () => {
        const c = cobrar(venta.monto + 5_000)
        g.alerta('AN-09', c.movimiento_id)
      })
      return
    }
    programar(dia < venta.fecha ? venta.fecha : dia, () => cobrar(venta.monto))
  }

  function gastar(dia: string, monto: number, categoria: CategoriaGasto, atipico = false) {
    const sinCategoria = !atipico && az.probabilidad(0.35) // AN-05
    const m = g.alta({
      tipo: 'gasto', fecha: dia, monto, medio: az.probabilidad(0.7) ? 'efectivo' : 'transferencia',
      categoria: sinCategoria ? undefined : categoria, pendientes: sinCategoria ? ['sin_categoria'] : [],
      efecto: { categoria: sinCategoria ? undefined : categoria, costo: null, existencia: {} },
    })
    if (sinCategoria) g.alerta('AN-05', m.movimiento_id)
    if (atipico) g.alerta('AN-03', m.movimiento_id)
  }

  // ── Inventario con el que se empieza: un conteo, sin dinero ──────────────
  g.horaDeCaptura(A1.inicio, -60)
  const inicial: Linea[] = catalogo.map((p) => ({
    producto_id: p.producto_id, cantidad_milesimas: az.entero(p.etiquetas[0] === 'A' ? 6 : 1, p.etiquetas[0] === 'A' ? 20 : 6) * 1000,
    unidad_medida: 'pieza', importe_centavos: 0,
  }))
  for (const l of inicial) existencia.set(l.producto_id!, l.cantidad_milesimas)
  g.alta({
    tipo: 'ajuste_existencia', fecha: A1.inicio, monto: 0, concepto: 'inventario inicial', renglones: inicial,
    efecto: { costo: null, existencia: Object.fromEntries(inicial.map((l) => [l.producto_id!, l.cantidad_milesimas])) },
  })

  // ── Día por día ─────────────────────────────────────────────────────────
  let diaHoy = A1.inicio
  for (let dia = A1.inicio, semana = 0; dia <= A1.fin; dia = masDias(dia, 1)) {
    diaHoy = dia
    const ds = diaSemana(dia)
    if (ds === 0 && dia !== A1.inicio) semana++
    g.horaDeCaptura(dia, 0)

    if (ds === 0) comprar(dia, 8, 25) // pedido semanal
    if (ds === 3 && semana % 3 === 2) comprar(dia, 4, 10) // reposición cada 3 semanas
    for (const f of agenda.get(dia) ?? []) f()

    if (ds <= 5) {
      const ventasDelDia = az.entero(1, 3)
      for (let k = 0; k < ventasDelDia; k++) vender(dia)
    }
    if (ds === 1 || ds === 4) {
      gastar(dia, az.entero(15, 60) * 1000, az.elegir(['transporte', 'empaque'] as const))
    }
    if (ds === 5) gastar(dia, az.entero(10, 40) * 1000, 'comisiones')
    if (ds === 2 && semana === 10) venderDeMas(dia)
    if (ds === 2 && semana === 6 && cuotas.gastoAtipico-- > 0) gastar(dia, 900_000, 'transporte', true) // AN-03
    if (ds === 5 && [3, 7, 11].includes(semana)) {
      g.alta({ tipo: 'retiro', fecha: dia, monto: az.entero(15, 30) * 10_000, efecto: { costo: null, existencia: {} } })
    }
    // AN-01: intento con fecha futura, rechazado al capturar (no entra al registro).
    if (az.probabilidad(0.01)) {
      g.rechazados.push({ codigo: 'AN-01', tipo: 'venta', fecha: masDias(dia, az.entero(2, 9)), monto_centavos: az.entero(5, 50) * 10_000, hoy: dia })
    }
  }

  // AN-11 se evalúa sobre el estado final de la bodega.
  for (const p of catalogo) {
    if (existencia.get(p.producto_id)! < 0) {
      g.alerta('AN-11', p.producto_id)
    }
  }
  return g
}
