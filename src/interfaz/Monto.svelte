<script lang="ts">
  // Monto con el teclado del teléfono (UX-28): un campo grande con «$», sin teclado
  // propio. Guarda el texto tecleado: «1250.5». Enter del teclado = Listo.
  import { onMount } from 'svelte'

  let { valor = $bindable(''), deshabilitado = false, enfocar = true, etiqueta = 'Monto', alListo }: {
    valor?: string; deshabilitado?: boolean; enfocar?: boolean; etiqueta?: string; alListo?: () => void
  } = $props()

  let campo = $state<HTMLInputElement>()

  onMount(() => {
    if (enfocar && !deshabilitado) campo?.focus()
  })

  /** Solo cifras, un punto (la coma cuenta como punto) y dos decimales. */
  function limpiar() {
    if (!campo) return
    const [entero, ...resto] = campo.value.replace(/,/g, '.').replace(/[^\d.]/g, '').split('.')
    valor = (resto.length ? `${entero}.${resto.join('').slice(0, 2)}` : entero).slice(0, 12)
    if (campo.value !== valor) campo.value = valor
  }
</script>

<label class="monto">
  <span aria-hidden="true">$</span>
  <input bind:this={campo} value={valor} oninput={limpiar} inputmode="decimal" enterkeyhint="done" autocomplete="off"
    placeholder="0" aria-label={etiqueta} disabled={deshabilitado} onkeydown={(ev) => ev.key === 'Enter' && alListo?.()} />
</label>
