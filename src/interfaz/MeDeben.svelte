<script lang="ts">
  // F-8 · Lo que me deben, por persona; los vencidos primero. Tocar a alguien lleva a
  // registrar su pago (F-5).
  import { diasEntre, fechaPromesaEfectiva, type Movimiento } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { pesos } from './textos.ts'

  interface Persona { id: string; nombre: string; saldo: number; vencido: number; atraso: number; ventas: number }

  const personas = $derived.by(() => {
    const porPersona = new Map<string, Persona>()
    for (const [ventaId, saldo] of Object.entries(app.vistas!.por_cobrar_por_venta)) {
      const venta = app.versiones!.porId.get(ventaId) as Movimiento
      const id = venta.tercero_id ?? ''
      const p = porPersona.get(id) ?? { id, nombre: app.terceros.get(id)?.nombre ?? '(sin nombre)', saldo: 0, vencido: 0, atraso: 0, ventas: 0 }
      const atraso = diasEntre(fechaPromesaEfectiva(venta), app.hoy)
      p.saldo += saldo
      p.ventas++
      if (atraso > 0) {
        p.vencido += saldo
        p.atraso = Math.max(p.atraso, atraso)
      }
      porPersona.set(id, p)
    }
    return [...porPersona.values()].sort((a, b) => b.atraso - a.atraso || b.saldo - a.saldo)
  })
  const deAnotar = app.tipoCaptura === 'cobro'
</script>

<button class="back" onclick={() => app.atras()}>‹ Volver</button>
<h1>{deAnotar ? '¿Quién te pagó?' : 'Lo que me deben'}</h1>
<p class="sub" style="margin:-6px 0 12px">Los que ya se pasaron de la fecha aparecen primero. Toca a alguien para anotar su pago.</p>

{#each personas as p (p.id)}
  <button class="person" onclick={() => { app.terceroCobro = p.id; app.ir('cobro') }}>
    <span><b>{p.nombre}</b><br /><span class="sub">{p.ventas} venta{p.ventas === 1 ? '' : 's'} pendiente{p.ventas === 1 ? '' : 's'}</span></span>
    <span style="text-align:right">
      <b>{pesos(p.saldo)}</b><br />
      {#if p.vencido > 0}<span class="tag">vencido hace {p.atraso} día{p.atraso === 1 ? '' : 's'}</span>{:else}<span class="tag g">al corriente</span>{/if}
    </span>
  </button>
{:else}
  <div class="card vacio">Nadie te debe nada. 🎉</div>
{/each}
