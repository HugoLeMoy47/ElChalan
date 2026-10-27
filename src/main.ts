import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { app as estado } from './interfaz/app.svelte.ts'
import { registrarSinConexion } from './pwa.ts'

const app = mount(App, {
  target: document.getElementById('app')!,
})

registrarSinConexion((activar) => (estado.actualizar = activar))

export default app
