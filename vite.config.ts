import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { sinConexion } from './pwa/plugin.ts'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: la app funciona en cualquier carpeta del hospedaje estático (ADR-09).
  base: './',
  plugins: [svelte(), sinConexion()],
  define: { __VERSION_APP__: JSON.stringify(version) },
})
