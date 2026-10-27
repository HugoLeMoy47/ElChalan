<script lang="ts">
  // ＋ Anotar → ¿Qué pasó? (mapa de CH-16 §2). Va dentro de la hoja de la barra
  // inferior (UX-30): los dos más usados arriba, grandes; cada tipo con su color (UX-27).
  import type { TipoMovimiento } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { TIPO } from './textos.ts'

  const OPCIONES: TipoMovimiento[] = ['venta', 'cobro', 'compra', 'gasto', 'retiro', 'aportacion', 'devolucion_venta']
</script>

<div class="acts">
  {#each OPCIONES as t, i (t)}
    <button class="act t-{t}" class:main={i < 2} onclick={() => app.anotar(t)}>
      <span class="ico" aria-hidden="true">{TIPO[t].icono}</span>{TIPO[t].texto}
    </button>
  {/each}
</div>
