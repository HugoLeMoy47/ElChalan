<script lang="ts">
  // Candado con PIN al abrir la app (F-13). Es una cerradura de cortesía del teléfono,
  // no un cifrado: los datos siguen en el navegador.
  import { app } from './app.svelte.ts'

  let pin = $state('')
  let error = $state(false)

  async function entrar() {
    error = !(await app.desbloquear(pin))
    pin = ''
  }
</script>

<h1 style="margin-top:40px">{app.estado?.negocio.nombre}</h1>
<p>Escribe tu PIN para entrar.</p>
<input type="password" inputmode="numeric" autocomplete="off" maxlength="6" bind:value={pin} aria-label="PIN"
  onkeydown={(ev) => ev.key === 'Enter' && entrar()} />
{#if error}<div class="error" role="alert">Ese no es tu PIN.</div>{/if}
<div style="height:12px"></div>
<button class="btn" disabled={pin.length < 4} onclick={entrar}>Entrar</button>
<button class="link" onclick={() => app.ir('respaldo')}>Olvidé mi PIN: restaurar desde un respaldo</button>
