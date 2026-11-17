<script lang="ts">
  // «?» junto a una cifra: abre qué significa esa palabra (glosario de guia.ts) y lleva
  // a la lista completa en Más → ¿Qué significa?
  import { app } from './app.svelte.ts'
  import { termino } from './guia.ts'
  import Hoja from './Hoja.svelte'

  let { id }: { id: string } = $props()

  const t = $derived(termino(id))
  let abierto = $state(false)
</script>

{#if t}
  <button class="que" aria-label={`¿Qué es «${t.palabra}»?`} onclick={(ev) => { ev.stopPropagation(); abierto = true }}>?</button>
  {#if abierto}
    <Hoja titulo={t.palabra} alCerrar={() => (abierto = false)}>
      <p style="color:var(--ink);font-size:17px">{t.significa}</p>
      <button class="btn" onclick={() => (abierto = false)}>Entendido</button>
      <button class="link" onclick={() => { abierto = false; app.ir('ayuda') }}>Ver qué significa cada palabra ›</button>
    </Hoja>
  {/if}
{/if}
