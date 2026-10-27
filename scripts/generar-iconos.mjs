// Genera los íconos PNG de la app (manifiesto, ADR-01) sin dependencias: una moneda
// blanca sobre el verde de la maqueta. El dibujo cabe en la zona segura de los íconos
// «maskable» (círculo del 80 %). Uso: node scripts/generar-iconos.mjs

import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const VERDE = [0x1f, 0x6f, 0x4a]
const BLANCO = [0xff, 0xff, 0xff]
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function bloque(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

/** Color de un punto (x, y en 0..1): una libreta con renglones, lo que se hace en la app: anotar. */
function color(x, y) {
  const r = 0.04 // esquinas redondeadas
  const [x0, x1, y0, y1] = [0.31, 0.69, 0.24, 0.76]
  const dx = Math.max(x0 + r - x, 0, x - (x1 - r))
  const dy = Math.max(y0 + r - y, 0, y - (y1 - r))
  if (x < x0 || x > x1 || y < y0 || y > y1 || Math.hypot(dx, dy) > r) return VERDE
  const renglon = [0.36, 0.46, 0.56, 0.66].some((ry) => Math.abs(y - ry) < 0.018) && x > 0.37 && x < (y > 0.6 ? 0.53 : 0.63)
  return renglon ? VERDE : BLANCO
}

function png(lado) {
  const filas = []
  const M = 4 // submuestreo para bordes suaves
  for (let py = 0; py < lado; py++) {
    const fila = Buffer.alloc(1 + lado * 3)
    for (let px = 0; px < lado; px++) {
      const suma = [0, 0, 0]
      for (let sy = 0; sy < M; sy++) {
        for (let sx = 0; sx < M; sx++) {
          const c = color((px + (sx + 0.5) / M) / lado, (py + (sy + 0.5) / M) / lado)
          for (let i = 0; i < 3; i++) suma[i] += c[i]
        }
      }
      for (let i = 0; i < 3; i++) fila[1 + px * 3 + i] = Math.round(suma[i] / (M * M))
    }
    filas.push(fila)
  }
  const cabecera = Buffer.alloc(13)
  cabecera.writeUInt32BE(lado, 0)
  cabecera.writeUInt32BE(lado, 4)
  cabecera[8] = 8 // bits por canal
  cabecera[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', cabecera),
    bloque('IDAT', deflateSync(Buffer.concat(filas))),
    bloque('IEND', Buffer.alloc(0)),
  ])
}

const carpeta = new URL('../public/iconos/', import.meta.url)
mkdirSync(carpeta, { recursive: true })
for (const lado of [192, 512]) writeFileSync(new URL(`icono-${lado}.png`, carpeta), png(lado))
writeFileSync(new URL('icono-180.png', carpeta), png(180))
console.log('Íconos en public/iconos/')
