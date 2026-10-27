<script lang="ts">
  // F-12 · Semana y mes: resumen del periodo comparado con el anterior. Cerrar el
  // periodo llega en la PoC-2 (M9).
  import { calcularVistas, finDeMes, inicioDeSemana, sumarDias, type Fecha, type Vistas } from '../dominio/index.ts'
  import { app } from './app.svelte.ts'
  import { CATEGORIA, pesos, porcentaje } from './textos.ts'

  let tipo = $state<'semana' | 'mes'>(app.periodo)
  let atras = $state(0)

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

  function rango(t: 'semana' | 'mes', n: number): { desde: Fecha; hasta: Fecha } {
    if (t === 'semana') {
      const desde = sumarDias(inicioDeSemana(app.hoy), -7 * n)
      return { desde, hasta: sumarDias(desde, 6) }
    }
    const [a, m] = app.hoy.split('-').map(Number)
    const total = a * 12 + (m - 1) - n
    const desde = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
    return { desde, hasta: finDeMes(desde) }
  }

  function vistas(r: { desde: Fecha; hasta: Fecha }): Vistas {
    const e = app.estado!
    // El periodo en curso se corta hoy: los saldos son a la fecha.
    return calcularVistas(e.movimientos, e.negocio, e.productos, { desde: r.desde, hasta: r.hasta < app.hoy ? r.hasta : app.hoy })
  }

  const actual = $derived(rango(tipo, atras))
  const v = $derived(vistas(actual))
  const antes = $derived(vistas(rango(tipo, atras + 1)))
  const titulo = $derived(
    tipo === 'mes'
      ? `${MESES[Number(actual.desde.slice(5, 7)) - 1]} ${actual.desde.slice(0, 4)}`
      : `del ${actual.desde.slice(8)}/${actual.desde.slice(5, 7)} al ${actual.hasta.slice(8)}/${actual.hasta.slice(5, 7)}`,
  )

  type Fila = { texto: string; valor: (x: Vistas) => number; masEsMejor?: boolean }
  const FILAS: Fila[] = [
    { texto: 'Vendí', valor: (x) => x.ventas_netas, masEsMejor: true },
    { texto: 'Me devolvieron', valor: (x) => x.devoluciones },
    { texto: 'Compré mercancía', valor: (x) => x.compras },
    { texto: 'Gasté', valor: (x) => x.gastos },
    { texto: 'Me deja', valor: (x) => x.utilidad_bruta, masEsMejor: true },
    { texto: 'Gané', valor: (x) => x.utilidad_del_periodo, masEsMejor: true },
    { texto: 'Entró − salió', valor: (x) => x.flujo_de_caja, masEsMejor: true },
    { texto: 'Saqué yo', valor: (x) => x.retiros },
    { texto: 'Puse yo', valor: (x) => x.aportaciones },
  ]

  function flecha(f: Fila): string {
    const diferencia = f.valor(v) - f.valor(antes)
    if (diferencia === 0 || f.masEsMejor === undefined) return ''
    return diferencia > 0 ? '▲' : '▼'
  }
</script>

<button class="back" onclick={() => app.ir('inicio')}>‹ Volver</button>
<h1>Semana y mes</h1>

<div class="seg">
  <button class:on={tipo === 'semana'} onclick={() => { tipo = 'semana'; atras = 0 }}>Semana</button>
  <button class:on={tipo === 'mes'} onclick={() => { tipo = 'mes'; atras = 0 }}>Mes</button>
</div>
<div class="top">
  <button class="chip" onclick={() => atras++} aria-label="Periodo anterior">‹</button>
  <b>{atras === 0 ? (tipo === 'semana' ? 'Esta semana' : 'Este mes') : titulo}</b>
  <button class="chip" disabled={atras === 0} onclick={() => atras--} aria-label="Periodo siguiente">›</button>
</div>
{#if atras === 0}<p class="sub" style="margin-top:-6px;text-align:center">{titulo}</p>{/if}

<div class="kv" style="font-size:13px"><span></span><span class="sub">este · el anterior</span></div>
{#each FILAS as f (f.texto)}
  {@const flechita = flecha(f)}
  <div class="kv">
    <span>{f.texto}</span>
    <span>
      <b class:neg={f.valor(v) < 0}>{pesos(f.valor(v))}</b>
      <span class="sub"> · {pesos(f.valor(antes))}</span>
      {#if flechita}<span class:pos={(flechita === '▲') === f.masEsMejor} class:neg={(flechita === '▲') !== f.masEsMejor}> {flechita}</span>{/if}
    </span>
  </div>
{/each}
<div class="kv"><span>Margen sobre costo</span><span>{porcentaje(v.margen_sobre_costo_pb)} <span class="sub">· {porcentaje(antes.margen_sobre_costo_pb)}</span></span></div>
{#if v.penalizaciones}<div class="kv"><span>Me quedé de devoluciones</span><span>{pesos(v.penalizaciones)}</span></div>{/if}

<div class="dia">Al {atras === 0 ? 'día de hoy' : 'final del periodo'}</div>
<div class="kv"><span>Tengo</span><b>{pesos(v.saldo_total)}</b></div>
<div class="kv"><span>Me deben</span><b>{pesos(v.por_cobrar)}</b></div>

{#if Object.keys(v.gastos_por_categoria).length}
  <div class="dia">¿En qué gasté?</div>
  {#each Object.entries(v.gastos_por_categoria).sort((a, b) => b[1] - a[1]) as [c, monto] (c)}
    <div class="kv"><span>{c === 'sin_categoria' ? 'Sin decir en qué' : CATEGORIA[c as keyof typeof CATEGORIA]}</span><span>{pesos(monto)}</span></div>
  {/each}
{/if}

{#if v.ventas_sin_costo_pb}<p class="sub">⚠ {porcentaje(v.ventas_sin_costo_pb)} de lo vendido no tiene costo; cuenta como si te hubiera costado $0.</p>{/if}
<p class="sub">Cerrar la semana o el mes llega más adelante.</p>
