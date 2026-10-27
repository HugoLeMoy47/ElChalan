<script lang="ts">
  // «Más» de la barra inferior (UX-04): lo que antes era la lista al fondo del inicio.
  import { diasEntre } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { haceDias, pesos } from './textos.ts'

  const e = $derived(app.estado!)
  const diasRespaldo = $derived(e.meta.ultimo_respaldo ? diasEntre(e.meta.ultimo_respaldo, app.hoy) : null)
  const activos = $derived(e.productos.filter((p) => p.activo).length)
</script>

<h1>Más</h1>

<button class="person" onclick={() => app.ir('productos')}>
  <span class="con-ico"><span class="ico t-compra" aria-hidden="true">📦</span>
    <span><b>Mis productos</b><br /><span class="sub">{activos ? `${activos} producto${activos === 1 ? '' : 's'} · cuántos tengo y cuánto vale mi bodega` : 'Da de alta lo que vendes'}</span></span>
  </span><span aria-hidden="true">›</span>
</button>
<button class="person" onclick={() => app.ir('periodo')}>
  <span class="con-ico"><span class="ico t-aportacion" aria-hidden="true">📅</span>
    <span><b>Semana y mes</b><br /><span class="sub">Cómo te fue, comparado con antes</span></span>
  </span><span aria-hidden="true">›</span>
</button>
<button class="person" onclick={() => app.ir('respaldo')}>
  <span class="con-ico"><span class="ico t-venta" aria-hidden="true">💾</span>
    <span><b>Respaldo</b><br /><span class="sub">{diasRespaldo === null ? 'Todavía no respaldas' : `Último: ${haceDias(diasRespaldo)}`}</span></span>
  </span>
  {#if diasRespaldo === null || diasRespaldo > 7}<span class="tag w">pendiente</span>{:else}<span aria-hidden="true">›</span>{/if}
</button>
<button class="person" onclick={() => app.ir('revisar')}>
  <span class="con-ico"><span class="ico t-devolucion_venta" aria-hidden="true">🔎</span>
    <span><b>Cosas por revisar</b><br /><span class="sub">{app.alertas.length ? `${app.alertas.length} pendiente${app.alertas.length === 1 ? '' : 's'}` : 'Todo en orden'}</span></span>
  </span><span aria-hidden="true">›</span>
</button>
<button class="person" onclick={() => app.ir('ajustes')}>
  <span class="con-ico"><span class="ico t-ajuste_efectivo" aria-hidden="true">⚙️</span>
    <span><b>Ajustes</b><br /><span class="sub">Nombre del negocio, candado con PIN</span></span>
  </span><span aria-hidden="true">›</span>
</button>

<p class="sub" style="text-align:center;margin-top:18px">{e.negocio.nombre} · tienes {pesos(app.vistas!.saldo_total)}</p>
