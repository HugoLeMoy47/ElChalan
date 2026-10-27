<script lang="ts">
  // F-5 · Me pagaron: se elige la venta y el monto sale con lo que debe; se puede cambiar.
  import { diasEntre, fechaPromesaEfectiva, pesosACentavos, type MedioPago, type Movimiento } from '../dominio/index.ts'
  import { app, type Preparado } from './app.svelte.ts'
  import Avisos from './Avisos.svelte'
  import Teclado from './Teclado.svelte'
  import { MEDIO, fechaCorta, pesos } from './textos.ts'

  const tercero = app.terceroCobro
  const nombre = app.terceros.get(tercero ?? '')?.nombre ?? '(sin nombre)'

  const ventas = $derived(
    Object.entries(app.vistas!.por_cobrar_por_venta)
      .map(([id, saldo]) => ({ venta: app.versiones!.porId.get(id) as Movimiento, saldo }))
      .filter((x) => (x.venta.tercero_id ?? '') === (tercero ?? ''))
      .sort((a, b) => (fechaPromesaEfectiva(a.venta) < fechaPromesaEfectiva(b.venta) ? -1 : 1)),
  )

  let elegida = $state<string | null>(null)
  let monto = $state('')
  let medio = $state<MedioPago>('efectivo')
  let resultado = $state.raw<Preparado | null>(null)

  $effect(() => {
    if (elegida === null && ventas.length === 1) elegir(ventas[0].venta.movimiento_id, ventas[0].saldo)
  })

  function elegir(id: string, saldo: number) {
    elegida = id
    monto = String(saldo / 100)
  }

  async function listo() {
    resultado = app.preparar({
      tipo: 'cobro', fecha: app.hoy, monto_centavos: pesosACentavos(monto) ?? 0, medio_pago: medio,
      origen_id: elegida!, tercero_id: tercero ?? undefined,
    })
    if (resultado.ok && !resultado.avisos.length) await guardar()
  }

  async function guardar() {
    if (!resultado?.ok) return
    await app.guardar(resultado.movimiento, 'Pago anotado')
    app.ir('inicio')
  }
</script>

<button class="back" onclick={() => app.atras()}>‹ Volver</button>
<h1>💰 Me pagó {nombre}</h1>

{#each ventas as { venta, saldo } (venta.movimiento_id)}
  {@const atraso = diasEntre(fechaPromesaEfectiva(venta), app.hoy)}
  <button class="person" class:on={elegida === venta.movimiento_id} onclick={() => elegir(venta.movimiento_id, saldo)}>
    <span>Venta del {fechaCorta(venta.fecha)}<br /><span class="sub">Debe {pesos(saldo)} de {pesos(venta.monto_centavos)}</span></span>
    <span>{#if atraso > 0}<span class="tag">vencida</span>{/if}</span>
  </button>
{/each}

{#if elegida}
  <Teclado bind:valor={monto} />
  <div class="chips" style="justify-content:center">
    {#each ['efectivo', 'transferencia', 'tarjeta'] as const as m (m)}
      <button class="chip" class:on={medio === m} onclick={() => (medio = m)}>{MEDIO[m]}</button>
    {/each}
  </div>
{/if}

{#if resultado && !resultado.ok}<div class="error" role="alert">{resultado.errores.map((x) => x.mensaje).join(' ')}</div>{/if}
<button class="btn" disabled={!elegida || !(pesosACentavos(monto) ?? 0)} onclick={listo}>Listo</button>

{#if resultado?.ok && resultado.avisos.length}
  <Avisos avisos={resultado.avisos} onguardar={guardar} oncorregir={() => (resultado = null)} />
{/if}
