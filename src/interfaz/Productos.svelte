<script lang="ts">
  // F-9 · Mis productos: cuántos tengo y cuánto vale. Alta con cuatro campos, seguidas (D-64).
  // Ordenados por más vendidos, con los que se están acabando marcados y el buscador
  // fijo arriba (UX-15).
  import { existencias, seEstaAcabando, sumarDias, vendidoPorProducto } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { cantidadCon, pesos } from './textos.ts'
  import AltaProducto from './AltaProducto.svelte'

  type Orden = 'vendidos' | 'acaban' | 'nombre'
  const ORDENES: { id: Orden; texto: string }[] = [
    { id: 'vendidos', texto: 'Más vendidos' }, { id: 'acaban', texto: 'Se acaban' }, { id: 'nombre', texto: 'A → Z' },
  ]

  let buscar = $state('')
  let verArchivados = $state(false)
  let alta = $state(false)
  let orden = $state<Orden>('vendidos')

  /** Lo vendido en los últimos 30 días ordena; el de 14 días dice si se acaba. */
  const vendido30 = $derived(vendidoPorProducto(app.versiones!.vigentes, sumarDias(app.hoy, -29), app.hoy))
  const vendido14 = $derived(vendidoPorProducto(app.versiones!.vigentes, sumarDias(app.hoy, -13), app.hoy))
  /** 0 = sin existencias o menos de cero, 1 = se acaba, 2 = bien. */
  const urgencia = (id: string, cantidad: number) => (cantidad <= 0 && (vendido30[id] ?? 0) > 0) || cantidad < 0 ? 0 : seEstaAcabando(cantidad, vendido14[id] ?? 0) ? 1 : 2

  const lista = $derived(
    existencias(app.estado!.productos, app.existenciaHoy)
      .filter((e) => e.producto.activo !== verArchivados)
      .filter((e) => `${e.producto.nombre} ${e.producto.clave ?? ''}`.toLowerCase().includes(buscar.trim().toLowerCase()))
      .map((e) => ({ ...e, vendido: vendido30[e.producto.producto_id] ?? 0, urgencia: urgencia(e.producto.producto_id, e.cantidad) }))
      .sort((a, b) =>
        orden === 'nombre' ? a.producto.nombre.localeCompare(b.producto.nombre, 'es')
        : orden === 'acaban' ? a.urgencia - b.urgencia || b.vendido - a.vendido
        : b.vendido - a.vendido || a.producto.nombre.localeCompare(b.producto.nombre, 'es')),
  )
  const valorTotal = $derived(lista.reduce((s, e) => s + (e.valor ?? 0), 0))
  const porAcabarse = $derived(lista.filter((e) => e.urgencia < 2).length)
</script>

<button class="back" onclick={() => app.atras()}>‹ Volver</button>
<h1>Mis productos</h1>

<button class="btn" onclick={() => (alta = true)}>＋ Agregar producto</button>
<div class="buscador">
  <input bind:value={buscar} placeholder="Busca por nombre o clave…" aria-label="Buscar producto" />
</div>
<div class="chips desliza" role="group" aria-label="Ordenar">
  {#each ORDENES as o (o.id)}
    <button class="chip" class:on={orden === o.id} aria-pressed={orden === o.id} onclick={() => (orden = o.id)}>{o.texto}</button>
  {/each}
</div>
{#if !verArchivados && lista.length}
  <p class="sub">Tu bodega vale {pesos(valorTotal)} al costo de tus productos.{porAcabarse ? ` ${porAcabarse} se está${porAcabarse === 1 ? "" : "n"} acabando o ya no hay.` : ""}</p>
{/if}

{#each lista as e (e.producto.producto_id)}
  <button class="person" onclick={() => { app.productoSeleccionado = e.producto.producto_id; app.ir('producto') }}>
    <span>
      <b>{e.producto.nombre}</b><br />
      <span class="sub">{e.producto.precio_venta_centavos !== undefined ? `Precio ${pesos(e.producto.precio_venta_centavos)}` : 'Sin precio'} · {e.producto.costo_centavos !== undefined ? `me cuesta ${pesos(e.producto.costo_centavos)}` : 'sin costo'}{e.vendido ? ` · vendiste ${cantidadCon(e.vendido, e.producto.unidad_medida)} en 30 días` : ''}</span>
    </span>
    <span style="text-align:right">
      <b class:neg={e.cantidad < 0} style="white-space:nowrap">{cantidadCon(e.cantidad, e.producto.unidad_medida)}</b><br />
      {#if e.cantidad < 0}<span class="tag">revisa</span>
      {:else if e.urgencia === 0}<span class="tag agotado">ya no hay</span>
      {:else if e.urgencia === 1}<span class="tag w">se acaba</span>
      {:else if e.valor !== null}<span class="sub">{pesos(e.valor)}</span>{/if}
    </span>
  </button>
{:else}
  <div class="card vacio">{buscar ? 'No encontré ese producto.' : verArchivados ? 'No hay productos archivados.' : 'Todavía no tienes productos. Puedes vender sin ellos; agrégalos si quieres saber cuántos tienes y cuánto ganas.'}</div>
{/each}

<div class="sw">
  <span>Ver archivados</span>
  <button class:on={verArchivados} onclick={() => (verArchivados = !verArchivados)} aria-label="Ver archivados" aria-pressed={verArchivados}></button>
</div>

{#if alta}
  <AltaProducto alCerrar={() => (alta = false)} alGuardar={(p, otro) => { if (!otro) { app.avisar(`Producto agregado: ${p.nombre}`); alta = false } }} />
{/if}
