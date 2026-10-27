<script lang="ts">
  // Teclado numérico grande para el monto (U-2). Guarda el texto tecleado: «1250.5».
  let { valor = $bindable(''), deshabilitado = false }: { valor?: string; deshabilitado?: boolean } = $props()

  const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

  function tocar(t: string) {
    if (t === '⌫') valor = valor.slice(0, -1)
    else if (t === '.') { if (!valor.includes('.')) valor = (valor || '0') + '.' }
    else if (valor.includes('.') && valor.split('.')[1].length >= 2) return
    else if (valor.replace('.', '').length < 9) valor = (valor === '0' ? '' : valor) + t
  }

  const mostrar = $derived(
    valor === '' ? '0' : Number(valor.replace(/\.$/, '')).toLocaleString('es-MX', { maximumFractionDigits: 2 }) + (valor.endsWith('.') ? '.' : ''),
  )
</script>

<div class="amount" aria-live="polite">$ {mostrar}</div>
{#if !deshabilitado}
  <div class="keys">
    {#each TECLAS as t (t)}
      <button type="button" onclick={() => tocar(t)} aria-label={t === '⌫' ? 'Borrar' : t}>{t}</button>
    {/each}
  </div>
{/if}
