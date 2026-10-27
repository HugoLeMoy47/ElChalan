// Entregar el archivo de respaldo fuera del teléfono (F-11). En Android lo útil es
// compartirlo (WhatsApp, Drive, correo); descargarlo lo deja en el mismo teléfono.
//
// Chrome en Android no comparte archivos .json (solo texto, imágenes, PDF…), así que
// si no se puede como .json se comparte el mismo contenido como .txt. Si compartir no
// existe o falla, se descarga. El contenido es el mismo JSON en los tres casos.

export type Entrega = 'compartido' | 'descargado' | 'cancelado'

export interface Plataforma {
  canShare?: (datos: ShareData) => boolean
  share?: (datos: ShareData) => Promise<void>
  descargar: (archivo: File) => void
}

export interface Resultado {
  entrega: Entrega
  /** Si compartir falló y se descargó, por qué (para el diagnóstico). */
  fallo?: string
}

export async function entregarArchivo(texto: string, nombre: string, plataforma: Plataforma): Promise<Resultado> {
  const candidatos = [
    new File([texto], nombre, { type: 'application/json' }),
    new File([texto], nombre.replace(/\.json$/, '.txt'), { type: 'text/plain' }),
  ]
  let fallo: string | undefined
  for (const archivo of candidatos) {
    if (!plataforma.share || !plataforma.canShare?.({ files: [archivo] })) continue
    try {
      await plataforma.share({ files: [archivo], title: nombre })
      return { entrega: 'compartido' }
    } catch (err) {
      const e = err as DOMException
      if (e?.name === 'AbortError') return { entrega: 'cancelado' }
      // Si el navegador rechazó compartir, otro intento también fallaría: se descarga.
      fallo = `${e?.name ?? 'Error'}: ${e?.message ?? String(err)}`
      break
    }
  }
  plataforma.descargar(candidatos[0])
  return fallo ? { entrega: 'descargado', fallo } : { entrega: 'descargado' }
}

/** Descarga en el navegador; el enlace se agrega a la página porque algunos Android lo exigen. */
export function descargarEnNavegador(archivo: File): void {
  const url = URL.createObjectURL(archivo)
  const a = Object.assign(document.createElement('a'), { href: url, download: archivo.name, rel: 'noopener' })
  a.style.display = 'none'
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
