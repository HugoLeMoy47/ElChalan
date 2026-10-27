<script lang="ts">
  // Asistente de bienvenida, segunda parte (CH-19 §6), con el negocio ya creado:
  // productos opcionales y rápidos, sin hoja ni pantalla aparte (D-66); proteger los
  // datos (PIN y primer respaldo); lo que puedes hacer; y la primera venta. Cada paso se
  // puede omitir y se retoma desde el inicio donde se quedó.
  import { onMount } from 'svelte'
  import { pesosACentavos } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { pesos } from './textos.ts'

  /** Pasos 3 a 6 de 6 (los dos primeros están en Bienvenida). */
  const PRIMERO = 3
  const TOTAL = 4

  let paso = $state(Math.min(app.pasoAsistente() ?? 0, TOTAL - 1))
  let nombre = $state('')
  let precio = $state('')
  let campoNombre = $state<HTMLInputElement>()
  let pin = $state('')
  let pin2 = $state('')
  let poniendoPin = $state(false)
  let errorPin = $state('')
  let conPin = $state(app.tienePin())

  const productos = $derived(app.estado!.productos.filter((p) => p.activo))
  const respaldado = $derived(!!app.estado!.meta.ultimo_respaldo)

  onMount(() => { if (paso === 0) campoNombre?.focus() })

  function ir(n: number) {
    paso = n
    app.guardarPasoAsistente(n)
    globalThis.scrollTo?.(0, 0)
  }

  async function agregar() {
    if (!nombre.trim() || (precio !== '' && pesosACentavos(precio) === null)) return
    if (productos.some((p) => p.nombre.toLowerCase() === nombre.trim().toLowerCase())) {
      app.avisar(`${nombre.trim()} ya está en tus productos`)
      nombre = precio = ''
      return
    }
    const p = app.nuevoProducto({ nombre, unidad_medida: 'pieza', precio: precio === '' ? undefined : pesosACentavos(precio)! })
    await app.guardarProducto(p)
    nombre = precio = ''
    campoNombre?.focus()
  }

  async function guardarPin() {
    errorPin = ''
    if (!/^\d{4,6}$/.test(pin)) return (errorPin = 'El PIN lleva de 4 a 6 números.')
    if (pin !== pin2) return (errorPin = 'Los dos PIN no son iguales.')
    await app.ponerPin(pin)
    conPin = true
    poniendoPin = false
    pin = pin2 = ''
  }

  function terminar(primeraVenta: boolean) {
    app.guardarPasoAsistente(null)
    app.pestana('inicio')
    if (primeraVenta) app.anotar('venta')
    else app.avisar('¡Listo! Tu negocio está preparado')
  }
</script>

<div class="top">
  <button class="back" onclick={() => (paso > 0 ? ir(paso - 1) : app.atras())}>‹ {paso > 0 ? 'Atrás' : 'Al inicio'}</button>
  <span class="sub">Paso {paso + PRIMERO} de 6</span>
</div>
<div class="avance" role="progressbar" aria-valuemin="1" aria-valuemax="6" aria-valuenow={paso + PRIMERO} aria-label={`Paso ${paso + PRIMERO} de 6`}>
  {#each [1, 2, 3, 4, 5, 6] as i (i)}<span class:on={i <= paso + PRIMERO}></span>{/each}
</div>

{#if paso === 0}
  <h1>¿Qué es lo que más vendes?</h1>
  <p class="sub" style="margin-top:-6px">Escribe tus productos con su precio y toca ＋. Es <b>opcional</b>: también los puedes agregar después, al vender o al comprar.</p>
  <div class="alta-rapida">
    <input bind:this={campoNombre} bind:value={nombre} placeholder="Producto…" aria-label="Nombre del producto" maxlength="60" enterkeyhint="next"
      onkeydown={(ev) => { if (ev.key === 'Enter') (ev.currentTarget.nextElementSibling as HTMLInputElement)?.focus() }} />
    <input bind:value={precio} inputmode="decimal" placeholder="$ precio" aria-label="Precio" enterkeyhint="done"
      onkeydown={(ev) => ev.key === 'Enter' && agregar()} />
    <button class="btn" disabled={!nombre.trim()} onclick={agregar} aria-label="Agregar producto">＋</button>
  </div>
  {#if productos.length}
    <div class="chips">
      {#each productos as p (p.producto_id)}<span class="chip on" style="display:inline-flex;align-items:center">{p.nombre}{p.precio_venta_centavos !== undefined ? ` · ${pesos(p.precio_venta_centavos)}` : ''}</span>{/each}
    </div>
    <p class="sub">Lo que te cuesta cada uno se pone solo cuando anotes una compra.</p>
  {/if}
  <div style="height:8px"></div>
  <button class="btn" onclick={() => ir(1)}>{productos.length ? 'Siguiente' : 'Siguiente sin productos'}</button>

{:else if paso === 1}
  <h1>Protege tus datos</h1>
  <p class="sub" style="margin-top:-6px">Todo vive en este teléfono. Si se pierde o se borra, solo un respaldo te salva.</p>

  <div class="card">
    <div class="beneficio" style="padding:0 0 8px"><span class="ico t-venta" aria-hidden="true">💾</span>
      <span><b>Tu primer respaldo</b><br /><span class="sub">Un archivo que mandas a tu correo, WhatsApp o Drive. Tiene que salir del teléfono.</span></span></div>
    {#if respaldado}<p class="hecho">✔ Ya hiciste tu primer respaldo.</p>
    {:else}<button class="btn" onclick={() => app.respaldar()}>Hacer mi primer respaldo</button>{/if}
  </div>

  <div class="card">
    <div class="beneficio" style="padding:0 0 8px"><span class="ico t-ajuste_efectivo" aria-hidden="true">🔒</span>
      <span><b>Candado con PIN</b> (opcional)<br /><span class="sub">Pide un PIN al abrir la app. Se guarda solo en este teléfono.</span></span></div>
    {#if conPin}<p class="hecho">✔ Tu app ya tiene candado.</p>
    {:else if poniendoPin}
      <input type="password" inputmode="numeric" autocomplete="off" maxlength="6" bind:value={pin} placeholder="PIN de 4 a 6 números…" aria-label="PIN" />
      <div style="height:8px"></div>
      <input type="password" inputmode="numeric" autocomplete="off" maxlength="6" bind:value={pin2} placeholder="Escríbelo otra vez…" aria-label="Repite el PIN" />
      {#if errorPin}<div class="error" role="alert">{errorPin}</div>{/if}
      <div style="height:8px"></div>
      <button class="btn" disabled={pin.length < 4} onclick={guardarPin}>Guardar PIN</button>
    {:else}<button class="btn sec" style="background:var(--panel)" onclick={() => (poniendoPin = true)}>Poner candado</button>{/if}
  </div>
  <button class="btn" onclick={() => ir(2)}>{respaldado ? 'Siguiente' : 'Siguiente, lo respaldo después'}</button>

{:else if paso === 2}
  <h1>Lo que puedes hacer</h1>
  <div class="beneficio"><span class="ico t-venta" aria-hidden="true">＋</span>
    <span><b>Anotar</b>, abajo al centro<br /><span class="sub">Ventas, compras, gastos y lo que sacas o pones. Con «Listo y otra» anotas varias seguidas.</span></span></div>
  <div class="beneficio"><span class="ico t-cobro" aria-hidden="true">🤝</span>
    <span><b>Me deben</b><br /><span class="sub">Si fías, al vender marca «Me deben»: aquí ves quién te debe, cuánto y desde cuándo.</span></span></div>
  <div class="beneficio"><span class="ico t-compra" aria-hidden="true">📦</span>
    <span><b>Mis productos</b>, en Más<br /><span class="sub">Cuántos tienes, cuáles se están acabando y cuánto vale tu bodega.</span></span></div>
  <div class="beneficio"><span class="ico t-devolucion_venta" aria-hidden="true">🔎</span>
    <span><b>Cosas por revisar</b><br /><span class="sub">La app te avisa si algo no cuadra, como una venta repetida o por debajo del costo.</span></span></div>
  <div class="beneficio"><span class="ico t-aportacion" aria-hidden="true">📅</span>
    <span><b>Semana y mes</b>, en Más<br /><span class="sub">Cómo te fue, comparado con antes.</span></span></div>
  <div style="height:8px"></div>
  <button class="btn" onclick={() => ir(3)}>Siguiente</button>

{:else}
  <h1>¿Anotamos tu primera venta?</h1>
  <p class="sub" style="margin-top:-6px">Toca «Vendí», escribe cuánto y «Listo». Así de fácil.</p>
  <div class="tengo" style="margin:14px 0">
    <h2>{app.estado!.negocio.nombre}</h2>
    <div class="big">¡Listo!</div>
    <div class="medios"><span>{productos.length ? `${productos.length} producto${productos.length === 1 ? '' : 's'}` : 'Sin productos aún'}</span><span>{respaldado ? 'Con respaldo' : 'Sin respaldo aún'}</span>{#if conPin}<span>Con candado</span>{/if}</div>
  </div>
  <button class="btn" onclick={() => terminar(true)}>🛒 Anotar mi primera venta</button>
  <button class="btn sec" onclick={() => terminar(false)}>Ir al inicio</button>
{/if}
