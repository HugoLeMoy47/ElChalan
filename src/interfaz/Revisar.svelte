<script lang="ts">
  // F-10 · Cosas por revisar (UX-05): agrupadas por tipo, con qué movimiento o producto
  // es (tipo, fecha, monto, quién). Corregir o anular se hace desde el movimiento; aquí
  // se acepta o se pospone, una por una o todo el grupo (CH-04 §12.1).
  import { sumarDias, type Alerta, type Movimiento } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { TIPO, fechaCorta, pesos } from './textos.ts'

  /** Título del grupo, según cuántas son. */
  const GRUPO: Record<string, (n: number) => string> = {
    'AN-03': (n) => `${n} monto${n === 1 ? '' : 's'} más alto${n === 1 ? '' : 's'} que de costumbre`,
    'AN-04': (n) => `${n} posible${n === 1 ? '' : 's'} repetido${n === 1 ? '' : 's'}`,
    'AN-05': (n) => `${n} movimiento${n === 1 ? ' al que le' : 's a los que les'} falta algo`,
    'AN-06': (n) => `${n} venta${n === 1 ? '' : 's'} de productos sin costo`,
    'AN-07': (n) => `${n} venta${n === 1 ? '' : 's'} a crédito sin fecha de pago`,
    'AN-08': (n) => `${n} venta${n === 1 ? '' : 's'} donde los productos no suman el total`,
    'AN-09': (n) => `${n} cobro${n === 1 ? '' : 's'} de más`,
    'AN-10': (n) => `${n} devolución${n === 1 ? '' : 'es'} de más`,
    'AN-11': (n) => `${n} producto${n === 1 ? '' : 's'} con menos de cero`,
    'AN-12': () => 'Saldo menor a cero',
    'AN-13': () => 'Sacaste más de lo que ganaste',
    'AN-14': (n) => `${n} venta${n === 1 ? '' : 's'} por debajo del costo`,
    'AN-16': () => 'La hora del teléfono',
  }
  const EXPLICA: Record<string, string> = {
    'AN-06': 'Cuentan como si te hubieran costado $0. Ponles costo en Mis productos.',
    'AN-07': 'Si no pones cuándo te pagan, se cuentan 30 días.',
    'AN-11': 'Vendiste más de lo que tenías anotado. ¿Falta anotar una compra? También puedes contar y ajustar.',
  }
  const VISIBLES = 5

  let abiertos = $state<Record<string, boolean>>({})

  const grupos = $derived.by(() => {
    const porCodigo = new Map<string, Alerta[]>()
    for (const a of app.alertas) porCodigo.set(a.codigo, [...(porCodigo.get(a.codigo) ?? []), a])
    return [...porCodigo.entries()]
      .map(([codigo, alertas]) => ({ codigo, alertas, aviso: alertas[0].severidad !== 'informativa' }))
      .sort((a, b) => Number(b.aviso) - Number(a.aviso) || b.alertas.length - a.alertas.length)
  })

  const movimiento = (a: Alerta) => app.versiones?.porId.get(a.objeto_id) as Movimiento | undefined
  const producto = (a: Alerta) => app.estado!.productos.find((p) => p.producto_id === a.objeto_id)

  function ver(a: Alerta) {
    if (movimiento(a)) {
      app.seleccion = a.objeto_id
      app.ir('detalle')
    } else if (producto(a)) {
      app.productoSeleccionado = a.objeto_id
      app.ir('producto')
    }
  }

  async function todas(alertas: Alerta[], decision: 'aceptada' | 'pospuesta') {
    for (const a of alertas) await app.decidir(a, decision, decision === 'pospuesta' ? sumarDias(app.hoy, 7) : undefined)
    app.avisar(decision === 'aceptada' ? 'Listo: ya no se muestran' : 'Te las recuerdo en una semana')
  }
</script>

<button class="back" onclick={() => app.atras()}>‹ Volver</button>
<h1>Cosas por revisar</h1>
{#if grupos.length}<p class="sub" style="margin:-6px 0 12px">Toca una para verla. Nada se borra: si está bien así, la quitas de la lista.</p>{/if}

{#each grupos as g (g.codigo)}
  {@const lista = abiertos[g.codigo] ? g.alertas : g.alertas.slice(0, VISIBLES)}
  <section class="card grupo">
    <div class="grupo-titulo">
      <b>{GRUPO[g.codigo]?.(g.alertas.length) ?? g.alertas[0].mensaje}</b>
      <span class="tag" class:w={g.aviso} class:g={!g.aviso}>{g.aviso ? 'revisa' : 'para que sepas'}</span>
    </div>
    <p class="sub" style="margin:2px 0 8px">{EXPLICA[g.codigo] ?? g.alertas[0].mensaje}</p>

    {#each lista as a (a.objeto_id)}
      {@const m = movimiento(a)}
      {@const p = producto(a)}
      <div class="alerta">
        {#if m || p}
          <button class="alerta-ver" onclick={() => ver(a)}>
            {#if m}
              <span class="ico t-{m.tipo}" aria-hidden="true">{TIPO[m.tipo].icono}</span>
              <span class="alerta-texto">
                <span>{TIPO[m.tipo].texto} · {fechaCorta(m.fecha)}</span>
                <span class="sub">{[m.tercero_id && app.terceros.get(m.tercero_id)?.nombre, m.notas].filter(Boolean).join(' · ') || ' '}</span>
              </span>
              <b>{pesos(m.monto_centavos)}</b>
            {:else if p}
              <span class="ico t-compra" aria-hidden="true">📦</span>
              <span class="alerta-texto"><span>{p.nombre}</span><span class="sub">Ver el producto</span></span>
            {/if}
          </button>
        {:else}
          <span class="alerta-texto" style="padding:8px 0">{a.mensaje}</span>
        {/if}
        <button class="chip" onclick={() => app.decidir(a, 'aceptada')} aria-label="Está bien así">✓</button>
      </div>
    {/each}
    {#if g.alertas.length > VISIBLES}
      <button class="link" onclick={() => (abiertos[g.codigo] = !abiertos[g.codigo])}>{abiertos[g.codigo] ? 'Ver menos' : `Ver las ${g.alertas.length}`}</button>
    {/if}

    <div class="row" style="margin-top:8px">
      <button class="btn sec" style="margin:0" onclick={() => todas(g.alertas, 'aceptada')}>{g.alertas.length > 1 ? 'Todas están bien' : 'Está bien así'}</button>
      <button class="btn sec" style="margin:0" onclick={() => todas(g.alertas, 'pospuesta')}>Después</button>
    </div>
  </section>
{:else}
  <div class="card vacio">Todo en orden. ✔</div>
{/each}
