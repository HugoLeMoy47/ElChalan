// Escribe los datos sintéticos en datos_sinteticos/<arquetipo>/.
// Uso: npm run generar

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ARQUETIPOS, archivos } from './arquetipos.ts'

const aqui = dirname(fileURLToPath(import.meta.url))

for (const [id, construir] of Object.entries(ARQUETIPOS)) {
  const a = construir()
  const carpeta = join(aqui, id)
  mkdirSync(carpeta, { recursive: true })
  for (const [nombre, contenido] of Object.entries(archivos(a))) {
    writeFileSync(join(carpeta, nombre), contenido)
  }
  const conteo: Record<string, number> = {}
  for (const al of a.esperado.alertas_esperadas) conteo[al.codigo] = (conteo[al.codigo] ?? 0) + 1
  console.log(`${id}: ${a.generador.registro.length} eventos, ${a.generador.productos.length} productos, alertas`, conteo)
}
