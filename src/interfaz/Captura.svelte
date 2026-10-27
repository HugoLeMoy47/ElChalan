<script lang="ts">
  // F-2 a F-4 y F-6: anotar o corregir una venta, compra, gasto, retiro o aportación.
  // Lo mínimo es el monto; lo demás va en «Agregar detalles» y nunca obliga (D-04),
  // salvo el apodo de quien debe en una venta a crédito (D-55).
  import {
    CATEGORIAS_GASTO, calcularImporte, cambiosDeCosto, costoTrasCompra, pesosACentavos, sumarDias, textoAMilesimas,
    type CambioDeCosto, type CategoriaGasto, type DatosMovimiento, type DecisionCosto, type MedioPago, type Movimiento,
  } from '../dominio/index.ts'
  import { app, type Preparado } from './app.svelte.ts'
  import Avisos from './Avisos.svelte'
  import Teclado from './Teclado.svelte'
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
  let detalles = $state(!!original && (original.medio_pago !== 'efectivo' || original.fecha !== app.hoy || !!original.notas))
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
  /** Preguntas «¿Actualizo el costo?» pendientes y lo que se va contestando (D-50). */
  let preguntas = $state.raw<CambioDeCosto[]>([])
  let respuestas = $state<DecisionCosto[]>([])

  const entra = TIPO[tipo].entra
  const conProductos = (tipo === 'venta' || tipo === 'compra') && e.productos.some((p) => p.activo)
  const rol = tipo === 'compra' ? 'proveedor' : 'cliente'
  const conQuien = tipo === 'venta' || tipo === 'compra'
  const catalogo = new Map(e.productos.map((p) => [p.producto_id, p]))
  const nombres = $derived(e.terceros.filter((t) => t.activo && t.rol === rol).map((t) => t.nombre))

  const precioDe = (l: LineaProducto) =>
    tipo === 'compra'
      ? pesosACentavos(l.compra ?? '') ?? catalogo.get(l.producto_id)?.costo_centavos ?? 0
      : l.precio ?? catalogo.get(l.producto_id)?.precio_venta_centavos ?? 0
  const cantidadDe = (l: LineaProducto) => textoAMilesimas(l.cantidad) ?? 0
  /** D-56: con productos, el total se suma solo. */
  const montoProductos = $derived(lineas.reduce((s, l) => s + calcularImporte(cantidadDe(l), precioDe(l)), 0))
  const centavos = $derived(lineas.length ? montoProductos : pesosACentavos(monto) ?? 0)
  const encontrados = $derived(
    buscar.trim().length < 2 ? [] : e.productos
      .filter((p) => p.activo && `${p.nombre} ${p.clave ?? ''}`.toLowerCase().includes(buscar.trim().toLowerCase()))
      .slice(0, 6),
  )
  const hayFraccion = $derived(lineas.some((l) => cantidadDe(l) % 1000 !== 0))
  const sinCosto = $derived(tipo === 'venta' && lineas.some((l) => (l.costo ?? catalogo.get(l.producto_id)?.costo_centavos) === undefined))

  function agregar(id: string) {
    const costo = catalogo.get(id)?.costo_centavos
    lineas.push({ producto_id: id, cantidad: '1', compra: tipo === 'compra' && costo !== undefined ? String(costo / 100) : undefined })
    buscar = ''
  }

  async function listo() {
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
    await app.guardar(m, app.corrigiendo ? 'Corregido' : 'Anotado')
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
    app.ir('inicio')
  }

  const pregunta = $derived(preguntas[respuestas.length])
  const promedio = $derived.by(() => {
    if (!pregunta || !resultado?.ok) return undefined
    const r = resultado.movimiento.renglones.find((x) => x.producto_id === pregunta.producto_id)!
    return costoTrasCompra('promedio', pregunta.costo_catalogo, app.existenciaHoy[pregunta.producto_id] ?? 0, r.cantidad_milesimas, pregunta.costo_compra)
  })
</script>

<button class="back" onclick={() => app.atras()}>‹ Volver</button>
<h1><span aria-hidden="true">{TIPO[tipo].icono}</span> {original ? 'Corregir: ' : ''}{TIPO[tipo].texto}</h1>

{#if lineas.length}
  <div class="amount">{pesos(montoProductos)}</div>
  <p class="sub" style="text-align:center;margin-top:-4px">Se suma de los productos.</p>
{:else}
  <Teclado bind:valor={monto} />
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

<button class="link" onclick={() => (detalles = !detalles)}>{detalles ? 'Ocultar detalles' : 'Agregar detalles'}</button>

{#if detalles}
  {#if conProductos}
    <label class="f" for="buscar">{tipo === 'compra' ? '¿Qué compraste?' : '¿Qué vendiste?'}</label>
    {#each lineas as l, i (i)}
      {@const p = catalogo.get(l.producto_id)}
      <div class="person" style="cursor:default">
        <span style="flex:2">{p?.nombre}<br /><span class="sub">{tipo === 'compra' ? 'cantidad y a cuánto cada uno' : `${pesos(precioDe(l))} c/u`}</span></span>
        <input style="flex:1;max-width:72px" bind:value={l.cantidad} inputmode="decimal" aria-label="Cantidad" />
        {#if tipo === 'compra'}<input style="flex:1;max-width:96px" bind:value={l.compra} inputmode="decimal" placeholder="$…" aria-label="Costo de compra" />{/if}
        <button class="back" style="flex:none" onclick={() => lineas.splice(i, 1)} aria-label="Quitar">✕</button>
      </div>
    {/each}
    <input id="buscar" bind:value={buscar} placeholder="Busca por nombre o clave…" />
    {#each encontrados as p (p.producto_id)}
      <button class="person" onclick={() => agregar(p.producto_id)}>
        <span>{p.nombre}<br /><span class="sub">{p.clave}</span></span><span>{pesos(p.precio_venta_centavos ?? 0)}</span>
      </button>
    {/each}
    {#if lineas.length && tipo === 'venta'}<p class="sub">El precio y el costo se copian del catálogo; no se teclean.</p>{/if}
    {#if sinCosto}<p class="sub">⚠ Un producto no tiene costo: contará como si te hubiera costado $0.</p>{/if}
    {#if hayFraccion}<p class="sub">Con cantidades con decimales, el importe se redondea a múltiplos de 5 centavos.</p>{/if}
  {/if}

  <p class="f">¿Cómo {entra ? 'te pagaron' : 'pagaste'}?</p>
  <div class="chips">
    {#each ['efectivo', 'transferencia', 'tarjeta'] as const as m (m)}
      <button class="chip" class:on={medio === m} onclick={() => (medio = m)}>{MEDIO[m]}</button>
    {/each}
  </div>

  {#if conQuien && !(tipo === 'venta' && credito)}
    <label class="f" for="quien2">{tipo === 'compra' ? '¿A quién le compraste?' : '¿A quién le vendiste?'}</label>
    <input id="quien2" bind:value={quien} list="nombres" placeholder="Nombre o apodo (opcional)…" />
  {/if}

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
<button class="btn" disabled={ocupado || centavos <= 0} onclick={listo}>Listo</button>
{#if centavos <= 0}<p class="sub" style="text-align:center;margin-top:-2px">{lineas.length ? 'Escribe la cantidad de los productos.' : 'Escribe el monto para poder guardar.'}</p>{/if}

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
