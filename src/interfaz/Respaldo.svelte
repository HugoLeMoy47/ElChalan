<script lang="ts">
  // F-11 · Respaldo manual por archivo (M5a). Restaurar pregunta antes de reemplazar (P18).
  import { diasEntre } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { fechaCorta, haceDias } from './textos.ts'

  type Revision = Awaited<ReturnType<typeof app.revisarRespaldo>>

  let ocupado = $state(false)
  let revision = $state<Revision | null>(null)
  let entrada = $state<HTMLInputElement>()

  const ultimo = $derived(app.estado?.meta.ultimo_respaldo)

  async function respaldar() {
    ocupado = true
    app.error = null
    try {
      await app.respaldar()
    } catch (err) {
      // El detalle ayuda a diagnosticar desde el teléfono (RNF-18); no trae datos del negocio.
      const e = err as Error
      app.error = `No se pudo crear el respaldo. Intenta otra vez. (Detalle: ${e?.name ?? 'Error'}: ${e?.message ?? String(err)})`
    } finally {
      ocupado = false
    }
  }

  async function elegido(ev: Event) {
    const archivo = (ev.currentTarget as HTMLInputElement).files?.[0]
    if (!archivo) return
    revision = await app.revisarRespaldo(archivo)
    if (entrada) entrada.value = ''
  }
</script>

<button class="back" onclick={() => app.ir(app.bloqueado ? 'bloqueo' : app.estado ? 'inicio' : 'bienvenida')}>‹ Volver</button>
<h1>Respaldo</h1>

{#if app.estado && !app.bloqueado}
  <p>{ultimo ? `Último respaldo: ${haceDias(diasEntre(ultimo, app.hoy))} (${fechaCorta(ultimo)}).` : 'Todavía no has hecho un respaldo: tus datos solo están en este teléfono.'}</p>
  <button class="btn" disabled={ocupado} onclick={respaldar}>Respaldar ahora</button>
  <p class="sub">Se crea un archivo con todo tu negocio. Guárdalo fuera del teléfono: mándatelo por correo o súbelo a tu Drive. Es texto que cualquiera puede leer, así que cuídalo.</p>
{/if}

<div style="height:12px"></div>
<button class="btn sec" onclick={() => entrada?.click()}>Restaurar desde archivo</button>
<input bind:this={entrada} type="file" accept="application/json,.json,text/plain,.txt" style="display:none" onchange={elegido} />

{#if app.error}<div class="error">{app.error}</div>{/if}

{#if revision && !revision.ok}
  <div class="error">{revision.errores.join(' ')}</div>
{:else if revision?.ok}
  {@const r = revision}
  <div class="modal" role="dialog" aria-modal="true">
    <div class="sheet">
      <h3>¿Restaurar «{r.negocio}»?</h3>
      <p>Respaldo del {fechaCorta(r.fecha.slice(0, 10))} con {r.movimientos} movimientos.
        {#if app.estado}<b>Lo que hay ahora en este teléfono se reemplaza.</b>{/if}</p>
      <button class="btn" onclick={() => r.restaurar()}>Sí, restaurar</button>
      <button class="btn sec" onclick={() => (revision = null)}>No</button>
    </div>
  </div>
{/if}
