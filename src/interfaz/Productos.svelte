<script lang="ts">
  // F-9 · Mis productos: cuántos tengo y cuánto vale. Alta con cuatro campos.
  import { existencias, pesosACentavos } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { cantidadCon, pesos } from './textos.ts'
  import Hoja from './Hoja.svelte'

  let buscar = $state('')
  let verArchivados = $state(false)
  let alta = $state(false)
  let nombre = $state('')
  let unidad = $state('pieza')
  let precio = $state('')
  let costo = $state('')

  const UNIDADES = ['pieza', 'kilo', 'litro', 'caja', 'paquete', 'metro']

  const lista = $derived(
    existencias(app.estado!.productos, app.existenciaHoy)
      .filter((e) => e.producto.activo !== verArchivados)
      .filter((e) => `${e.producto.nombre} ${e.producto.clave ?? ''}`.toLowerCase().includes(buscar.trim().toLowerCase())),
  )
  const valorTotal = $derived(lista.reduce((s, e) => s + (e.valor ?? 0), 0))
  const valido = $derived(!!nombre.trim() && (precio === '' || pesosACentavos(precio) !== null) && (costo === '' || pesosACentavos(costo) !== null))

  async function guardar() {
    const p = app.nuevoProducto({
      nombre, unidad_medida: unidad,
      precio: precio === '' ? undefined : pesosACentavos(precio)!,
      costo: costo === '' ? undefined : pesosACentavos(costo)!,
    })
    await app.guardarProducto(p)
    app.avisar(`Producto agregado: ${p.nombre}`)
    alta = false
    nombre = precio = costo = ''
  }

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
  <Hoja titulo={`Nuevo producto`} alCerrar={() => (alta = false)}>
    <label class="f" for="pn">¿Cómo se llama?</label>
    <input id="pn" bind:value={nombre} maxlength="60" />
    <p class="f">Se vende por</p>
    <div class="chips">
      {#each UNIDADES as u (u)}<button class="chip" class:on={unidad === u} onclick={() => (unidad = u)}>{u}</button>{/each}
    </div>
    <div class="row">
      <div><label class="f" for="pp">Mi precio</label><input id="pp" bind:value={precio} inputmode="decimal" placeholder="$…" /></div>
      <div><label class="f" for="pc">Me cuesta</label><input id="pc" bind:value={costo} inputmode="decimal" placeholder="$…" /></div>
    </div>
    <p class="sub">Con el costo, la app sabe cuánto te deja cada venta. Puedes ponerlo después.</p>
    <button class="btn" disabled={!valido} onclick={guardar}>Guardar</button>
    <button class="btn sec" onclick={() => (alta = false)}>Cancelar</button>
  </Hoja>
{/if}
