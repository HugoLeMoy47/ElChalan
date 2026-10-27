<script lang="ts">
  // F-13 · Ajustes: nombre del negocio, penalización de costumbre (D-60), candado con
  // PIN (solo en el teléfono), datos de ejemplo y «Acerca de».
  import { PENALIZACION_DEVOLUCION_PCT } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import Hoja from './Hoja.svelte'

  const e = $derived(app.estado!)
  let nombre = $state(app.estado!.negocio.nombre)
  let pena = $state(String(app.estado!.negocio.penalizacion_devolucion_pct ?? PENALIZACION_DEVOLUCION_PCT))
  let conPin = $state(app.tienePin())
  let pidiendoPin = $state<'poner' | 'quitar' | null>(null)
  let pin = $state('')
  let pin2 = $state('')
  let errorPin = $state('')
  let confirmarBorrado = $state(false)

  const penaValida = $derived(/^\d{1,3}$/.test(pena) && Number(pena) <= 100)

  async function guardarNombre() {
    await app.actualizarNegocio({ nombre: nombre.trim() })
    app.avisar('Nombre guardado')
  }

  async function guardarPena() {
    await app.actualizarNegocio({ penalizacion_devolucion_pct: Number(pena) })
    app.avisar('Penalización guardada')
  }

  async function confirmarPin() {
    errorPin = ''
    if (pidiendoPin === 'poner') {
      if (!/^\d{4,6}$/.test(pin)) return (errorPin = 'El PIN lleva de 4 a 6 números.')
      if (pin !== pin2) return (errorPin = 'Los dos PIN no son iguales.')
      await app.ponerPin(pin)
      conPin = true
      app.avisar('Candado puesto')
    } else {
      if (!(await app.desbloquear(pin))) return (errorPin = 'Ese no es tu PIN.')
      app.quitarPin()
      conPin = false
      app.avisar('Candado quitado')
    }
    pidiendoPin = null
    pin = pin2 = ''
  }
</script>

<button class="back" onclick={() => app.atras()}>‹ Volver</button>
<h1>Ajustes</h1>

<label class="f" for="nombre">Nombre de mi negocio</label>
<div class="row">
  <input id="nombre" bind:value={nombre} maxlength="60" style="flex:3" />
  <button class="btn sec" style="flex:1;margin:0" disabled={!nombre.trim() || nombre.trim() === e.negocio.nombre} onclick={guardarNombre}>Guardar</button>
</div>

<label class="f" for="pena">Penalización de costumbre cuando me devuelven (%)</label>
<div class="row">
  <input id="pena" bind:value={pena} inputmode="numeric" style="flex:3" />
  <button class="btn sec" style="flex:1;margin:0" disabled={!penaValida || Number(pena) === (e.negocio.penalizacion_devolucion_pct ?? PENALIZACION_DEVOLUCION_PCT)} onclick={guardarPena}>Guardar</button>
</div>
<p class="sub">Es lo que la app propone al anotar una devolución; siempre puedes cambiar el monto.</p>

<div class="dia">Candado con PIN</div>
<p class="sub">Pide un PIN al abrir la app. Se guarda solo en este teléfono y no viaja en el respaldo. Si lo olvidas, puedes restaurar tu negocio desde un respaldo.</p>
{#if conPin}
  <button class="btn sec" onclick={() => (pidiendoPin = 'quitar')}>Quitar el candado</button>
{:else}
  <button class="btn sec" onclick={() => (pidiendoPin = 'poner')}>Poner candado</button>
{/if}

<div class="dia">Mis datos</div>
<button class="btn sec" onclick={() => app.ir('respaldo')}>Respaldo</button>
{#if app.esEjemplo}
  <button class="btn mal" onclick={() => (confirmarBorrado = true)}>Borrar los datos de ejemplo</button>
{/if}

<div class="dia">Acerca de</div>
<p class="sub">El Chalán · versión {__VERSION_APP__}. Es una <b>prueba</b>: funciona sin internet y tus datos se quedan en este teléfono hasta que hagas un respaldo. No usa cuenta ni manda tus datos a ningún lado.</p>

{#if pidiendoPin}
  <Hoja titulo={pidiendoPin === 'poner' ? 'Poner candado' : 'Quitar el candado'} alCerrar={() => { pidiendoPin = null; pin = pin2 = ''; errorPin = '' }}>
    <label class="f" for="pin1">{pidiendoPin === 'poner' ? 'Tu PIN (4 a 6 números)' : 'Tu PIN actual'}</label>
    <input id="pin1" type="password" inputmode="numeric" autocomplete="off" bind:value={pin} maxlength="6" />
    {#if pidiendoPin === 'poner'}
      <label class="f" for="pin2">Escríbelo otra vez</label>
      <input id="pin2" type="password" inputmode="numeric" autocomplete="off" bind:value={pin2} maxlength="6" />
    {/if}
    {#if errorPin}<div class="error" role="alert">{errorPin}</div>{/if}
    <div style="height:12px"></div>
    <button class="btn" onclick={confirmarPin}>Listo</button>
    <button class="btn sec" onclick={() => { pidiendoPin = null; pin = pin2 = ''; errorPin = '' }}>Cancelar</button>
  </Hoja>
{/if}

{#if confirmarBorrado}
  <Hoja titulo={`¿Borrar los datos de ejemplo?`} alCerrar={() => (confirmarBorrado = false)}>
    <p>Se borra todo este negocio de ejemplo. Tu negocio, si ya lo creaste, no se toca.</p>
    <button class="btn mal" onclick={() => app.borrarEjemplo()}>Sí, borrarlos</button>
    <button class="btn sec" onclick={() => (confirmarBorrado = false)}>No</button>
  </Hoja>
{/if}
