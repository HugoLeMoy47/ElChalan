# El Chalán · instrucciones para agentes

**Estado, pendientes y decisiones: en Jarvis, clave `FJ-CHALAN`** (conector MCP `jarvis`).
Al empezar: `consultar_proyecto`. Al terminar: `cerrar_sesion` con liga al commit o PR.
Sin conector: anota en `BITACORA.md` (raíz; créalo si no existe) con encabezado `## AAAA-MM-DD · título`.

## Dónde está cada cosa
- Reglas duras: este archivo.
- Producto y decisiones (serie CH-xx, decisiones D-xx, deuda técnica DT-xx): carpeta de OneDrive `07_Freejolitos/50_Productos/ElChalan/`. Punto de entrada para construir: CH-18.
- Publicación y arquitectura: `README.md` y `docs/`.

## Reglas duras
- **Repo público.** Cero nombres de clientes, de pilotos o de negocios reales en código, datos, commits y PR. Los datos de prueba salen de `datos_sinteticos/`; nunca datos reales.
- **Alcance de prueba de concepto (D-30).** No reintroduzcas voz, intérprete, WhatsApp, foto ni importación de Excel sin que Hugo lo pida: están diferidos como deuda técnica.
- **Sin login ni servidor de datos (D-28).** Los datos viven en el teléfono (IndexedDB); Google solo al activar el respaldo en Drive (`drive.file`).
- La política de contenido la generan `pwa/plugin.ts` y `dist/_headers`: no agregues scripts de terceros. **Única excepción:** Web Analytics de Cloudflare (`static.cloudflareinsights.com` y `cloudflareinsights.com`), que Hugo quiere activa.

## Cómo trabajar aquí
- **Git:** commits y push de ramas sin preguntar; cambios por rama y PR hacia `main`. **Cada push a `main` publica en producción** (Cloudflare corre `npm run build` y `wrangler deploy`), así que fusionar a `main` es desplegar: solo con autorización explícita de Hugo, cada vez. Nunca `--force` ni reescribir historial.
- Pruebas: `npm test` (Vitest) y `npm run check`, una cosa a la vez (equipo limitado).
- Para ver la app: `npm run dev` en segundo plano y abrir `localhost:5173`.

## Trampas técnicas
- El navegador integrado no admite service workers: la PWA (instalable, sin conexión) se prueba en Chrome de Android.
- Chrome en Android no comparte archivos `.json`: el respaldo se comparte como `.txt` o se descarga.
- En Cloudflare: `NODE_VERSION = 22`; **Web Analytics sí** (permitida en la política); **sin** Rocket Loader, ofuscación de correos ni detección de bots con JavaScript (inyectan scripts en línea que la política bloquea).
- El «margen» del modelo es sobre el costo (D-42, D-48), no sobre el precio.
