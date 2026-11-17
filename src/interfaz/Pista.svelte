<script lang="ts">
  // Pista de primera vez (guia.ts): para qué sirve esta pantalla, con un ejemplo. Se
  // cierra con «Entendido» y no vuelve; «No mostrar más pistas» las apaga todas.
  import { app } from './app.svelte.ts'
  import { PISTAS, clavePista } from './guia.ts'

  let { pantalla, tipo }: { pantalla: string; tipo?: string } = $props()

  const clave = $derived(clavePista(pantalla, tipo))
  const pista = $derived(clave ? PISTAS[clave] : null)
  const ver = $derived(!!pista && !!app.estado && !app.visto.has(`pista:${clave}`) && !app.visto.has('oculta:pistas'))
</script>

{#if ver && pista}
  <aside class="pista" aria-label="Pista">
    <div class="pista-cuerpo">
      <span class="ico" aria-hidden="true">💡</span>
      <div>
        <b>{pista.titulo}</b>
        <p>{pista.texto}</p>
        {#if pista.ejemplo}<p class="pista-ejemplo"><span>Por ejemplo:</span> {pista.ejemplo}</p>{/if}
      </div>
    </div>
    <div class="pista-acciones">
      <button class="link" onclick={() => app.marcarVisto('oculta:pistas')}>No mostrar más pistas</button>
      <button class="chip on" onclick={() => app.marcarVisto(`pista:${clave}`)}>Entendido</button>
    </div>
  </aside>
{/if}
