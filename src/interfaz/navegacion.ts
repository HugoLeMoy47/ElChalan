// Historial de pantallas sincronizado con el del navegador (UX-01): el gesto o botón
// «atrás» de Android cierra primero la hoja abierta, luego regresa a la pantalla
// anterior y, en una pantalla raíz (inicio, bienvenida, candado), sale de la app.
//
// La app es una sola página: cada pantalla y cada hoja abierta encima de la raíz
// ocupa una entrada del historial. Ir a una raíz (por ejemplo, al guardar una venta)
// quita las entradas sobrantes, para que «atrás» no vuelva a abrir el formulario.

export interface Historia {
  pushState(estado: unknown, titulo: string): void
  replaceState(estado: unknown, titulo: string): void
  go(pasos: number): void
}

export class Navegacion<P extends string> {
  private pila: P[]
  private hojas: { id: number; cerrar: () => void }[] = []
  /** Entradas del historial que la app agregó y siguen ahí. */
  private extra = 0
  /** Saltos del historial hechos por la app, cuyo aviso hay que ignorar. */
  private ignorar = 0
  private siguienteHoja = 0
  private readonly historia: Historia
  private readonly raices: readonly P[]
  private readonly alCambiar: (p: P) => void

  constructor(historia: Historia, inicial: P, raices: readonly P[], alCambiar: (p: P) => void) {
    this.historia = historia
    this.raices = raices
    this.alCambiar = alCambiar
    this.pila = [inicial]
    historia.replaceState({ elchalan: 0 }, '')
  }

  get actual(): P {
    return this.pila[this.pila.length - 1]
  }

  /** Va a una pantalla: las raíces reinician la pila; las demás se apilan. */
  ir(p: P): void {
    this.hojas = [] // al cambiar de pantalla, las hojas abiertas desaparecen
    if (this.raices.includes(p)) this.pila = [p]
    else if (p !== this.actual) this.pila.push(p)
    this.alCambiar(p)
    this.sincronizar()
  }

  /** Lo mismo que el botón atrás del teléfono (para «‹ Volver»). */
  atras(): void {
    if (this.hojas.length || this.pila.length > 1) this.historia.go(-1)
  }

  /** Registra una hoja abierta; devuelve su id para quitarla al cerrarse por botón. */
  abrirHoja(cerrar: () => void): number {
    const id = this.siguienteHoja++
    this.hojas.push({ id, cerrar })
    this.sincronizar()
    return id
  }

  /** La hoja se cerró por un botón (o desapareció): quita su entrada del historial. */
  cerrarHoja(id: number): void {
    const antes = this.hojas.length
    this.hojas = this.hojas.filter((h) => h.id !== id)
    if (this.hojas.length !== antes) this.sincronizar()
  }

  /** El navegador avisa que el usuario fue hacia atrás. */
  alIrAtras(): void {
    if (this.ignorar > 0) {
      this.ignorar--
      return
    }
    this.extra = Math.max(0, this.extra - 1)
    const hoja = this.hojas.pop()
    if (hoja) hoja.cerrar()
    else if (this.pila.length > 1) {
      this.pila.pop()
      this.alCambiar(this.actual)
    }
    this.sincronizar()
  }

  private sincronizar(): void {
    const deseado = this.pila.length - 1 + this.hojas.length
    while (this.extra < deseado) {
      this.extra++
      this.historia.pushState({ elchalan: this.extra }, '')
    }
    if (this.extra > deseado) {
      this.ignorar++
      this.historia.go(deseado - this.extra)
      this.extra = deseado
    }
  }
}
