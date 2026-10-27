<script lang="ts">
  // F-7 · Detalle de un movimiento: Corregir, Anular y Ver historia (CH-04 §7.2).
  import { historiaDe, type Movimiento } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { CATEGORIA, MEDIO, TIPO, fechaCorta, pesos } from './textos.ts'

  const v = $derived(app.versiones!)
  const m = $derived(v.porId.get(app.seleccion!) as Movimiento)
  const vigente = $derived(v.vigentes.some((x) => x.movimiento_id === m.movimiento_id))
  const historia = $derived(historiaDe(v, m.movimiento_id))
  const catalogo = $derived(new Map(app.estado!.productos.map((p) => [p.producto_id, p])))
  /** Se corrige desde la pantalla de captura; cobros y devoluciones se anulan y se vuelven a anotar. */
  const corregible = $derived(['venta', 'compra', 'gasto', 'retiro', 'aportacion'].includes(m.tipo))

  let anulando = $state(false)
  let motivo = $state('')
  let verHistoria = $state(false)

  async function anular() {
    await app.anular(m.movimiento_id, motivo.trim() || undefined)
    app.avisar('Anulado')
    app.ir('movimientos')
  }

  function corregir() {
    app.tipoCaptura = m.tipo
    app.corrigiendo = m.movimiento_id
    app.ir('captura')
  }

  const quien = (x: Movimiento) => (x.tercero_id ? app.terceros.get(x.tercero_id)?.nombre : undefined)
</script>

<button class="back" onclick={() => app.ir('movimientos')}>‹ Volver</button>
<h1>{TIPO[m.tipo].icono} {TIPO[m.tipo].texto}</h1>
{#if !vigente}<p class="tag">Anulado o sustituido; se conserva en la historia</p>{/if}

<div class="kv"><span>Monto</span><b>{pesos(m.monto_centavos)}</b></div>
<div class="kv"><span>Fecha</span><span>{fechaCorta(m.fecha)}</span></div>
<div class="kv"><span>Cómo se pagó</span><span>{MEDIO[m.medio_pago]}</span></div>
{#if m.condicion}<div class="kv"><span>¿Me pagaron ya?</span><span>{m.condicion === 'credito' ? 'No, a crédito' : 'Sí, de contado'}</span></div>{/if}
{#if m.fecha_promesa}<div class="kv"><span>Me paga el</span><span>{fechaCorta(m.fecha_promesa)}</span></div>{/if}
{#if quien(m)}<div class="kv"><span>Con quién</span><span>{quien(m)}</span></div>{/if}
{#if m.categoria_gasto}<div class="kv"><span>En qué</span><span>{CATEGORIA[m.categoria_gasto]}</span></div>{/if}
{#if m.penalizacion_centavos}<div class="kv"><span>Me quedé de penalización</span><span>{pesos(m.penalizacion_centavos)}</span></div>{/if}
{#if m.notas}<div class="kv"><span>Notas</span><span>{m.notas}</span></div>{/if}
{#if m.estado_registro === 'por_completar'}<div class="kv"><span>Estado</span><span class="tag w">Falta algo</span></div>{/if}

{#if m.renglones.length}
  <div class="dia">Productos</div>
  {#each m.renglones as r (r.renglon_id)}
    <div class="kv">
      <span>{r.cantidad_milesimas / 1000} × {catalogo.get(r.producto_id ?? '')?.nombre ?? r.descripcion}</span>
      <span>{pesos(r.importe_centavos)}</span>
    </div>
  {/each}
{/if}

<div style="height:16px"></div>
{#if vigente}
  {#if corregible}<button class="btn" onclick={corregir}>Corregir</button>{/if}
  <button class="btn mal" onclick={() => (anulando = true)}>Anular</button>
{/if}
{#if historia.length > 1}
  <button class="btn sec" onclick={() => (verHistoria = !verHistoria)}>Ver historia ({historia.length})</button>
  {#if verHistoria}
    {#each historia as h (h.movimiento_id)}
      <div class="kv">
        <span>{h.operacion === 'alta' ? 'Se anotó' : h.operacion === 'correccion' ? 'Se corrigió' : 'Se anuló'} · {new Date(h.creado_en).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</span>
        <span>{h.operacion === 'anulacion' ? h.notas ?? '' : pesos(h.monto_centavos)}</span>
      </div>
    {/each}
  {/if}
{/if}

{#if anulando}
  <div class="modal" role="dialog" aria-modal="true">
    <div class="sheet">
      <h3>¿Anular este movimiento?</h3>
      <p>Deja de contar en tus números, pero no se borra: queda en la historia.</p>
      <label class="f" for="motivo">¿Por qué? (opcional)</label>
      <input id="motivo" bind:value={motivo} maxlength="100" />
      <div style="height:12px"></div>
      <button class="btn mal" onclick={anular}>Sí, anular</button>
      <button class="btn sec" onclick={() => (anulando = false)}>No</button>
    </div>
  </div>
{/if}
