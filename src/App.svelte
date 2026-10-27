<script lang="ts">
  // Interfaz pendiente (paso 5 de CH-18 §5). Por ahora solo confirma que el dominio carga.
  import { formatearPesos } from './dominio/index.ts'
</script>

<main>
  <h1>El Chalán</h1>
  <p>Prueba de concepto en construcción. Funciona sin internet.</p>
  <p class="sub">{formatearPesos(0)}</p>
</main>
