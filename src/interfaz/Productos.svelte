<script lang="ts">
  // F-9 · Mis productos: cuántos tengo y cuánto vale. Alta con cuatro campos, seguidas (D-64).
  import { existencias } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { cantidadCon, pesos } from './textos.ts'
  import AltaProducto from './AltaProducto.svelte'

  let buscar = $state('')
  let verArchivados = $state(false)
  let alta = $state(false)

  const lista = $derived(
    existencias(app.estado!.productos, app.existenciaHoy)
      .filter((e) => e.producto.activo !== verArchivados)
      .filter((e) => `${e.producto.nombre} ${e.producto.clave ?? ''}`.toLowerCase().includes(buscar.trim().toLowerCase())),
  )
  const valorTotal = $derived(lista.reduce((s, e) => s + (e.valor ?? 0), 0))
</script>

<button class="back" onclick={() => app.atras()}>‹ Volver</button>
<h1>Mis productos</h1>

<button class="btn" onclick={() => (alta = true)}>＋ Agregar producto</button>
<input bind:value={buscar} placeholder="Busca por nombre o clave…" aria-label="Buscar producto" />
<div class="sw">
  <span>Ver archivados</span>
  <button class:on={verArchivados} onclick={() => (verArchivados = !verArchivados)} aria-label="Ver archivados" aria-pressed={verArchivados}></button>
</div>
{#if !verArchivados && lista.length}<p class="sub">Tu bodega vale {pesos(valorTotal)} al costo de tus productos.</p>{/if}

{#each lista as e (e.producto.producto_id)}
  <button class="person" onclick={() => { app.productoSeleccionado = e.producto.producto_id; app.ir('producto') }}>
    <span>
      <b>{e.producto.nombre}</b><br />
      <span class="sub">{e.producto.precio_venta_centavos !== undefined ? `Precio ${pesos(e.producto.precio_venta_centavos)}` : 'Sin precio'} · {e.producto.costo_centavos !== undefined ? `me cuesta ${pesos(e.producto.costo_centavos)}` : 'sin costo'}</span>
    </span>
    <span style="text-align:right">
      <b class:neg={e.cantidad < 0}>{cantidadCon(e.cantidad, e.producto.unidad_medida)}</b><br />
      {#if e.cantidad < 0}<span class="tag">revisa</span>{:else if e.valor !== null}<span class="sub">{pesos(e.valor)}</span>{/if}
    </span>
  </button>
{:else}
  <div class="card vacio">{buscar ? 'No encontré ese producto.' : verArchivados ? 'No hay productos archivados.' : 'Todavía no tienes productos. Puedes vender sin ellos; agrégalos si quieres saber cuántos tienes y cuánto ganas.'}</div>
{/each}

{#if alta}
  <AltaProducto alCerrar={() => (alta = false)} alGuardar={(p, otro) => { if (!otro) { app.avisar(`Producto agregado: ${p.nombre}`); alta = false } }} />
{/if}
