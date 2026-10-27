<script lang="ts">
  // F-1 · Inicio: cuánto tengo, cuánto vendí y cuánto gasté (D-63). Lo demás (Me deja,
  // Gané, margen, compras, entró − salió) va en «Ver más», sin perder ninguna cifra.
  // Un solo aviso a la vez (UX-03); moverse, en la barra inferior (D-62).
  import { diasEntre } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { fechaLarga, haceDias, pesos, porcentaje } from './textos.ts'
  import Hoja from './Hoja.svelte'

  const CLAVE_VER_MAS = 'elchalan:ver-mas'

  let explica = $state(false)
  let confirmarBorrado = $state(false)
  let verMas = $state(leerVerMas())

  function leerVerMas(): boolean {
    try { return localStorage.getItem(CLAVE_VER_MAS) === '1' } catch { return false }
  }
  function alternarVerMas() {
    verMas = !verMas
    try { localStorage.setItem(CLAVE_VER_MAS, verMas ? '1' : '0') } catch { /* solo es una comodidad */ }
  }

  const v = $derived(app.vistas!)
  const e = $derived(app.estado!)
  const banco = $derived(v.saldo_por_medio.transferencia + v.saldo_por_medio.tarjeta + v.saldo_por_medio.otro)
  const diasRespaldo = $derived(e.meta.ultimo_respaldo ? diasEntre(e.meta.ultimo_respaldo, app.hoy) : null)
  const almacenamientoEnRiesgo = $derived(app.almacenamiento && !app.almacenamiento.persistente)
  const avisos = $derived(app.alertas)
  const fecha = $derived(fechaLarga(app.hoy, app.hoy))
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
</script>

<header class="hola">
  <div>
    <div class="sub">{saludo} · {fecha}</div>
    <h1>{e.negocio.nombre}</h1>
  </div>
</header>

{#if app.actualizar}
  {@const activar = app.actualizar}
  <button class="banner ok" onclick={activar}><span>Hay una versión nueva de la app.</span><b>Actualizar</b></button>
{/if}

<!-- Un solo aviso: los datos de ejemplo, o el respaldo si hace falta (el bueno vive en «Más»). -->
{#if app.esEjemplo}
  <div class="strip">
    <span>Datos de ejemplo (inventados)</span>
    {#if app.tieneNegocioPropio}
      <button class="link" style="min-height:0;padding:0" onclick={() => app.borrarEjemplo()}>Volver a mi negocio</button>
    {:else}
      <button class="link" style="min-height:0;padding:0" onclick={() => (confirmarBorrado = true)}>Borrarlos</button>
    {/if}
  </div>
{:else if diasRespaldo === null || diasRespaldo > 7}
  <button class="banner" class:warn={diasRespaldo === null} class:bad={diasRespaldo !== null} onclick={() => app.ir('respaldo')}>
    <span>
      ⚠️ {#if diasRespaldo === null}<b>Sin respaldo.</b> Tus datos solo están en este teléfono.{:else}Último respaldo: <b>{haceDias(diasRespaldo)}</b>.{/if}
      {#if almacenamientoEnRiesgo} Y el teléfono podría borrarlos si se queda sin espacio.{/if}
    </span><b>Respaldar</b>
  </button>
{/if}

<div class="tengo">
  <h2>Tengo</h2>
  <div class="big">{pesos(v.saldo_total)}</div>
  <div class="medios">
    <span>💵 Efectivo {pesos(v.saldo_por_medio.efectivo)}</span>
    <span>🏦 Banco y tarjeta {pesos(banco)}</span>
  </div>
  {#if v.saldo_total < 0}<div class="medios"><span>Vas en números rojos</span></div>{/if}
</div>

<div class="seg">
  <button class:on={app.periodo === 'semana'} onclick={() => (app.periodo = 'semana')}>Esta semana</button>
  <button class:on={app.periodo === 'mes'} onclick={() => (app.periodo = 'mes')}>Este mes</button>
</div>

<div class="grid2">
  <div class="stat t-venta"><div class="l">Vendí</div><div class="n">{pesos(v.ventas_netas)}</div></div>
  <div class="stat t-gasto"><div class="l">Gasté</div><div class="n">{pesos(v.gastos)}</div></div>
</div>
{#if v.movimientos_por_completar}
  <p class="sub" style="margin:-4px 0 12px">Incluye {v.movimientos_por_completar} movimiento{v.movimientos_por_completar === 1 ? '' : 's'} al que le falta algo.</p>
{/if}

<button class="vermas" aria-expanded={verMas} onclick={alternarVerMas}>
  {verMas ? 'Ver menos' : 'Ver más: Gané, Me deja, margen…'} <span aria-hidden="true">{verMas ? '▴' : '▾'}</span>
</button>

{#if verMas}
  <div class="grid2">
    <div class="stat">
      <div class="l">Gané <button class="link" style="min-height:0;padding:0" onclick={() => (explica = !explica)}>¿cómo?</button></div>
      <div class="n" class:neg={v.utilidad_del_periodo < 0} class:pos={v.utilidad_del_periodo > 0}>{pesos(v.utilidad_del_periodo)}</div>
    </div>
    <div class="stat"><div class="l">Me deja</div><div class="n">{pesos(v.utilidad_bruta)}</div></div>
    <div class="stat">
      <div class="l">Margen sobre costo</div>
      {#if v.margen_sobre_costo_pb === null}<div class="n sub">Sin costos aún</div>{:else}<div class="n">{porcentaje(v.margen_sobre_costo_pb)}</div>{/if}
    </div>
    <div class="stat t-compra"><div class="l">Compré mercancía</div><div class="n">{pesos(v.compras)}</div></div>
    <div class="stat ancho">
      <div class="l">Entró − salió <span class="sub">(el dinero que se movió; incluye lo que compraste)</span></div>
      <div class="n" class:neg={v.flujo_de_caja < 0}>{pesos(v.flujo_de_caja)}</div>
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
  <button class="link" style="margin:-6px 0 8px" onclick={() => app.ir('periodo')}>Compararlo con el periodo anterior ›</button>
{/if}

{#if v.por_cobrar > 0}
  <button class="person" onclick={() => { app.terceroCobro = null; app.tipoCaptura = 'venta'; app.pestana('deben') }}>
    <span class="con-ico"><span class="ico t-cobro" aria-hidden="true">🤝</span>
      <span><b>Me deben {pesos(v.por_cobrar)}</b><br />
        <span class="sub">{#if v.por_cobrar_vencido > 0}Vencido: <span class="neg">{pesos(v.por_cobrar_vencido)}</span>{:else}Nada vencido{/if}</span>
      </span>
    </span><span aria-hidden="true">›</span>
  </button>
{/if}
{#if avisos.length}
  <button class="person" onclick={() => app.ir('revisar')}>
    <span class="con-ico"><span class="ico t-devolucion_venta" aria-hidden="true">🔎</span>
      <span><b>{avisos.length} cosa{avisos.length === 1 ? '' : 's'} por revisar</b><br /><span class="sub">{avisos[0].mensaje}</span></span>
    </span><span aria-hidden="true">›</span>
  </button>
{/if}

{#if confirmarBorrado}
  <Hoja titulo={`¿Borrar los datos de ejemplo?`} alCerrar={() => (confirmarBorrado = false)}>
    <p>Se borra todo este negocio de ejemplo. Tu negocio, si ya lo creaste, no se toca.</p>
    <button class="btn mal" onclick={() => app.borrarEjemplo()}>Sí, borrarlos</button>
    <button class="btn sec" onclick={() => (confirmarBorrado = false)}>No</button>
  </Hoja>
{/if}
