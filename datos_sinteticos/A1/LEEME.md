# A1 · Reventa a mayoreo («PE420 sintético»)

Datos **inventados** (CH-08 §3): no hay nada de PE420 ni de ninguna persona real. Se regeneran con `npm run generar` (semilla 20260706).

- 13 semanas, del 6-jul al 4-oct-2026; capital inicial $15,000; inventario inicial por conteo.
- 140 productos en 6 categorías, etiquetas A y B; 3 productos **sin costo** (AN-06).
- Pedido semanal al proveedor principal y reposición cada 3 semanas; el costo cambia en ~6 % de los renglones y se decide Sí / No / Promedio (AN-20, D-50, D-53).
- Ventas a 12 mayoristas, ~40 % a crédito, cobros a 7-30 días, morosos, un cobro parcial (T-03) y uno de más (AN-09).
- Casos fijos: 3 correcciones (T-05), 2 anulaciones (T-06), 3 devoluciones (T-07; dos con la penalización de costumbre del 50 %, D-60), una mayor a lo vendido (AN-10), una de una venta a crédito con penalización (D-59), una venta de más (AN-11), un gasto atípico (AN-03).
- Anomalías al azar con las tasas de CH-04 §12.2; cada una está en `esperado.json → alertas_esperadas`.

| Archivo | Contenido |
|---|---|
| `registro_eventos.jsonl` | Movimientos en orden de captura (CH-04 §5.5), origen `ejemplo` |
| `catalogos.json` | Negocio, terceros y productos (con el costo final del catálogo) |
| `esperado.json` | Verdad de terreno por semana, por mes y total; alertas esperadas; intentos rechazados (AN-01) |
