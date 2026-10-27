// Almacenamiento persistente del navegador (RNF-09, spike S-2): se pide al abrir y
// lo que conteste alimenta el aviso AN-18.

export interface EstadoAlmacenamiento {
  persistente: boolean
  uso_pct?: number
}

/** Pide que el navegador no borre los datos y reporta cómo quedó. */
export async function pedirPersistencia(storage: StorageManager | undefined = globalThis.navigator?.storage): Promise<EstadoAlmacenamiento> {
  if (!storage?.persist) return { persistente: false }
  const persistente = (await storage.persisted()) || (await storage.persist())
  const { usage, quota } = storage.estimate ? await storage.estimate() : {}
  return quota ? { persistente, uso_pct: Math.round(((usage ?? 0) / quota) * 100) } : { persistente }
}
