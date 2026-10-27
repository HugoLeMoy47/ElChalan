<script lang="ts">
  // F-0 · Primera vez: sin registro ni contraseña (D-28).
  import { pesosACentavos } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'

  let paso = $state<'hola' | 'nombre' | 'capital'>('hola')
  let nombre = $state('')
  let capital = $state('')
  let ocupado = $state(false)

  async function crear(conCapital: boolean) {
    ocupado = true
    const centavos = conCapital ? pesosACentavos(capital) ?? undefined : undefined
    await app.crearNegocio(nombre, centavos)
  }
</script>

{#if paso === 'hola'}
  <h1 style="margin-top:40px">El Chalán</h1>
  <p>Aquí anotas lo que vendes y lo que gastas. <b>Funciona sin internet.</b></p>
  <p class="sub">No necesitas cuenta ni contraseña. Tus datos se quedan en este teléfono hasta que hagas un respaldo.</p>
  <button class="btn" onclick={() => (paso = 'nombre')}>Empezar</button>
  <button class="link" onclick={() => app.probarEjemplo()}>Probar con datos de ejemplo</button>
{:else if paso === 'nombre'}
  <button class="back" onclick={() => (paso = 'hola')}>‹ Volver</button>
  <h1>¿Cómo se llama tu negocio?</h1>
  <input bind:value={nombre} placeholder="Por ejemplo: Novedades Lupita" maxlength="60" aria-label="Nombre del negocio" />
  <div style="height:12px"></div>
  <button class="btn" disabled={!nombre.trim()} onclick={() => (paso = 'capital')}>Siguiente</button>
{:else}
  <button class="back" onclick={() => (paso = 'nombre')}>‹ Volver</button>
  <h1>¿Con cuánto dinero empezaste?</h1>
  <p class="sub">Lo que tienes hoy en tu caja para el negocio. Puedes dejarlo para después.</p>
  <input bind:value={capital} inputmode="decimal" placeholder="$0" aria-label="Con cuánto empecé" />
  <div style="height:12px"></div>
  <button class="btn" disabled={ocupado || pesosACentavos(capital) === null} onclick={() => crear(true)}>Listo</button>
  <button class="btn sec" disabled={ocupado} onclick={() => crear(false)}>Omitir</button>
{/if}
