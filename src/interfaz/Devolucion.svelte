<script lang="ts">
  // F-6 · Me devolvieron: se elige la venta y qué regresó. El negocio se queda una
  // penalización (D-59); la app propone el 50 % y se puede cambiar (D-60).
  import {
    calcularImporte, penalizacionSugerida, pesosACentavos, sumarDias, textoAMilesimas,
    type DatosRenglon, type Movimiento,
  } from '../dominio/index.ts'
  import { app, type Preparado } from './app.svelte.ts'
  import Avisos from './Avisos.svelte'
  import Teclado from './Teclado.svelte'
  import { fechaCorta, pesos } from './textos.ts'

  const e = app.estado!
  const catalogo = new Map(e.productos.map((p) => [p.producto_id, p]))
  const recientes = $derived(
    app.versiones!.vigentes
      .filter((m) => m.tipo === 'venta' && m.fecha >= sumarDias(app.hoy, -60))
      .reverse()
      .slice(0, 30),
  )

  let venta = $state<Movimiento | null>(null)
  let cantidades = $state<string[]>([])
  let monto = $state('')
  let pena = $state('')
  let penaEditada = $state(false)
  let resultado = $state.raw<Preparado | null>(null)

  const conProductos = $derived(!!venta && venta.renglones.some((r) => r.producto_id))
  const devuelto = $derived.by(() => {
    if (!venta || !conProductos) return pesosACentavos(monto) ?? 0
    return venta.renglones.reduce((s, r, i) => s + calcularImporte(textoAMilesimas(cantidades[i] ?? '') ?? 0, r.precio_unitario_centavos ?? 0), 0)
  })
  const penalizacion = $derived(penaEditada ? pesosACentavos(pena) ?? 0 : penalizacionSugerida(devuelto, e.negocio.penalizacion_devolucion_pct))
  const reconocido = $derived(devuelto - penalizacion)

  function elegir(m: Movimiento) {
    venta = m
    cantidades = m.renglones.map(() => '0')
    monto = ''
    penaEditada = false
  }

  async function listo() {
    const v = venta!
    const renglones: DatosRenglon[] = v.renglones
      .map((r, i) => ({ r, cantidad: textoAMilesimas(cantidades[i] ?? '') ?? 0 }))
      .filter(({ r, cantidad }) => r.producto_id && cantidad > 0)
      .map(({ r, cantidad }) => ({
        producto_id: r.producto_id, cantidad_milesimas: cantidad,
        precio_unitario_centavos: r.precio_unitario_centavos, costo_unitario_centavos: r.costo_unitario_centavos,
      }))
    resultado = app.preparar({
      tipo: 'devolucion_venta', fecha: app.hoy, monto_centavos: devuelto, medio_pago: v.medio_pago,
      origen_id: v.movimiento_id, tercero_id: v.tercero_id,
      penalizacion_centavos: penalizacion || undefined,
      renglones: conProductos ? renglones : undefined,
    })
    if (resultado.ok && !resultado.avisos.length) await guardar()
  }

  async function guardar() {
    if (!resultado?.ok) return
    await app.guardar(resultado.movimiento, 'Devolución anotada')
    app.ir('inicio')
  }
</script>

<button class="back" onclick={() => (venta ? (venta = null) : app.atras())}>‹ Volver</button>
<h1>↩️ Me devolvieron</h1>

{#if !venta}
  <p class="sub" style="margin:-6px 0 12px">¿De qué venta?</p>
  {#each recientes as m (m.movimiento_id)}
    <button class="person" onclick={() => elegir(m)}>
      <span>{fechaCorta(m.fecha)} · {m.tercero_id ? app.terceros.get(m.tercero_id)?.nombre : 'Sin nombre'}<br />
        <span class="sub">{m.renglones.length ? `${m.renglones.length} producto${m.renglones.length === 1 ? '' : 's'}` : (m.condicion === 'credito' ? 'a crédito' : 'de contado')}</span></span>
      <b>{pesos(m.monto_centavos)}</b>
    </button>
  {:else}
    <div class="card vacio">No hay ventas en los últimos 60 días.</div>
  {/each}
{:else}
  <p class="sub" style="margin:-6px 0 8px">Venta del {fechaCorta(venta.fecha)} por {pesos(venta.monto_centavos)}{venta.condicion === 'credito' ? ', a crédito' : ''}.</p>
  {#if conProductos}
    <p class="f">¿Cuántos regresó de cada uno?</p>
    {#each venta.renglones as r, i (r.renglon_id)}
      <div class="person" style="cursor:default">
        <span style="flex:2">{catalogo.get(r.producto_id ?? '')?.nombre ?? r.descripcion}<br /><span class="sub">vendiste {r.cantidad_milesimas / 1000} · {pesos(r.precio_unitario_centavos ?? 0)} c/u</span></span>
        <input style="flex:1;max-width:90px" bind:value={cantidades[i]} inputmode="decimal" aria-label="Cantidad devuelta" />
      </div>
    {/each}
    <div class="amount">{pesos(devuelto)}</div>
  {:else}
    <Teclado bind:valor={monto} />
  {/if}

  <label class="f" for="pena">¿Cuánto te quedas de penalización?</label>
  <input id="pena" inputmode="decimal" value={penaEditada ? pena : String(penalizacion / 100)}
    oninput={(ev) => { pena = ev.currentTarget.value; penaEditada = true }} />
  <p class="sub">Se propone la mitad de lo devuelto; puedes cambiarla. Al cliente se le reconocen <b>{pesos(Math.max(reconocido, 0))}</b>{venta.condicion === 'credito' ? ': primero se le baja de lo que debe y, si sobra, se le regresa en dinero.' : '.'}</p>

  {#if resultado && !resultado.ok}<div class="error" role="alert">{resultado.errores.map((x) => x.mensaje).join(' ')}</div>{/if}
  <button class="btn" disabled={devuelto <= 0 || reconocido < 0} onclick={listo}>Listo</button>
{/if}

{#if resultado?.ok && resultado.avisos.length}
  <Avisos avisos={resultado.avisos} onguardar={guardar} oncorregir={() => (resultado = null)} />
{/if}
