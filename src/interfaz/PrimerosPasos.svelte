<script lang="ts">
  // Primeros pasos en el inicio (guia.ts): lo que sigue después del asistente. Se palomea
  // solo con lo que la persona ya hizo; cada pendiente lleva directo a hacerlo. Al terminar
  // felicita una vez; con ✕ se oculta (se vuelve a mostrar desde Más → ¿Qué significa?).
  import { app } from './app.svelte.ts'
  import { avance, misiones, siguiente, type IdMision } from './guia.ts'

  const e = $derived(app.estado!)
  const vistas = $derived(new Set([...app.visto].filter((k) => k.startsWith('vio:')).map((k) => k.slice(4))))
  const lista = $derived(misiones({ movimientos: e.movimientos, ultimoRespaldo: e.meta.ultimo_respaldo, visto: vistas, giro: e.negocio.giro }))
  const a = $derived(avance(lista))
  const proxima = $derived(siguiente(lista))

  function hacer(id: IdMision) {
    if (id === 'respaldo') app.ir('respaldo')
    else if (id === 'semana') app.ir('periodo')
    else app.anotar(id)
  }
</script>

<section class="pasos" aria-labelledby="pasos-titulo">
  <div class="pasos-cabeza">
    <div>
      <h2 id="pasos-titulo">{a.completo ? '¡Ya sabes lo básico!' : 'Tus primeros pasos'}</h2>
      <span class="sub">{a.completo ? 'Ya usas El Chalán como se debe. Sigue anotando todos los días.' : `${a.hechos} de ${a.total} · aprende haciendo`}</span>
    </div>
    <button class="chip" aria-label="Ocultar primeros pasos" onclick={() => app.marcarVisto('oculta:pasos')}>✕</button>
  </div>
  <div class="avance" role="progressbar" aria-valuemin="0" aria-valuemax={a.total} aria-valuenow={a.hechos} aria-label={`${a.hechos} de ${a.total} pasos`}>
    {#each lista as m (m.id)}<span class:on={m.hecho}></span>{/each}
  </div>
  {#if a.completo}
    <button class="btn" onclick={() => app.marcarVisto('oculta:pasos')}>¡Listo!</button>
  {:else}
    <ul>
      {#each lista as m (m.id)}
        <li>
          {#if m.hecho}
            <span class="mision hecha"><span class="palomita" aria-hidden="true">✓</span><span>{m.titulo}</span></span>
          {:else}
            <button class="mision" class:proxima={proxima?.id === m.id} onclick={() => hacer(m.id)}>
              <span class="palomita" aria-hidden="true"></span>
              <span class="mision-texto"><b>{m.titulo}</b>{#if proxima?.id === m.id}<span class="sub">{m.porque}</span>{/if}</span>
              <span aria-hidden="true">›</span>
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
