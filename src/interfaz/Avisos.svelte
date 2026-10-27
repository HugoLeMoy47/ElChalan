<script lang="ts">
  // Lo dudoso se avisa, no se bloquea (U-6): «¿Guardar igual?».
  import type { Alerta } from '../dominio/index.ts'

  let { avisos, onguardar, oncorregir }: { avisos: Alerta[]; onguardar: () => void; oncorregir: () => void } = $props()
</script>

<div class="modal" role="dialog" aria-modal="true">
  <div class="sheet">
    <h3>¿Seguro?</h3>
    {#each avisos as a (a.codigo)}<p>{a.mensaje}</p>{/each}
    <button class="btn" onclick={onguardar}>Sí, guardar así</button>
    <button class="btn sec" onclick={oncorregir}>Corregir</button>
  </div>
</div>
