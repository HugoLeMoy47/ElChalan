<script lang="ts">
  // F-2 a F-4 y F-6: anotar o corregir una venta, compra, gasto, retiro o aportación.
  // Lo mínimo es el monto, con el teclado del teléfono (UX-28); cada tipo muestra de
  // entrada lo que necesita y solo fecha y notas van plegadas (UX-14). Nada obliga
  // (D-04), salvo el apodo de quien debe en una venta a crédito (D-55). En la compra
  // (y en la venta, si ya hay productos) va primero el producto, con alta ahí mismo
  // (D-64, UX-29). «Listo y otra» deja anotar varias seguidas (UX-06).
  import {
    CATEGORIAS_GASTO, calcularImporte, cambiosDeCosto, costoTrasCompra, pesosACentavos, sumarDias, textoAMilesimas,
    type CambioDeCosto, type CategoriaGasto, type DatosMovimiento, type DecisionCosto, type MedioPago, type Movimiento,
  } from '../dominio/index.ts'
  import { app, type Preparado } from './app.svelte.ts'
  import Avisos from './Avisos.svelte'
  import AltaProducto from './AltaProducto.svelte'
  import Monto from './Monto.svelte'
  import { CATEGORIA, MEDIO, TIPO, pesos } from './textos.ts'
  import Hoja from './Hoja.svelte'

  /** En una compra, `compra` es lo que se tecleó como costo de compra («a cuánto»). */
  interface LineaProducto { producto_id: string; cantidad: string; precio?: number; costo?: number; compra?: string }

  const tipo = app.tipoCaptura
  const original: Movimiento | undefined = app.corrigiendo ? app.versiones?.porId.get(app.corrigiendo) : undefined
  const e = app.estado!

  let monto = $state(original ? String(original.monto_centavos / 100) : '')
  let medio = $state<MedioPago>(original?.medio_pago ?? 'efectivo')
  let credito = $state(original?.condicion === 'credito')
  let quien = $state(original?.tercero_id ? app.terceros.get(original.tercero_id)?.nombre ?? '' : '')
  let promesa = $state(original?.fecha_promesa ?? '')
  let categoria = $state<CategoriaGasto | ''>(original?.categoria_gasto ?? '')
  let fecha = $state(original?.fecha ?? app.hoy)
  let notas = $state(original?.notas ?? '')
  let masDetalles = $state(!!original && (original.fecha !== app.hoy || !!original.notas))
  let lineas = $state<LineaProducto[]>(
    (original?.renglones ?? []).filter((r) => r.producto_id).map((r) => ({
      producto_id: r.producto_id!, cantidad: String(r.cantidad_milesimas / 1000),
      precio: r.precio_unitario_centavos, costo: r.costo_unitario_centavos,
      compra: tipo === 'compra' && r.precio_unitario_centavos !== undefined ? String(r.precio_unitario_centavos / 100) : undefined,
    })),
  )
  let buscar = $state('')
  let resultado = $state.raw<Preparado | null>(null)
  let ocupado = $state(false)
  /** Guardar y dejar el formulario listo para la siguiente (UX-06). */
  let otra = false
  /** Nombre con el que se abre el alta de producto, o null si está cerrada. */
  let alta = $state<string | null>(null)
  /** Preguntas «¿Actualizo el costo?» pendientes y lo que se va contestando (D-50). */
  let preguntas = $state.raw<CambioDeCosto[]>([])
  let respuestas = $state<DecisionCosto[]>([])

  const entra = TIPO[tipo].entra
  const conProductos = tipo === 'venta' || tipo === 'compra'
  const productoPrimero = tipo === 'compra' || (tipo === 'venta' && e.productos.some((p) => p.activo))
  const rol = tipo === 'compra' ? 'proveedor' : 'cliente'
  const conQuien = tipo === 'venta' || tipo === 'compra'
  // Del estado vivo: un producto dado de alta aquí mismo entra al catálogo.
  const catalogo = $derived(new Map(app.estado!.productos.map((p) => [p.producto_id, p])))
  const activos = $derived(app.estado!.productos.filter((p) => p.activo))
  const nombres = $derived(e.terceros.filter((t) => t.activo && t.rol === rol).map((t) => t.nombre))

  const precioDe = (l: LineaProducto) =>
    tipo === 'compra'
      ? pesosACentavos(l.compra ?? '') ?? catalogo.get(l.producto_id)?.costo_centavos ?? 0
      : l.precio ?? catalogo.get(l.producto_id)?.precio_venta_centavos ?? 0
  const cantidadDe = (l: LineaProducto) => textoAMilesimas(l.cantidad) ?? 0
  /** D-56: con productos, el total se suma solo. */
  const montoProductos = $derived(lineas.reduce((s, l) => s + calcularImporte(cantidadDe(l), precioDe(l)), 0))
  const centavos = $derived(lineas.length ? montoProductos : pesosACentavos(monto) ?? 0)
  const texto = $derived(buscar.trim().toLowerCase())
  const encontrados = $derived(
    texto.length < 2 ? [] : activos.filter((p) => `${p.nombre} ${p.clave ?? ''}`.toLowerCase().includes(texto)).slice(0, 6),
  )
  /** Sin buscar, los primeros productos a un toque. */
  const aLaMano = $derived(texto ? [] : activos.slice(0, 8))
  const yaExiste = $derived(activos.some((p) => p.nombre.toLowerCase() === texto))
  const hayFraccion = $derived(lineas.some((l) => cantidadDe(l) % 1000 !== 0))
  const sinCosto = $derived(tipo === 'venta' && lineas.some((l) => (l.costo ?? catalogo.get(l.producto_id)?.costo_centavos) === undefined))

  function agregar(id: string) {
    // Tocar otra vez el mismo producto suma uno.
    const ya = lineas.find((l) => l.producto_id === id)
    if (ya) {
      ya.cantidad = String((textoAMilesimas(ya.cantidad) ?? 0) / 1000 + 1)
      buscar = ''
      return
    }
    const costo = catalogo.get(id)?.costo_centavos
    lineas.push({ producto_id: id, cantidad: '1', compra: tipo === 'compra' && costo !== undefined ? String(costo / 100) : undefined })
    buscar = ''
  }

  function cambiarCantidad(l: LineaProducto, delta: number) {
    l.cantidad = String(Math.max(0, (textoAMilesimas(l.cantidad) ?? 0) / 1000 + delta))
  }

  async function listo(yOtra = false) {
    if (ocupado || centavos <= 0) return
    otra = yOtra
    ocupado = true
    app.error = null
    try {
      const datos: DatosMovimiento = { tipo, fecha, monto_centavos: centavos, medio_pago: medio }
      if (notas.trim()) datos.notas = notas.trim()
      if (tipo === 'venta') datos.condicion = credito ? 'credito' : 'contado'
      if (tipo === 'venta' && credito && promesa) datos.fecha_promesa = promesa
      if (tipo === 'gasto' && categoria) datos.categoria_gasto = categoria
      if (conQuien && quien.trim()) datos.tercero_id = await app.tercero(quien, rol)
      if (lineas.length) {
        delete datos.monto_centavos // se suma de los renglones (D-56)
        datos.renglones = lineas.filter((l) => cantidadDe(l) > 0).map((l) => ({
          producto_id: l.producto_id, cantidad_milesimas: cantidadDe(l),
          precio_unitario_centavos: tipo === 'compra' ? precioDe(l) : l.precio,
          costo_unitario_centavos: tipo === 'compra' ? undefined : l.costo,
        }))
      }
      resultado = app.preparar(datos)
      if (resultado.ok && !resultado.avisos.length) await guardar()
    } finally {
      ocupado = false
    }
  }

  async function guardar() {
    if (!resultado?.ok) return
    // Una compra con otro costo pregunta antes de guardar (AN-20); una corrección no.
    const cambios = tipo === 'compra' && !original ? cambiosDeCosto(resultado.movimiento, e.productos) : []
    if (cambios.length && respuestas.length < cambios.length) {
      preguntas = cambios
      return
    }
    await terminar()
  }

  function responder(decision: DecisionCosto) {
    respuestas.push(decision)
    if (respuestas.length === preguntas.length) terminar()
  }

  async function terminar() {
    if (!resultado?.ok) return
    const m = resultado.movimiento
    const antes = { ...app.existenciaHoy } // D-53 pondera con lo que había antes de comprar
    const seguir = otra && !original
    await app.guardar(m, original ? 'Corregido' : seguir ? `Anotado · van ${app.seguidas + 1} seguidas` : 'Anotado')
    if (tipo === 'compra' && !original) {
      for (const r of m.renglones) {
        const p = r.producto_id ? catalogo.get(r.producto_id) : undefined
        if (!p || r.precio_unitario_centavos === undefined) continue
        const i = preguntas.findIndex((c) => c.producto_id === p.producto_id)
        // Sin costo en el catálogo, se toma el de la compra; si había, manda la respuesta.
        const nuevo = p.costo_centavos === undefined
          ? r.precio_unitario_centavos
          : i >= 0 ? costoTrasCompra(respuestas[i], p.costo_centavos, antes[p.producto_id] ?? 0, r.cantidad_milesimas, r.precio_unitario_centavos) : p.costo_centavos
        if (nuevo !== p.costo_centavos) await app.guardarProducto({ ...p, costo_centavos: nuevo })
      }
    }
    if (seguir) app.otraCaptura()
    else app.ir('inicio')
  }

  const pregunta = $derived(preguntas[respuestas.length])
  const promedio = $derived.by(() => {
    if (!pregunta || !resultado?.ok) return undefined
    const r = resultado.movimiento.renglones.find((x) => x.producto_id === pregunta.producto_id)!
    return costoTrasCompra('promedio', pregunta.costo_catalogo, app.existenciaHoy[pregunta.producto_id] ?? 0, r.cantidad_milesimas, pregunta.costo_compra)
  })
</script>

<button class="back" onclick={() => app.atras()}>‹ Volver</button>
<h1 class="con-ico t-{tipo}"><span class="ico" aria-hidden="true">{TIPO[tipo].icono}</span> {original ? 'Corregir: ' : ''}{TIPO[tipo].texto}</h1>
{#if app.seguidas && !original}<p class="sub" style="margin:-6px 0 10px">Van {app.seguidas} seguida{app.seguidas === 1 ? '' : 's'}. La anterior ya quedó guardada.</p>{/if}

{#snippet bloqueMonto()}
  {#if lineas.length}
    <div class="total-prod"><span class="sub">Total</span><b>{pesos(montoProductos)}</b><span class="sub">se suma de los productos</span></div>
  {:else}
    {#if productoPrimero}<p class="f">{tipo === 'compra' ? '¿Sin producto? Escribe solo cuánto pagaste' : '¿Sin producto? Escribe solo el total'}</p>{/if}
    <Monto bind:valor={monto} enfocar={!productoPrimero} alListo={() => listo()}
      etiqueta={tipo === 'venta' ? '¿Cuánto vendiste?' : tipo === 'compra' ? '¿Cuánto pagaste?' : 'Monto'} />
  {/if}
{/snippet}

{#snippet bloqueProductos()}
  <p class="f">{tipo === 'compra' ? '¿Qué compraste?' : '¿Qué vendiste?'}{productoPrimero ? '' : ' (opcional)'}</p>
  {#each lineas as l, i (l.producto_id)}
    {@const p = catalogo.get(l.producto_id)}
    <div class="linea">
      <div class="linea-nombre">
        <b>{p?.nombre}</b>
        <span class="sub">{tipo === 'compra' ? `${pesos(calcularImporte(cantidadDe(l), precioDe(l)))}` : `${pesos(precioDe(l))} c/u · ${pesos(calcularImporte(cantidadDe(l), precioDe(l)))}`}</span>
      </div>
      <button class="paso" onclick={() => cambiarCantidad(l, -1)} aria-label="Uno menos">−</button>
      <input class="cant" bind:value={l.cantidad} inputmode="decimal" aria-label={`Cantidad de ${p?.nombre}`} />
      <button class="paso" onclick={() => cambiarCantidad(l, 1)} aria-label="Uno más">＋</button>
      <button class="paso quitar" onclick={() => lineas.splice(i, 1)} aria-label={`Quitar ${p?.nombre}`}>✕</button>
      {#if tipo === 'compra'}
        <label class="linea-costo"><span class="sub">a</span><input bind:value={l.compra} inputmode="decimal" placeholder="$…" aria-label={`A cuánto compraste ${p?.nombre}`} /><span class="sub">c/u</span></label>
      {/if}
    </div>
  {/each}
  <input bind:value={buscar} placeholder={activos.length ? 'Busca o escribe uno nuevo…' : 'Escribe el nombre del producto…'} aria-label="Buscar o agregar producto"
    onkeydown={(ev) => { if (ev.key === 'Enter' && texto.length >= 2) { if (encontrados.length) agregar(encontrados[0].producto_id); else alta = buscar.trim() } }} />
  {#if aLaMano.length}
    <div class="chips">
      {#each aLaMano as p (p.producto_id)}<button class="chip" onclick={() => agregar(p.producto_id)}>{p.nombre}</button>{/each}
    </div>
  {/if}
  {#each encontrados as p (p.producto_id)}
    <button class="person" onclick={() => agregar(p.producto_id)}>
      <span>{p.nombre}<br /><span class="sub">{p.clave ?? ''}</span></span>
      <span>{pesos((tipo === 'compra' ? p.costo_centavos : p.precio_venta_centavos) ?? 0)}</span>
    </button>
  {/each}
  {#if texto.length >= 2 && !yaExiste}
    <button class="person nuevo" onclick={() => (alta = buscar.trim())}>
      <span><b>＋ Agregar «{buscar.trim()}»</b><br /><span class="sub">Producto nuevo: se guarda en Mis productos</span></span>
    </button>
  {:else if !texto && !activos.length}
    <button class="link" onclick={() => (alta = '')}>＋ Dar de alta un producto</button>
  {/if}
  {#if lineas.length && tipo === 'venta'}<p class="sub">El precio y el costo se copian de tus productos.</p>{/if}
  {#if sinCosto}<p class="sub">⚠ Un producto no tiene costo: contará como si te hubiera costado $0.</p>{/if}
  {#if hayFraccion}<p class="sub">Con cantidades con decimales, el importe se redondea a múltiplos de 5 centavos.</p>{/if}
{/snippet}

{#if productoPrimero}
  {@render bloqueProductos()}
  {@render bloqueMonto()}
{:else}
  {@render bloqueMonto()}
  {#if conProductos}{@render bloqueProductos()}{/if}
{/if}

{#if tipo === 'venta'}
  <div class="sw">
    <span><b>Me deben</b><br /><span class="sub">Es una venta a crédito</span></span>
    <button class:on={credito} onclick={() => (credito = !credito)} aria-label="Me deben" aria-pressed={credito}></button>
  </div>
  {#if credito}
    <label class="f" for="quien">¿Quién te debe? (obligatorio)</label>
    <input id="quien" bind:value={quien} list="nombres" placeholder="Nombre o apodo…" />
    <label class="f" for="promesa">¿Cuándo te paga? (opcional)</label>
    <input id="promesa" type="date" bind:value={promesa} min={fecha} />
    {#if !promesa}<p class="sub">Si lo dejas vacío, se cuenta a 30 días: {sumarDias(fecha, 30).split('-').reverse().join('/')}.</p>{/if}
  {/if}
{/if}

{#if tipo === 'gasto'}
  <p class="f">¿En qué gastaste?</p>
  <div class="chips">
    {#each CATEGORIAS_GASTO as c (c)}
      <button class="chip" class:on={categoria === c} onclick={() => (categoria = categoria === c ? '' : c)}>{CATEGORIA[c]}</button>
    {/each}
  </div>
{/if}

{#if !(tipo === 'venta' && credito)}
  <p class="f">¿Cómo {entra ? 'te pagaron' : 'pagaste'}?</p>
  <div class="chips">
    {#each ['efectivo', 'transferencia', 'tarjeta'] as const as m (m)}
      <button class="chip" class:on={medio === m} onclick={() => (medio = m)}>{MEDIO[m]}</button>
    {/each}
  </div>
{/if}

{#if conQuien && !(tipo === 'venta' && credito)}
  <label class="f" for="quien2">{tipo === 'compra' ? '¿A quién le compraste? (opcional)' : '¿A quién le vendiste? (opcional)'}</label>
  <input id="quien2" bind:value={quien} list="nombres" placeholder="Nombre o apodo…" />
{/if}

<button class="link" aria-expanded={masDetalles} onclick={() => (masDetalles = !masDetalles)}>{masDetalles ? 'Ocultar fecha y notas' : 'Otra fecha o notas'}</button>
{#if masDetalles}
  <label class="f" for="fecha">¿Cuándo fue?</label>
  <input id="fecha" type="date" bind:value={fecha} max={sumarDias(app.hoy, 1)} />
  <label class="f" for="notas">Notas</label>
  <textarea id="notas" bind:value={notas} maxlength="200"></textarea>
{/if}

<datalist id="nombres">
  {#each nombres as n (n)}<option value={n}></option>{/each}
</datalist>

{#if resultado && !resultado.ok}
  <div class="error" role="alert">{resultado.errores.map((x) => x.mensaje).join(' ')}</div>
{/if}

<div style="height:8px"></div>
{#if original}
  <button class="btn" disabled={ocupado || centavos <= 0} onclick={() => listo()}>Listo</button>
{:else}
  <div class="row">
    <button class="btn" disabled={ocupado || centavos <= 0} onclick={() => listo()}>Listo</button>
    <button class="btn sec" disabled={ocupado || centavos <= 0} onclick={() => listo(true)}>Listo y otra</button>
  </div>
{/if}
{#if centavos <= 0}<p class="sub" style="text-align:center;margin-top:-2px">{lineas.length ? 'Escribe la cantidad de los productos.' : productoPrimero ? 'Elige un producto o escribe el total.' : 'Escribe el monto para poder guardar.'}</p>{/if}

{#if alta !== null}
  <AltaProducto nombreInicial={alta} desde={tipo === 'compra' ? 'compra' : 'venta'} alCerrar={() => (alta = null)}
    alGuardar={(p) => { alta = null; agregar(p.producto_id) }} />
{/if}

{#if resultado?.ok && resultado.avisos.length && !preguntas.length}
  <Avisos avisos={resultado.avisos} onguardar={guardar} oncorregir={() => (resultado = null)} />
{/if}

{#if pregunta}
  {@const nombre = catalogo.get(pregunta.producto_id)?.nombre}
  <Hoja titulo={`¿Actualizo el costo de ${nombre}?`} alCerrar={() => { preguntas = []; respuestas = [] }}>
    <p>Esta vez te costó <b>{pesos(pregunta.costo_compra)}</b>; en tus productos dice <b>{pesos(pregunta.costo_catalogo)}</b>.</p>
    <button class="btn" onclick={() => responder('si')}>Sí, ahora me cuesta {pesos(pregunta.costo_compra)}</button>
    <button class="btn sec" onclick={() => responder('no')}>No, déjalo en {pesos(pregunta.costo_catalogo)}</button>
    {#if promedio !== undefined}<button class="btn sec" onclick={() => responder('promedio')}>Usar el promedio: {pesos(promedio)}</button>{/if}
    <p class="sub">El promedio toma en cuenta lo que ya tenías en bodega. Las ventas ya anotadas no cambian.</p>
  </Hoja>
{/if}
