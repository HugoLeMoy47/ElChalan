// A2 · Puesto de mercado de frutas y verduras (CH-08 §4). Sin catálogo,
// kilos con decimales, todo de contado y sin cliente. Datos inventados.

import type { CategoriaGasto, Renglon } from '../src/dominio/tipos.ts'
import { diaSemana, Generador, importeLinea, masDias, type DatosAlta } from './comun.ts'

export const A2 = {
  id: 'A2',
  semilla: 20260803,
  inicio: '2026-08-03',
  fin: '2026-09-27', // 8 semanas
  capital: 500_000,
  /** Semana (0-7) cuyo sábado y domingo se capturaron el lunes. */
  semanaAtrasada: 4,
}

/** Precio por kilo en centavos. */
const PRODUCTOS: [string, number][] = [
  ['jitomate', 2_800], ['cebolla', 2_400], ['aguacate', 6_500], ['limón', 3_000],
  ['chile serrano', 4_000], ['papa', 2_600], ['zanahoria', 1_800], ['plátano', 2_200],
  ['manzana', 4_500], ['naranja', 1_600], ['calabacita', 2_500], ['pepino', 2_000],
]

type Linea = Omit<Renglon, 'renglon_id' | 'movimiento_id'>
const sinEfecto = { costo: null, existencia: {} }

export function generarA2() {
  const g = new Generador(A2.semilla, {
    nombre: 'Puesto Ejemplo (A2)', giro: 'comida', nivel: 1, moneda: 'MXN',
    zona_horaria: 'America/Mexico_City', inicio_operaciones: A2.inicio,
    capital_inicial_centavos: A2.capital, segmento_por_omision: 'menudeo',
  }, A2.inicio)
  const az = g.azar
  let gastoAtipico = 1

  function anotar(datos: DatosAlta) {
    const reloj = az.probabilidad(0.01) // AN-16
    const m = g.alta(datos, { relojAtrasado: reloj })
    if (reloj) g.alerta('AN-16', m.movimiento_id)
    if (datos.pendientes?.includes('sin_categoria')) g.alerta('AN-05', m.movimiento_id)
    // AN-04: la misma venta dos veces seguidas (2 %); la mitad se anula enseguida.
    if (datos.tipo === 'venta' && az.probabilidad(0.02)) {
      const dup = g.alta(datos)
      g.alerta('AN-04', dup.movimiento_id)
      if (az.probabilidad(0.5)) g.anular(dup.movimiento_id, 'Se capturó dos veces')
    }
    return m
  }

  function venta(dia: string) {
    const lineas: Linea[] = []
    const usados = new Set<string>()
    for (let k = az.entero(1, 3); k > 0; k--) {
      const [nombre, precio] = az.elegir(PRODUCTOS)
      if (usados.has(nombre)) continue
      usados.add(nombre)
      // Lo que marca la báscula, en múltiplos de 5 gramos (D-52).
      const kilos = az.probabilidad(0.6) ? az.elegir([500, 750, 1000, 1250, 1500, 2000, 2750, 3000]) : az.entero(50, 600) * 5
      lineas.push({ descripcion: nombre, cantidad_milesimas: kilos, unidad_medida: 'kilo', precio_unitario_centavos: precio, importe_centavos: importeLinea(kilos, precio) })
    }
    const monto = lineas.reduce((s, l) => s + l.importe_centavos, 0)
    const medio = az.probabilidad(0.9) ? 'efectivo' : 'transferencia'
    anotar({ tipo: 'venta', fecha: dia, monto, medio, condicion: 'contado', renglones: lineas, efecto: { condicion: 'contado', costo: null, existencia: {} } })
  }

  function gasto(dia: string, monto: number, categoria: CategoriaGasto, atipico = false) {
    const sinCategoria = !atipico && az.probabilidad(0.05) // AN-05
    const m = anotar({
      tipo: 'gasto', fecha: dia, monto, categoria: sinCategoria ? undefined : categoria,
      pendientes: sinCategoria ? ['sin_categoria'] : [], efecto: { ...sinEfecto, categoria: sinCategoria ? undefined : categoria },
    })
    if (atipico) g.alerta('AN-03', m.movimiento_id)
  }

  function compra(dia: string) {
    const lineas: Linea[] = []
    for (const [nombre, precio] of PRODUCTOS) {
      if (!az.probabilidad(0.7)) continue
      const kilos = az.entero(20, 70) * 1000
      const costo = Math.round((precio * az.entero(55, 70)) / 100 / 10) * 10
      lineas.push({ descripcion: nombre, cantidad_milesimas: kilos, unidad_medida: 'kilo', precio_unitario_centavos: costo, importe_centavos: importeLinea(kilos, costo) })
    }
    const monto = lineas.reduce((s, l) => s + l.importe_centavos, 0)
    anotar({ tipo: 'compra', fecha: dia, monto, renglones: lineas, efecto: sinEfecto })
  }

  function merma(dia: string) {
    const [nombre] = az.elegir(PRODUCTOS)
    anotar({
      tipo: 'ajuste_existencia', fecha: dia, monto: 0, concepto: 'merma',
      renglones: [{ descripcion: nombre, cantidad_milesimas: -az.entero(2, 16) * 250, unidad_medida: 'kilo', importe_centavos: 0 }],
      efecto: sinEfecto,
    })
  }

  function jornada(dia: string) {
    const ds = diaSemana(dia)
    if (ds === 0) return // el lunes no se pone
    if (ds === 1 || ds === 4) compra(dia) // central de abasto, martes y viernes
    gasto(dia, 5_000, 'renta') // piso del mercado
    gasto(dia, az.entero(3, 8) * 1_000, 'empaque') // bolsas
    if (az.probabilidad(0.5)) gasto(dia, az.entero(4, 8) * 1_000, 'otros') // hielo
    if (ds === 1 || ds === 4) gasto(dia, az.entero(15, 25) * 1_000, 'transporte')
    for (let n = az.entero(25, 60); n > 0; n--) venta(dia)
    if (ds === 3 || ds === 6) merma(dia)
    if (ds === 2 && dia > masDias(A2.inicio, 20) && gastoAtipico-- > 0) gasto(dia, 350_000, 'transporte', true) // AN-03
    if (az.probabilidad(0.01)) {
      g.rechazados.push({ codigo: 'AN-01', tipo: 'venta', fecha: masDias(dia, az.entero(2, 9)), monto_centavos: az.entero(2, 20) * 1_000, hoy: dia })
    }
  }

  for (let dia = A2.inicio, semana = 0; dia <= A2.fin; dia = masDias(dia, 1)) {
    const ds = diaSemana(dia)
    if (ds === 0 && dia !== A2.inicio) semana++
    if (semana === A2.semanaAtrasada && ds >= 5) continue // se capturan el lunes
    g.horaDeCaptura(dia, 0)
    if (semana === A2.semanaAtrasada + 1 && ds === 0) {
      // Lunes: se anota lo del sábado y el domingo (fecha del hecho atrasada).
      jornada(masDias(dia, -2))
      jornada(masDias(dia, -1))
    }
    jornada(dia)
    if (ds === 6 && semana % 2 === 1) {
      g.alta({ tipo: 'retiro', fecha: dia, monto: az.entero(10, 25) * 10_000, efecto: sinEfecto })
    }
  }
  return g
}
