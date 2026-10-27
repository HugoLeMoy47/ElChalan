<script lang="ts">
  // F-9 · Un producto: cuántos tengo, cuánto vale, cambiar precio o costo, ajustar la
  // bodega (conteo o merma) y archivar en lugar de borrar (CH-04 §7.4).
  import { costoDeCantidad, pesosACentavos, textoAMilesimas, type Producto } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { MOTIVO_AJUSTE, cantidadCon, pesos } from './textos.ts'
  import Hoja from './Hoja.svelte'

  const p = $derived(app.estado!.productos.find((x) => x.producto_id === app.productoSeleccionado) as Producto)
  const cantidad = $derived(app.existenciaHoy[p.producto_id] ?? 0)

  let editando = $state(false)
  let nombre = $state('')
  let precio = $state('')
  let costo = $state('')
  let contando = $state(false)
  let real = $state('')
  let motivo = $state<'conteo' | 'merma' | 'regalo' | 'uso propio'>('conteo')

  function editar() {
    nombre = p.nombre
    precio = p.precio_venta_centavos !== undefined ? String(p.precio_venta_centavos / 100) : ''
    costo = p.costo_centavos !== undefined ? String(p.costo_centavos / 100) : ''
    editando = true
  }

  async function guardar() {
    const cambio: Producto = { ...p, nombre: nombre.trim() }
    if (precio === '') delete cambio.precio_venta_centavos
    else cambio.precio_venta_centavos = pesosACentavos(precio)!
    if (costo === '') delete cambio.costo_centavos
    else cambio.costo_centavos = pesosACentavos(costo)!
    await app.guardarProducto(cambio)
    editando = false
  }

  async function ajustar() {
    await app.ajustarExistencia(p.producto_id, textoAMilesimas(real)!, motivo)
    contando = false
    real = ''
  }

</script>

<button class="back" onclick={() => app.atras()}>‹ Volver</button>
<h1>{p.nombre}</h1>
{#if !p.activo}<p class="tag">Archivado</p>{/if}

<div class="kv"><span>Cuántos tengo</span><b class:neg={cantidad < 0}>{cantidadCon(cantidad, p.unidad_medida)}</b></div>
{#if cantidad < 0}<p class="sub">Según lo anotado vendiste más de lo que tenías. ¿Falta anotar una compra? También puedes contar y ajustar.</p>{/if}
<div class="kv"><span>Cuánto vale</span><span>{p.costo_centavos !== undefined && cantidad > 0 ? pesos(costoDeCantidad(cantidad, p.costo_centavos)) : '—'}</span></div>
<div class="kv"><span>Mi precio</span><span>{p.precio_venta_centavos !== undefined ? pesos(p.precio_venta_centavos) : '—'}</span></div>
<div class="kv"><span>Me cuesta</span><span>{p.costo_centavos !== undefined ? pesos(p.costo_centavos) : 'Sin costo'}</span></div>
{#if p.clave}<div class="kv"><span>Clave</span><span>{p.clave}</span></div>{/if}

<div style="height:16px"></div>
<button class="btn" onclick={editar}>Cambiar nombre, precio o costo</button>
<button class="btn sec" onclick={() => { real = String(Math.max(cantidad, 0) / 1000); contando = true }}>Ajustar mi bodega</button>
<button class="btn sec" onclick={() => app.guardarProducto({ ...p, activo: !p.activo })}>{p.activo ? 'Archivar' : 'Volver a usar'}</button>
<p class="sub">Archivar lo quita de la lista sin borrarlo, porque aparece en ventas ya anotadas.</p>

{#if editando}
  <Hoja titulo={`Cambiar producto`} alCerrar={() => (editando = false)}>
    <label class="f" for="en">Nombre</label>
    <input id="en" bind:value={nombre} maxlength="60" />
    <div class="row">
      <div><label class="f" for="ep">Mi precio</label><input id="ep" bind:value={precio} inputmode="decimal" /></div>
      <div><label class="f" for="ec">Me cuesta</label><input id="ec" bind:value={costo} inputmode="decimal" /></div>
    </div>
    <p class="sub">El cambio aplica a las ventas nuevas; las ya anotadas conservan su costo (D-50).</p>
    <button class="btn" disabled={!nombre.trim() || (precio !== '' && pesosACentavos(precio) === null) || (costo !== '' && pesosACentavos(costo) === null)} onclick={guardar}>Guardar</button>
    <button class="btn sec" onclick={() => (editando = false)}>Cancelar</button>
  </Hoja>
{/if}

{#if contando}
  <Hoja titulo={`Ajustar mi bodega`} alCerrar={() => (contando = false)}>
    <p>La app dice que tienes {cantidadCon(cantidad, p.unidad_medida)}. ¿Cuántos hay de verdad?</p>
    <input bind:value={real} inputmode="decimal" aria-label="Cuántos hay" />
    <p class="f">¿Por qué?</p>
    <div class="chips">
      {#each ['conteo', 'merma', 'regalo', 'uso propio'] as const as m (m)}
        <button class="chip" class:on={motivo === m} onclick={() => (motivo = m)}>{MOTIVO_AJUSTE[m]}</button>
      {/each}
    </div>
    <button class="btn" disabled={textoAMilesimas(real) === null || textoAMilesimas(real) === cantidad} onclick={ajustar}>Guardar</button>
    <button class="btn sec" onclick={() => (contando = false)}>Cancelar</button>
  </Hoja>
{/if}
