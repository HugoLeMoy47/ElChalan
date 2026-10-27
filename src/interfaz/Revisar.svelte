<script lang="ts">
  // F-10 · Cosas por revisar (versión mínima): frase clara y botones. Corregir o anular
  // se hace desde el movimiento; aquí se acepta o se pospone (CH-04 §12.1).
  import { sumarDias, type Alerta } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'

  const esMovimiento = (a: Alerta) => !!app.versiones?.porId.has(a.objeto_id)

  function ver(a: Alerta) {
    app.seleccion = a.objeto_id
    app.ir('detalle')
  }
</script>

<button class="back" onclick={() => app.atras()}>‹ Volver</button>
<h1>Cosas por revisar</h1>

{#each app.alertas as a (`${a.codigo}|${a.objeto_id}`)}
  <div class="card">
    <p style="margin:0 0 8px">{a.mensaje}</p>
    <div class="row">
      {#if esMovimiento(a)}<button class="btn sec" onclick={() => ver(a)}>Ver</button>{/if}
      <button class="btn sec" onclick={() => app.decidir(a, 'aceptada')}>Está bien así</button>
      <button class="btn sec" onclick={() => app.decidir(a, 'pospuesta', sumarDias(app.hoy, 7))}>Después</button>
    </div>
  </div>
{:else}
  <div class="card vacio">Todo en orden. ✔</div>
{/each}
