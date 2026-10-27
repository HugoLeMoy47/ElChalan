<script lang="ts">
  // Alta de producto en una hoja (D-64): desde Mis productos, o dentro de una venta o
  // compra sin salir de ella (UX-29). En una compra se pide primero a cuánto se compró.
  import { onMount, untrack } from 'svelte'
  import { pesosACentavos, type Producto } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import Hoja from './Hoja.svelte'

  let { nombreInicial = '', desde = 'catalogo', alGuardar, alCerrar }: {
    nombreInicial?: string
    desde?: 'catalogo' | 'venta' | 'compra'
    alGuardar: (p: Producto, otro: boolean) => void
    alCerrar: () => void
  } = $props()

  const UNIDADES = ['pieza', 'kilo', 'litro', 'caja', 'paquete', 'metro']

  let nombre = $state(untrack(() => nombreInicial))
  let unidad = $state('pieza')
  let precio = $state('')
  let costo = $state('')
  let ocupado = $state(false)
  let campoNombre = $state<HTMLInputElement>()
  let campoCosto = $state<HTMLInputElement>()
  let campoPrecio = $state<HTMLInputElement>()

  const valido = $derived(!!nombre.trim() && (precio === '' || pesosACentavos(precio) !== null) && (costo === '' || pesosACentavos(costo) !== null))

  // La hoja toma el foco al abrir; después pasa al primer campo por llenar.
  onMount(() => { setTimeout(() => (nombre ? (desde === 'compra' ? campoCosto : campoPrecio) : campoNombre)?.focus(), 0) })

  async function guardar(otro: boolean) {
    ocupado = true
    try {
      const p = app.nuevoProducto({
        nombre, unidad_medida: unidad,
        precio: precio === '' ? undefined : pesosACentavos(precio)!,
        costo: costo === '' ? undefined : pesosACentavos(costo)!,
      })
      await app.guardarProducto(p)
      alGuardar(p, otro)
      if (otro) {
        // Altas seguidas: la hoja se queda abierta y limpia.
        app.avisar(`Producto agregado: ${p.nombre}`)
        nombre = precio = costo = ''
        campoNombre?.focus()
      }
    } finally {
      ocupado = false
    }
  }
</script>

{#snippet filaCosto()}
  <div><label class="f" for="ap-costo">{desde === 'compra' ? '¿A cuánto lo compraste?' : 'Me cuesta'}</label>
    <input id="ap-costo" bind:this={campoCosto} bind:value={costo} inputmode="decimal" placeholder="$…" /></div>
{/snippet}
{#snippet filaPrecio()}
  <div><label class="f" for="ap-precio">{desde === 'venta' ? '¿A cuánto lo vendes?' : 'Mi precio'}</label>
    <input id="ap-precio" bind:this={campoPrecio} bind:value={precio} inputmode="decimal" placeholder="$…" /></div>
{/snippet}

<Hoja titulo="Nuevo producto" {alCerrar}>
  <label class="f" for="ap-nombre">¿Cómo se llama?</label>
  <input id="ap-nombre" bind:this={campoNombre} bind:value={nombre} maxlength="60" enterkeyhint="next" />
  <div class="row">
    {#if desde === 'compra'}{@render filaCosto()}{@render filaPrecio()}{:else}{@render filaPrecio()}{@render filaCosto()}{/if}
  </div>
  <p class="f">Se vende por</p>
  <div class="chips">
    {#each UNIDADES as u (u)}<button class="chip" class:on={unidad === u} onclick={() => (unidad = u)}>{u}</button>{/each}
  </div>
  <p class="sub">{desde === 'catalogo' ? 'Con el costo, la app sabe cuánto te deja cada venta. Puedes ponerlo después.' : 'Se guarda en Mis productos y se agrega a lo que estás anotando.'}</p>
  <button class="btn" disabled={!valido || ocupado} onclick={() => guardar(false)}>{desde === 'catalogo' ? 'Guardar' : 'Agregar'}</button>
  {#if desde === 'catalogo'}<button class="btn sec" disabled={!valido || ocupado} onclick={() => guardar(true)}>Guardar y agregar otro</button>{/if}
  <button class="btn sec" onclick={alCerrar}>Cancelar</button>
</Hoja>
