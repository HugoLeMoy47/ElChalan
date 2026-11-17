<script lang="ts">
  // Más → ¿Qué significa? (guia.ts): el glosario de CH-13 con las palabras de la pantalla,
  // y cómo volver a ver el asistente, las pistas y los primeros pasos.
  import { app } from './app.svelte.ts'
  import { GLOSARIO } from './guia.ts'

  let buscar = $state('')
  const texto = $derived(buscar.trim().toLowerCase())
  const lista = $derived(texto ? GLOSARIO.filter((t) => `${t.palabra} ${t.significa}`.toLowerCase().includes(texto)) : GLOSARIO)
  let reiniciado = $state(false)
</script>

<button class="back" onclick={() => app.atras()}>‹ Volver</button>
<h1>¿Qué significa?</h1>
<p class="sub" style="margin-top:-6px">Las palabras de la app, en corto.</p>

<div class="buscador"><input bind:value={buscar} placeholder="Busca una palabra…" aria-label="Buscar una palabra" /></div>

<dl class="glosario">
  {#each lista as t (t.id)}
    <div><dt>{t.palabra}</dt><dd>{t.significa}</dd></div>
  {:else}
    <p class="vacio">No hay una palabra así.</p>
  {/each}
</dl>

<div class="dia">Aprende a usarla</div>
{#if !app.esEjemplo}
  <button class="btn sec" onclick={() => app.abrirAsistente()}>Ver otra vez el asistente de bienvenida</button>
{/if}
<button class="btn sec" disabled={reiniciado} onclick={() => { app.olvidarGuia(); reiniciado = true; app.avisar('Listo: verás otra vez las pistas y tus primeros pasos') }}>
  {reiniciado ? '✔ Pistas y primeros pasos de vuelta' : 'Volver a mostrar las pistas y los primeros pasos'}
</button>
