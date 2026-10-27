<script lang="ts">
  // Lo dudoso se avisa, no se bloquea (U-6): «¿Guardar igual?».
  import type { Alerta } from '../dominio/index.ts'
  import Hoja from './Hoja.svelte'

  let { avisos, onguardar, oncorregir }: { avisos: Alerta[]; onguardar: () => void; oncorregir: () => void } = $props()
</script>

<Hoja titulo={`¿Seguro?`} alCerrar={oncorregir}>
  {#each avisos as a (a.codigo)}<p>{a.mensaje}</p>{/each}
  <button class="btn" onclick={onguardar}>Sí, guardar así</button>
  <button class="btn sec" onclick={oncorregir}>Corregir</button>
</Hoja>
