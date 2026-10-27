<script lang="ts">
  // F-7 · Movimientos: por día, lo más nuevo arriba. Los anulados nunca desaparecen:
  // se ven tachados con un filtro aparte.
  import type { Movimiento, TipoMovimiento } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { TIPO, fechaCorta, pesos } from './textos.ts'

  let filtro = $state<TipoMovimiento | 'todos'>('todos')
  let verAnulados = $state(false)
  let cuantos = $state(60)

  const FILTROS: (TipoMovimiento | 'todos')[] = ['todos', 'venta', 'cobro', 'compra', 'gasto', 'retiro', 'aportacion', 'devolucion_venta']

  /** Las altas anuladas, mostradas con su última versión. */
  const anulados = $derived.by(() => {
    const v = app.versiones!
    const fuera: Movimiento[] = []
    for (const [raiz, vigente] of v.vigenteDeRaiz) {
      if (vigente) continue
      let ultima = v.porId.get(raiz)!
      while (v.sustituidaPor.has(ultima.movimiento_id) && v.porId.get(v.sustituidaPor.get(ultima.movimiento_id)!)!.operacion !== 'anulacion') {
        ultima = v.porId.get(v.sustituidaPor.get(ultima.movimiento_id)!)!
      }
      fuera.push(ultima)
    }
    return fuera
  })
  const lista = $derived(
    (verAnulados ? anulados : app.versiones!.vigentes)
      .filter((m) => filtro === 'todos' || m.tipo === filtro)
      .slice()
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : a.creado_en < b.creado_en ? 1 : -1)),
  )
  const visibles = $derived(lista.slice(0, cuantos))

  function quien(m: Movimiento) {
    return m.tercero_id ? app.terceros.get(m.tercero_id)?.nombre : undefined
  }
</script>

<button class="back" onclick={() => app.ir('inicio')}>‹ Volver</button>
<h1>Movimientos</h1>

<div class="chips">
  {#each FILTROS as f (f)}
    <button class="chip" class:on={filtro === f} onclick={() => (filtro = f)}>{f === 'todos' ? 'Todos' : TIPO[f].texto}</button>
  {/each}
</div>
<div class="sw">
  <span>Ver anulados</span>
  <button class:on={verAnulados} onclick={() => (verAnulados = !verAnulados)} aria-label="Ver anulados" aria-pressed={verAnulados}></button>
</div>

{#each visibles as m, i (m.movimiento_id)}
  {#if i === 0 || visibles[i - 1].fecha !== m.fecha}<div class="dia">{fechaCorta(m.fecha)}</div>{/if}
  <button class="person" class:tachado={verAnulados} onclick={() => { app.seleccion = m.movimiento_id; app.ir('detalle') }}>
    <span>
      {TIPO[m.tipo].icono} {TIPO[m.tipo].texto}{m.condicion === 'credito' ? ' a crédito' : ''}
      <br /><span class="sub">{[quien(m), m.categoria_gasto, m.notas].filter(Boolean).join(' · ') || ' '}</span>
    </span>
    <span style="text-align:right">
      <b class:neg={!TIPO[m.tipo].entra}>{TIPO[m.tipo].entra ? '' : '−'}{pesos(m.monto_centavos)}</b>
      {#if m.estado_registro === 'por_completar'}<br /><span class="tag w">falta algo</span>{/if}
    </span>
  </button>
{:else}
  <div class="card vacio">{verAnulados ? 'No hay movimientos anulados.' : 'Todavía no hay movimientos.'}</div>
{/each}
{#if lista.length > cuantos}
  <button class="btn sec" onclick={() => (cuantos += 60)}>Ver más</button>
{/if}
