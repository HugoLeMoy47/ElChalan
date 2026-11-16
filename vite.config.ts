import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, type Plugin } from 'vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { sinConexion } from './pwa/plugin.ts'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// Marcador de versión (/version.json): qué commit está publicado y cuándo se compiló.
// Sirve para comprobar desde fuera si lo que está en vivo corresponde a `main`.
const commit = (() => {
  // Cloudflare (Workers Builds) y GitHub Actions exponen el commit que compilan.
  const declarado = process.env.BUILD_COMMIT || process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA
  // Solo se acepta un SHA: si el entorno trae otra cosa (p. ej. el nombre de la rama), se usa git.
  if (declarado && /^[0-9a-f]{7,40}$/i.test(declarado)) return declarado.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'local'
  }
})()

/** Va después de `sinConexion()` a propósito: así el marcador no entra a la lista de archivos sin conexión. */
function marcadorDeVersion(): Plugin {
  return {
    name: 'elchalan-marcador-de-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version, commit, built: new Date().toISOString() }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: la app funciona en cualquier carpeta del hospedaje estático (ADR-09).
  base: './',
  plugins: [svelte(), sinConexion(), marcadorDeVersion()],
  define: { __VERSION_APP__: JSON.stringify(version) },
})
