// Corregir y anular por inserción (CH-04 §7.2): resuelve qué versión de cada
// movimiento está vigente sin editar ni borrar nada del registro.

import type { Movimiento, Uuid } from './tipos.ts'

export interface Versiones {
  /** Movimientos vigentes (ni sustituidos ni anulados), en el orden del registro. */
  vigentes: Movimiento[]
  porId: Map<Uuid, Movimiento>
  /** id de cualquier versión → id del alta original. */
  raiz: Map<Uuid, Uuid>
  /** id del alta original → versión vigente, o `null` si se anuló. */
  vigenteDeRaiz: Map<Uuid, Movimiento | null>
  /** id de una versión → id del movimiento que la corrigió o anuló. */
  sustituidaPor: Map<Uuid, Uuid>
}

export function resolverVersiones(registro: readonly Movimiento[]): Versiones {
  const porId = new Map<Uuid, Movimiento>()
  const raiz = new Map<Uuid, Uuid>()
  const vigenteDeRaiz = new Map<Uuid, Movimiento | null>()
  const sustituidaPor = new Map<Uuid, Uuid>()

  for (const m of registro) {
    porId.set(m.movimiento_id, m)
    if (m.operacion === 'alta') {
      raiz.set(m.movimiento_id, m.movimiento_id)
      vigenteDeRaiz.set(m.movimiento_id, m)
      continue
    }
    const objetivo = m.corrige_a
    // Un registro que apunta a algo inexistente o ya sustituido no cambia nada:
    // el dominio lo impide al crear (§7.2), aquí solo se ignora.
    if (!objetivo || !raiz.has(objetivo) || sustituidaPor.has(objetivo)) continue
    const r = raiz.get(objetivo)!
    raiz.set(m.movimiento_id, r)
    sustituidaPor.set(objetivo, m.movimiento_id)
    vigenteDeRaiz.set(r, m.operacion === 'correccion' ? m : null)
  }

  const idsVigentes = new Set<Uuid>()
  for (const m of vigenteDeRaiz.values()) if (m) idsVigentes.add(m.movimiento_id)
  const vigentes = registro.filter((m) => idsVigentes.has(m.movimiento_id))

  return { vigentes, porId, raiz, vigenteDeRaiz, sustituidaPor }
}

/** La versión vigente a la que apunta un id de cualquier versión (para `origen_id`). */
export function vigenteDe(versiones: Versiones, id: Uuid | undefined): Movimiento | null {
  if (!id) return null
  const r = versiones.raiz.get(id)
  return r ? versiones.vigenteDeRaiz.get(r) ?? null : null
}

/** Todas las versiones de un movimiento, de la original a la última (para «Ver historia»). */
export function historiaDe(versiones: Versiones, id: Uuid): Movimiento[] {
  const r = versiones.raiz.get(id)
  if (!r) return []
  const cadena: Movimiento[] = []
  let actual: Uuid | undefined = r
  while (actual) {
    const m = versiones.porId.get(actual)
    if (!m) break
    cadena.push(m)
    actual = versiones.sustituidaPor.get(actual)
  }
  return cadena
}
