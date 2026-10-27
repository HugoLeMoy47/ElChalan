<script lang="ts">
  // F-1 · Inicio: cuánto tengo, si gané y cuánto me deben (U-3).
  import { diasEntre } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { haceDias, pesos, porcentaje } from './textos.ts'

  let explica = $state(false)
  let confirmarBorrado = $state(false)

  const v = $derived(app.vistas!)
  const e = $derived(app.estado!)
  const banco = $derived(v.saldo_por_medio.transferencia + v.saldo_por_medio.tarjeta + v.saldo_por_medio.otro)
  const diasRespaldo = $derived(e.meta.ultimo_respaldo ? diasEntre(e.meta.ultimo_respaldo, app.hoy) : null)
  const almacenamientoEnRiesgo = $derived(app.almacenamiento && !app.almacenamiento.persistente)
  const avisos = $derived(app.alertas)
</script>

<div class="top">
  <h1>{e.negocio.nombre}</h1>
  <span class="sub">funciona sin internet</span>
</div>

{#if app.esEjemplo}
  <div class="strip">
    <span>Datos de ejemplo (inventados)</span>
    <button class="link" style="min-height:0;padding:0" onclick={() => (confirmarBorrado = true)}>Borrarlos</button>
  </div>
{/if}

{#if diasRespaldo === null}
  <button class="banner warn" onclick={() => app.ir('respaldo')}>
    <span>⚠️ <b>Sin respaldo.</b> Tus datos solo están en este teléfono.</span><b>Respaldar</b>
  </button>
{:else if diasRespaldo > 7}
  <button class="banner bad" onclick={() => app.ir('respaldo')}>
    <span>⚠️ Último respaldo: <b>{haceDias(diasRespaldo)}</b></span><b>Respaldar</b>
  </button>
{:else}
  <button class="banner ok" onclick={() => app.ir('respaldo')}>
    <span>✔ Último respaldo: <b>{haceDias(diasRespaldo)}</b></span><b>Respaldo</b>
  </button>
{/if}
{#if almacenamientoEnRiesgo}
  <div class="strip"><span>El teléfono podría borrar tus datos si se queda sin espacio. Respalda seguido.</span></div>
{/if}

<div class="card">
  <h2>Tengo</h2>
  <div class="big" class:neg={v.saldo_total < 0}>{pesos(v.saldo_total)}</div>
  <div class="row sub" style="margin-top:4px"><span>Efectivo {pesos(v.saldo_por_medio.efectivo)}</span><span>Banco y tarjeta {pesos(banco)}</span></div>
</div>

<div class="seg">
  <button class:on={app.periodo === 'semana'} onclick={() => (app.periodo = 'semana')}>Esta semana</button>
  <button class:on={app.periodo === 'mes'} onclick={() => (app.periodo = 'mes')}>Este mes</button>
</div>

<div class="grid2">
  <div class="stat"><div class="n">{pesos(v.ventas_netas)}</div><div class="l">Vendí</div></div>
  <div class="stat"><div class="n">{pesos(v.gastos)}</div><div class="l">Gasté</div></div>
  <div class="stat"><div class="n">{pesos(v.utilidad_bruta)}</div><div class="l">Me deja</div></div>
  <div class="stat">
    <div class="n" class:neg={v.utilidad_del_periodo < 0} class:pos={v.utilidad_del_periodo >= 0}>{pesos(v.utilidad_del_periodo)}</div>
    <div class="l">Gané <button class="link" style="min-height:0;padding:0" onclick={() => (explica = !explica)}>¿cómo?</button></div>
  </div>
  <div class="stat"><div class="n">{porcentaje(v.margen_sobre_costo_pb)}</div><div class="l">Margen sobre costo</div></div>
  <div class="stat"><div class="n">{pesos(v.compras)}</div><div class="l">Compré mercancía</div></div>
  <div class="stat ancho">
    <div class="n" class:neg={v.flujo_de_caja < 0}>{pesos(v.flujo_de_caja)}</div>
    <div class="l">Entró − salió <span class="sub">(el dinero que se movió; incluye lo que compraste)</span></div>
  </div>
</div>

{#if explica}
  <div class="card sub">
    <b>Me deja</b> = lo que vendí menos lo que me costó lo vendido.<br />
    <b>Gané</b> = Me deja menos lo que gasté. No le afecta la mercancía que aún tienes en bodega.<br />
    <b>Margen sobre costo</b> = cuánto gano sobre lo que me costó: {porcentaje(v.margen_sobre_costo_pb)}.<br />
    <b>Entró − salió</b> = ventas de contado y pagos que me hicieron, menos compras y gastos.
  </div>
{/if}
{#if v.ventas_sin_costo_pb}
  <p class="sub" style="margin:-4px 0 12px">⚠ {porcentaje(v.ventas_sin_costo_pb)} de lo que vendí no tiene costo; cuenta como si te hubiera costado $0.</p>
{/if}
{#if v.movimientos_por_completar}
  <p class="sub" style="margin:-4px 0 12px">Incluye {v.movimientos_por_completar} movimiento{v.movimientos_por_completar === 1 ? '' : 's'} al que le falta algo.</p>
{/if}

<button class="person" onclick={() => { app.terceroCobro = null; app.tipoCaptura = 'venta'; app.ir('deben') }}>
  <span>
    <b>Me deben</b> {pesos(v.por_cobrar)}<br />
    <span class="sub">{#if v.por_cobrar_vencido > 0}Vencido: <span class="neg">{pesos(v.por_cobrar_vencido)}</span>{:else}Nada vencido{/if}</span>
  </span><span>›</span>
</button>
<button class="person" onclick={() => app.ir('revisar')}>
  <span>
    <b>{avisos.length} cosa{avisos.length === 1 ? '' : 's'} por revisar</b><br />
    <span class="sub">{avisos.length ? avisos[0].mensaje : 'Todo en orden'}</span>
  </span><span>›</span>
</button>
<button class="person" onclick={() => app.ir('movimientos')}><span><b>Movimientos</b><br /><span class="sub">Todo lo que has anotado</span></span><span>›</span></button>

<button class="fab" onclick={() => app.ir('anotar')}>＋ Anotar</button>

{#if confirmarBorrado}
  <div class="modal" role="dialog" aria-modal="true">
    <div class="sheet">
      <h3>¿Borrar los datos de ejemplo?</h3>
      <p>Se borra todo este negocio de ejemplo. Tu negocio, si ya lo creaste, no se toca.</p>
      <button class="btn mal" onclick={() => app.borrarEjemplo()}>Sí, borrarlos</button>
      <button class="btn sec" onclick={() => (confirmarBorrado = false)}>No</button>
    </div>
  </div>
{/if}
