<script lang="ts">
  // ＋ Anotar → ¿Qué pasó? (mapa de CH-16 §2).
  import type { TipoMovimiento } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { TIPO } from './textos.ts'

  const OPCIONES: TipoMovimiento[] = ['venta', 'cobro', 'compra', 'gasto', 'retiro', 'aportacion', 'devolucion_venta']
</script>

<button class="back" onclick={() => app.atras()}>‹ Volver</button>
<h1>¿Qué pasó?</h1>
<div class="acts">
  {#each OPCIONES as t, i (t)}
    <button class="act" class:main={i < 2} onclick={() => app.anotar(t)}><span aria-hidden="true">{TIPO[t].icono}</span>{TIPO[t].texto}</button>
  {/each}
</div>
