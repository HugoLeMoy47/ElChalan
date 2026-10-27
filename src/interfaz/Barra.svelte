<script lang="ts">
  // Barra inferior (D-62, UX-04): Inicio · Movimientos · ＋ Anotar · Me deben · Más.
  // ＋ abre «¿Qué pasó?» como hoja, con todos los tipos a la vista (UX-30).
  import { app, type Pantalla } from './app.svelte.ts'
  import Anotar from './Anotar.svelte'
  import Hoja from './Hoja.svelte'

  let anotando = $state(false)

  /** Las pantallas de «Más» marcan su pestaña. */
  const PESTANA: Partial<Record<Pantalla, Pantalla>> = {
    inicio: 'inicio', revisar: 'inicio', movimientos: 'movimientos', deben: 'deben',
    mas: 'mas', productos: 'mas', periodo: 'mas', ajustes: 'mas', respaldo: 'mas',
  }
  const actual = $derived(PESTANA[app.pantalla])
  const vencido = $derived((app.vistas?.por_cobrar_vencido ?? 0) > 0)

  function ir(p: Pantalla) {
    if (p === 'deben') {
      app.terceroCobro = null
      app.tipoCaptura = 'venta'
    }
    app.pestana(p)
  }
</script>

{#snippet pestana(p: Pantalla, texto: string, icono: string)}
  <button class:on={actual === p} aria-current={actual === p ? 'page' : undefined} onclick={() => ir(p)}>
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{@html icono}</svg>
    {#if p === 'deben' && vencido}<span class="punto" aria-hidden="true"></span>{/if}
    <span>{texto}</span>
  </button>
{/snippet}

<nav class="barra" aria-label="Secciones">
  <div>
    {@render pestana('inicio', 'Inicio', '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>')}
    {@render pestana('movimientos', 'Movimientos', '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>')}
    <button class="anotar" onclick={() => (anotando = true)}>
      <span class="circulo" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </span>
      <span>Anotar</span>
    </button>
    {@render pestana('deben', 'Me deben', '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 9M22 21a7 7 0 0 0-4-6.3"/>')}
    {@render pestana('mas', 'Más', '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>')}
  </div>
</nav>

{#if anotando}
  <Hoja titulo="¿Qué pasó?" alCerrar={() => (anotando = false)}>
    <Anotar />
  </Hoja>
{/if}
