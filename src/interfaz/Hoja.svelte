<script lang="ts">
  // Hoja que sube desde abajo (UX-13): se cierra con el botón atrás del teléfono, al
  // tocar fuera o con Escape; bloquea el fondo y lleva su título para el lector.
  import { onDestroy, onMount, type Snippet } from 'svelte'
  import { app } from './app.svelte.ts'

  let { titulo, alCerrar, children }: { titulo: string; alCerrar: () => void; children: Snippet } = $props()

  const idTitulo = `hoja-${Math.random().toString(36).slice(2, 9)}`
  let hoja = $state<HTMLDivElement>()
  // El atrás del teléfono llama a alCerrar; si se cierra por botón, onDestroy quita la entrada.
  const id = app.abrirHoja(() => alCerrar())

  onMount(() => {
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    hoja?.focus()
    return () => (document.body.style.overflow = antes)
  })
  onDestroy(() => app.cerrarHoja(id))
</script>

<svelte:window onkeydown={(ev) => ev.key === 'Escape' && alCerrar()} />

<div class="modal">
  <button class="fondo" aria-label="Cerrar" tabindex="-1" onclick={alCerrar}></button>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabindex="-1" bind:this={hoja}>
    <h3 id={idTitulo}>{titulo}</h3>
    {@render children()}
  </div>
</div>
