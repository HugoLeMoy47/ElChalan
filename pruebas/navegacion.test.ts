// UX-01: el botón atrás de Android dentro de la app.

import { describe, expect, it } from 'vitest'
import { Navegacion, type Historia } from '../src/interfaz/navegacion.ts'

type P = 'inicio' | 'bienvenida' | 'anotar' | 'captura' | 'movimientos' | 'detalle'

/** Un historial de navegador simulado: los saltos llegan como «atrás» después y, como en
 *  Chrome, su destino se fija al pedirlos (no al llegar). */
function navegador() {
  let entradas = 1
  let posicion = 0
  const pendientes: number[] = []
  const historia: Historia = {
    pushState: () => { entradas = posicion + 2; posicion++ },
    replaceState: () => {},
    go: (n) => pendientes.push(posicion + n),
  }
  const pantallas: P[] = []
  const nav = new Navegacion<P>(historia, 'inicio', ['inicio', 'bienvenida'], (p) => pantallas.push(p))
  /** Procesa los saltos pendientes, como hace el navegador. */
  const procesar = () => {
    while (pendientes.length) {
      const destino = Math.max(0, Math.min(entradas - 1, pendientes.shift()!))
      if (destino !== posicion) {
        posicion = destino
        nav.alIrAtras()
      }
    }
  }
  /** El usuario toca atrás. Devuelve false si saldría de la app. */
  const atras = () => {
    if (posicion === 0) return false
    posicion--
    nav.alIrAtras()
    procesar()
    return true
  }
  return { nav, atras, procesar, pantallas, posicion: () => posicion }
}

describe('botón atrás', () => {
  it('regresa pantalla por pantalla y en el inicio sale de la app', () => {
    const n = navegador()
    n.nav.ir('anotar')
    n.nav.ir('captura')
    expect(n.atras()).toBe(true)
    expect(n.nav.actual).toBe('anotar')
    expect(n.atras()).toBe(true)
    expect(n.nav.actual).toBe('inicio')
    expect(n.atras()).toBe(false) // sale
  })

  it('después de guardar (ir al inicio) no vuelve a abrir el formulario', () => {
    const n = navegador()
    n.nav.ir('anotar')
    n.nav.ir('captura')
    n.nav.ir('inicio')
    n.procesar()
    expect(n.nav.actual).toBe('inicio')
    expect(n.posicion()).toBe(0)
    expect(n.atras()).toBe(false)
  })

  it('primero cierra la hoja abierta, después regresa', () => {
    const n = navegador()
    let abierta = true
    n.nav.ir('detalle')
    n.nav.abrirHoja(() => { abierta = false })
    expect(n.atras()).toBe(true)
    expect(abierta).toBe(false)
    expect(n.nav.actual).toBe('detalle')
    expect(n.atras()).toBe(true)
    expect(n.nav.actual).toBe('inicio')
  })

  it('una hoja en el inicio también se cierra con atrás, sin salir', () => {
    const n = navegador()
    let abierta = true
    n.nav.abrirHoja(() => { abierta = false })
    expect(n.atras()).toBe(true)
    expect(abierta).toBe(false)
    expect(n.atras()).toBe(false)
  })

  it('cerrar la hoja con su botón quita su entrada: atrás regresa de pantalla', () => {
    const n = navegador()
    n.nav.ir('detalle')
    const id = n.nav.abrirHoja(() => {})
    n.nav.cerrarHoja(id)
    n.procesar()
    expect(n.atras()).toBe(true)
    expect(n.nav.actual).toBe('inicio')
  })

  it('«‹ Volver» y luego anular desde una hoja: termina en la pantalla anterior', () => {
    const n = navegador()
    n.nav.ir('movimientos')
    n.nav.ir('detalle')
    const id = n.nav.abrirHoja(() => {})
    n.nav.cerrarHoja(id) // se confirma la anulación y la hoja se cierra
    n.nav.atras() // regresa a movimientos
    n.procesar()
    expect(n.nav.actual).toBe('movimientos')
    expect(n.atras()).toBe(true)
    expect(n.nav.actual).toBe('inicio')
  })

  it('ir a una pantalla con una hoja abierta reutiliza su entrada', () => {
    const n = navegador()
    n.nav.ir('detalle')
    n.nav.abrirHoja(() => {})
    n.nav.ir('movimientos')
    expect(n.posicion()).toBe(2)
    expect(n.atras()).toBe(true)
    expect(n.nav.actual).toBe('detalle')
  })

  it('las pestañas no se apilan: atrás desde cualquiera vuelve al inicio', () => {
    const n = navegador()
    n.nav.pestana('movimientos')
    n.nav.ir('detalle')
    n.nav.pestana('anotar')
    n.procesar()
    expect(n.posicion()).toBe(1)
    expect(n.atras()).toBe(true)
    expect(n.nav.actual).toBe('inicio')
    expect(n.atras()).toBe(false)
  })

  it('la pestaña Inicio regresa a la raíz', () => {
    const n = navegador()
    n.nav.pestana('movimientos')
    n.nav.pestana('inicio')
    n.procesar()
    expect(n.posicion()).toBe(0)
    expect(n.nav.actual).toBe('inicio')
  })

  it('ir al inicio y enseguida a otra pantalla no desordena el historial', () => {
    const n = navegador()
    n.nav.ir('anotar') // por ejemplo, el asistente encima del inicio
    n.nav.pestana('inicio') // el salto atrás del historial todavía no llega…
    n.nav.ir('captura') // …y ya se abre la primera venta
    n.procesar()
    expect(n.posicion()).toBe(1)
    expect(n.nav.actual).toBe('captura')
    expect(n.atras()).toBe(true)
    expect(n.nav.actual).toBe('inicio')
    expect(n.atras()).toBe(false)
  })

  it('«‹ Volver» en una raíz no hace nada', () => {
    const n = navegador()
    n.nav.atras()
    n.procesar()
    expect(n.nav.actual).toBe('inicio')
  })
})
