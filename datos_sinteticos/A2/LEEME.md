# A2 · Puesto de mercado (frutas y verduras)

Datos **inventados** (CH-08 §4). Se regeneran con `npm run generar` (semilla 20260803).

- 8 semanas, del 3-ago al 27-sep-2026; capital inicial $5,000; cierra los lunes.
- **Sin catálogo**: renglones con descripción libre, en **kilos con decimales** (múltiplos de 5 gramos, D-52).
- 25 a 60 ventas por día, todas de contado y sin cliente; compras en la central de abasto martes y viernes; gastos diarios (piso, bolsas, hielo, transporte); merma como ajuste de bodega.
- La semana 5 se capturó atrasada: lo del sábado y el domingo se anotó el lunes.
- Anomalías: duplicados (AN-04), gastos sin categoría (AN-05), reloj desfasado (AN-16), un gasto atípico (AN-03), intentos con fecha futura (AN-01).
- Al no tener costos, lo vendido entra a «Me deja» con costo 0 (D-58): «Me deja» = lo vendido y «Gané» = lo vendido − gastos.
