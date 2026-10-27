# El Chalán

Web app instalable (Android) para que un comerciante unipersonal anote lo que entra y sale de su negocio, **sin conexión y sin cuenta**, y vea *cuánto tiene*, *si ganó* y *cuánto le deben*. Este repositorio es la **prueba de concepto (PoC-1)**.

> **La documentación manda sobre el código.** Vive en OneDrive: `07_Freejolitos/50_Productos/ElChalan/` (serie CH-01 a CH-18). El punto de entrada para construir es **CH-18**. Si el código y un documento se contradicen, se corrige el código o se discute el documento (CH-18 §7).

## Pila

Vite + Svelte + TypeScript (D-54) · `uuidv7` para identificadores · dinero en **centavos enteros** y cantidades en **milésimas enteras** (D-52) · IndexedDB (D-27) · Vitest.

## Comandos

```bash
npm install
npm test            # dominio contra la verdad de terreno
npm run generar     # regenera los datos sintéticos A1 y A2
npm run check       # tipos
npm run dev         # app (por ahora, una pantalla vacía)
```

## Estructura (CH-15 §7)

| Carpeta | Contenido | Estado |
|---|---|---|
| `src/dominio/` | Reglas y vistas puras (CH-04): tipos, dinero, versiones (corregir/anular), firmar, vistas | Hecho (paso 2) |
| `src/almacen/` | IndexedDB, una base por negocio, transacciones atómicas (ADR-03) | Pendiente (paso 4) |
| `src/exportacion/` | Respaldo manual: exportar y restaurar (M5a) | Pendiente (paso 4) |
| `src/respaldo/` | Interfaz del proveedor y adaptador de Drive | PoC-2 |
| `src/captura/` | Captura manual y carga de datos de ejemplo (M0) | Pendiente |
| `src/interfaz/` | Pantallas y textos de calle (CH-16) | Pendiente (paso 5) |
| `datos_sinteticos/` | Generador determinista de A1 y A2 y su verdad de terreno (CH-08) | Hecho (paso 1) |
| `pruebas/` | Escenarios T-01 a T-11, T-14, T-17 y comparación al centavo con A1 y A2 | Hecho |

## Plan (CH-18 §5)

1. ~~Generador de datos sintéticos~~ · 2. ~~Dominio~~ · 3. Detector de alertas · 4. Almacén local y respaldo manual · 5. Interfaz mínima · 6. Instalable y sin conexión · 7. Productos, por revisar, semana y mes, ajustes · 8. Mediciones en un Android real.

## Reglas que no se negocian aquí

- El **dominio es puro**: no importa nada de navegador, red ni almacenamiento.
- La **verdad de terreno** la calcula el generador con su propio libro de intenciones; **no** importa la lógica del dominio (solo sus tipos).
- Lo diferido (voz, foto, WhatsApp, Excel, SutraMind…) **no se programa** (CH-18 §4).
- Commit y push, solo cuando Hugo lo pida.
