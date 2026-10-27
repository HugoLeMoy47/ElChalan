<script lang="ts">
  // F-0 · Primera vez: sin registro ni contraseña (D-28). Primera parte del asistente de
  // bienvenida (CH-19 §6): lo que hace la app, tu negocio y con cuánto empiezas, sin
  // preguntar el banco (D-65). Lo demás sigue en Asistente, con el negocio ya creado.
  import { pesosACentavos } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'

  const GIROS = [
    { id: 'reventa', texto: '🛍️ Reventa' }, { id: 'comida', texto: '🌮 Comida' },
    { id: 'servicios', texto: '✂️ Servicios' }, { id: 'otro', texto: '✨ Otro' },
  ]

  let paso = $state<'hola' | 'nombre' | 'capital'>('hola')
  let nombre = $state('')
  let giro = $state('')
  let capital = $state('')
  let ocupado = $state(false)

  async function crear(conCapital: boolean) {
    ocupado = true
    const centavos = conCapital ? pesosACentavos(capital) ?? undefined : undefined
    await app.crearNegocio(nombre, centavos, giro || undefined)
  }
</script>

{#snippet avance(n: number)}
  <div class="avance" role="progressbar" aria-valuemin="1" aria-valuemax="6" aria-valuenow={n} aria-label={`Paso ${n} de 6`}>
    {#each [1, 2, 3, 4, 5, 6] as i (i)}<span class:on={i <= n}></span>{/each}
  </div>
{/snippet}

{#if paso === 'hola'}
  <div class="tengo" style="margin-top:28px">
    <h2>Te damos la bienvenida a</h2>
    <div class="big">El Chalán</div>
    <div class="medios"><span>Sin internet</span><span>Sin cuenta</span><span>Gratis</span></div>
  </div>
  <div class="beneficio"><span class="ico t-venta" aria-hidden="true">⚡</span><span><b>Anota en segundos</b><br /><span class="sub">Lo que vendes, compras y gastas, con dos toques.</span></span></div>
  <div class="beneficio"><span class="ico t-aportacion" aria-hidden="true">📈</span><span><b>Sabes si ganas</b><br /><span class="sub">Cuánto tienes, cuánto vendiste y cuánto te deja.</span></span></div>
  <div class="beneficio"><span class="ico t-cobro" aria-hidden="true">🤝</span><span><b>Sabes quién te debe</b><br /><span class="sub">Y desde cuándo, para cobrar a tiempo.</span></span></div>
  <p class="sub">Tus datos se quedan en este teléfono hasta que hagas un respaldo.</p>
  <button class="btn" onclick={() => (paso = 'nombre')}>Empezar</button>
  <button class="link" onclick={() => app.probarEjemplo()}>Probar con datos de ejemplo</button>
{:else if paso === 'nombre'}
  <button class="back" onclick={() => (paso = 'hola')}>‹ Volver</button>
  {@render avance(1)}
  <h1>¿Cómo se llama tu negocio?</h1>
  <input bind:value={nombre} placeholder="Por ejemplo: Novedades Lupita…" maxlength="60" aria-label="Nombre del negocio"
    enterkeyhint="next" onkeydown={(ev) => ev.key === 'Enter' && nombre.trim() && (paso = 'capital')} />
  <p class="f">¿Qué vendes? (opcional)</p>
  <div class="giro">
    {#each GIROS as g (g.id)}
      <button class="chip" class:on={giro === g.id} aria-pressed={giro === g.id} onclick={() => (giro = giro === g.id ? '' : g.id)}>{g.texto}</button>
    {/each}
  </div>
  <button class="btn" disabled={!nombre.trim()} onclick={() => (paso = 'capital')}>Siguiente</button>
{:else}
  <button class="back" onclick={() => (paso = 'nombre')}>‹ Volver</button>
  {@render avance(2)}
  <h1>¿Cuánto dinero tienes hoy en tu caja?</h1>
  <p class="sub">El efectivo del negocio con el que empiezas. Así «Tengo» arranca bien. Puedes dejarlo para después.</p>
  <label class="monto">
    <span aria-hidden="true">$</span>
    <input bind:value={capital} inputmode="decimal" placeholder="0" aria-label="Efectivo en caja" enterkeyhint="done"
      onkeydown={(ev) => ev.key === 'Enter' && pesosACentavos(capital) !== null && crear(true)} />
  </label>
  <button class="btn" disabled={ocupado || !capital || pesosACentavos(capital) === null} onclick={() => crear(true)}>Siguiente</button>
  <button class="btn sec" disabled={ocupado} onclick={() => crear(false)}>Ahora no</button>
{/if}
