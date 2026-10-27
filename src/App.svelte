<script lang="ts">
  import { onMount } from 'svelte'
  import { app } from './interfaz/app.svelte.ts'
  import Asistente from './interfaz/Asistente.svelte'
  import Barra from './interfaz/Barra.svelte'
  import Bienvenida from './interfaz/Bienvenida.svelte'
  import Captura from './interfaz/Captura.svelte'
  import Cobro from './interfaz/Cobro.svelte'
  import Detalle from './interfaz/Detalle.svelte'
  import Devolucion from './interfaz/Devolucion.svelte'
  import Inicio from './interfaz/Inicio.svelte'
  import Mas from './interfaz/Mas.svelte'
  import MeDeben from './interfaz/MeDeben.svelte'
  import Movimientos from './interfaz/Movimientos.svelte'
  import Respaldo from './interfaz/Respaldo.svelte'
  import Revisar from './interfaz/Revisar.svelte'
  import Ajustes from './interfaz/Ajustes.svelte'
  import Bloqueo from './interfaz/Bloqueo.svelte'
  import Periodo from './interfaz/Periodo.svelte'
  import Producto from './interfaz/Producto.svelte'
  import Productos from './interfaz/Productos.svelte'

  let fallo = $state<string | null>(null)

  /** Pantallas con barra inferior; los formularios y el detalle van sin ella. */
  const CON_BARRA = ['inicio', 'movimientos', 'deben', 'mas', 'productos', 'periodo', 'revisar', 'ajustes', 'respaldo']
  const conBarra = $derived(!!app.estado && !app.bloqueado && CON_BARRA.includes(app.pantalla))

  onMount(() => {
    app.iniciar().catch(() => (fallo = 'No se pudo abrir tus datos en este navegador.'))
  })
</script>

<main>
  {#if fallo}
    <div class="error" role="alert">{fallo} Lo que ya anotaste no se pierde; intenta cerrar y volver a abrir la app.</div>
  {:else if app.pantalla === 'cargando'}
    <p class="vacio">Abriendo…</p>
  {:else if app.pantalla === 'bienvenida'}
    <Bienvenida />
    <div style="height:24px"></div>
    <button class="link" onclick={() => app.ir('respaldo')}>Tengo un respaldo: restaurarlo</button>
  {:else if app.pantalla === 'respaldo'}
    <Respaldo />
  {:else if app.bloqueado}
    <Bloqueo />
  {:else if app.estado}
    {#if app.pantalla === 'inicio'}<Inicio />
    {:else if app.pantalla === 'captura'}{#key `${app.tipoCaptura}${app.corrigiendo ?? ''}${app.vuelta}`}<Captura />{/key}
    {:else if app.pantalla === 'deben'}<MeDeben />
    {:else if app.pantalla === 'cobro'}<Cobro />
    {:else if app.pantalla === 'devolucion'}<Devolucion />
    {:else if app.pantalla === 'movimientos'}<Movimientos />
    {:else if app.pantalla === 'mas'}<Mas />
    {:else if app.pantalla === 'asistente'}<Asistente />
    {:else if app.pantalla === 'detalle'}<Detalle />
    {:else if app.pantalla === 'revisar'}<Revisar />
    {:else if app.pantalla === 'productos'}<Productos />
    {:else if app.pantalla === 'producto'}<Producto />
    {:else if app.pantalla === 'periodo'}<Periodo />
    {:else if app.pantalla === 'ajustes'}<Ajustes />
    {/if}
  {/if}

  {#if conBarra}<Barra />{/if}

  {#if app.aviso}
    <div class="toast" role="status">
      <span>{app.aviso.texto}</span>
      {#if app.aviso.deshacer}
        {@const id = app.aviso.deshacer}
        <button onclick={() => app.deshacer(id)}>Deshacer</button>
      {/if}
    </div>
  {/if}
</main>
