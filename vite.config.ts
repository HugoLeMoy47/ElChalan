import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { sinConexion } from './pwa/plugin.ts'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: la app funciona en cualquier carpeta del hospedaje estático (ADR-09).
  base: './',
  plugins: [svelte(), sinConexion()],
})
