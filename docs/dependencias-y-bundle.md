# Pendientes de dependencias y bundle

Actualización etapa 03: 2026-10-02, America/Cancun. Se declaran en Functions
SheetJS CE 0.20.3 y Zod 4.3.6, ya fijados en el lockfile raíz. No se cambian versiones
de paquetes; npm también ajusta un marcador de desarrollo de `@pkgjs/parseargs`.

Etapa 04 (2026-10-03): dependencias y lockfile sin cambios. Las 14 alertas de la
auditoría adjunta de etapa 03 siguen pendientes; no se presenta esa auditoría como
un nuevo análisis de vulnerabilidades ni se aplican actualizaciones automáticas.

## Resultado de herramientas

`npm audit --json` y `npm ci` mantienen **14 entradas: 10 altas y 4 moderadas**.
Respuesta actual: [npm-audit.json](evidencias/etapa-03/npm-audit.json).
Tres entradas son directas y once transitivas. Las metavulnerabilidades propagadas
no equivalen a catorce avisos independientes. `npm audit` devuelve salida 1 por
los avisos, mientras que la instalación limpia termina con salida 0.

| Paquete | Severidad npm | Relación | Ruta/uso declarado | Propuesta de npm |
| --- | --- | --- | --- | --- |
| firebase | Alta | Directa | Web: raíz → firebase | firebase 9.14.0 |
| @firebase/firestore | Alta | Transitiva | Web: firebase → firestore | firebase 9.14.0 |
| @firebase/firestore-compat | Alta | Transitiva | Web: firebase → firestore-compat | firebase 9.14.0 |
| @grpc/grpc-js | Alta | Transitiva | Web/Node instalado: firebase → firestore → grpc-js | firebase 9.14.0 |
| @firebase/rules-unit-testing | Alta | Directa | Desarrollo: raíz → rules-unit-testing → firebase | rules-unit-testing 2.0.7 |
| firebase-tools | Alta | Directa | Desarrollo/CI: raíz → firebase-tools | firebase-tools 14.23.0 |
| @google-cloud/pubsub | Moderada | Transitiva | Desarrollo: firebase-tools → pubsub | firebase-tools 14.23.0 |
| @opentelemetry/core | Moderada | Transitiva | Desarrollo: firebase-tools → pubsub → core | firebase-tools 14.23.0 |
| proxy-agent | Alta | Transitiva | Desarrollo: firebase-tools → proxy-agent | firebase-tools 14.23.0 |
| pac-proxy-agent | Alta | Transitiva | Desarrollo: proxy-agent → pac-proxy-agent | firebase-tools 14.23.0 |
| get-uri | Alta | Transitiva | Desarrollo: pac-proxy-agent → get-uri | firebase-tools 14.23.0 |
| basic-ftp | Alta | Transitiva | Desarrollo: get-uri → basic-ftp | firebase-tools 14.23.0 |
| gaxios | Moderada | Transitiva | Desarrollo: firebase-tools → gaxios; Functions: firebase-admin → @google-cloud/storage → gaxios | firebase-tools 14.23.0 |
| uuid | Moderada | Transitiva | Desarrollo y Functions: las rutas anteriores → gaxios → uuid | firebase-tools 14.23.0 |

Las rutas son representativas. El uso declarado no demuestra ejecución del código
vulnerable ni explotación en el navegador. Se conservan las rutas de etapa 01;
la etapa 03 utiliza ahora el SDK Admin para Auth, Firestore y Storage. No se ha
realizado una auditoría exhaustiva de alcanzabilidad; su uso es efectivo en las
Functions emuladas y no debe describirse como una integración solo futura.

## Valoración y pendiente

Las propuestas son degradaciones mayores respecto de firebase 12.19.0,
firebase-tools 15.32.1 y rules-unit-testing 5.0.2. Son resultados de npm, **no una
recomendación aplicada**. Se requiere un PR específico que contraste dependencias
ascendentes, compatibilidad y pruebas. No se ejecutó `audit fix`, no se añadieron
overrides y no se degradó ninguna dependencia. Los avisos siguen abiertos.

## Parser seleccionado

SheetJS CE **0.20.3**, distribución oficial fijada por URL e integridad SHA-512
en el lockfile. Es una dependencia del adaptador Node, no importada por React.
Se evaluó ExcelJS, pero no cubre ODS con la misma API; un parser propio de cada
formato duplicaría semántica compleja de hojas/fechas.

- Mantenimiento/distribución: [CDN oficial](https://cdn.sheetjs.com/) y
  [instalación Node](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
  No se usa `xlsx@0.18.5` del registro npm, que quedó rezagado.
- Licencia [Apache 2.0](https://docs.sheetjs.com/docs/miscellany/license/).
  Copyright (C) 2012-present SheetJS LLC. Copia íntegra en
  [SheetJS-Apache-2.0.txt](licenses/SheetJS-Apache-2.0.txt). No se modificó su fuente.
- Seguridad: [CVE-2024-22363](https://cdn.sheetjs.com/advisories/CVE-2024-22363)
  afecta hasta 0.20.1; la versión seleccionada es posterior a la corrección.
  El [aviso GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9)
  explica la distribución fuera de npm. `npm audit` no añade una alerta para
  esta versión; esto no certifica ausencia de vulnerabilidades.
- Mitigaciones propias: límites antes de parsear, integridad ZIP, rechazo de
  entidades XML, macros y fórmulas como valores académicos. No se usa generación
  HTML de SheetJS, ejecución de fórmulas ni descarga de recursos externos.
- Pendiente operativo: conservar disponibilidad del CDN o preparar distribución
  interna verificable y revisar nuevos avisos antes de habilitar importación nube.

## Bundle

`npm run build` pasa y conserva la advertencia de Vite para chunks mayores de
500 kB minificados. Etapa 04: **dist/assets/index-D6QlFC8q.js**, **809 776 bytes**
en disco; Vite muestra **809,77 kB**, gzip estimado **242,31 kB**. El panel se carga
diferido en **dist/assets/Dashboard-BpGX_MrX.js**, **13 442 bytes** (13,44 kB;
gzip estimado 4,39 kB). El principal de PR #2 era 806 051 bytes. SheetJS permanece
en Node, sin importación desde la UI. No se subió el umbral.

Valoración: la carga inicial de SDK/UI puede aumentar transferencia, análisis y
ejecución en redes o dispositivos limitados. No se midieron LCP/INP ni impacto
real en dispositivos. Pendiente analizar composición y carga diferida en un PR
posterior; el tamaño no se presenta como una medición de rendimiento.

## Advertencia adicional observada en emuladores

En la suite ampliada aparece `MaxListenersExceededWarning` sobre un `PassThrough`
(listeners `error`/`close`). Una repetición con `NODE_OPTIONS=--trace-warnings`
sitúa la llamada a pipeline en
`@google-cloud/storage/node_modules/teeny-request/build/src/index.js:194`.
En esa comprobación pasaron las 26 pruebas; no se oculta el aviso ni se aumenta
`setMaxListeners`. El aviso reaparece en la suite ampliada de etapa 04.
Esta traza no demuestra una fuga sostenida: queda pendiente medir recursos y
revisar el comportamiento del SDK antes de una prueba de carga/piloto real.

## Medición de etapa 05

Build local: `dist/assets/index-BKb_KUAw.js`, **811 973 bytes** (Vite 811,97 kB,
gzip estimado 242,94 kB). Historial diferido:
`dist/assets/History-slWt2K9b.js`, **13 023 bytes** (13,02 kB; gzip 3,92 kB).
Panel diferido: `Dashboard-Jq8BXNGY.js`, **13 442 bytes**. Continúa la advertencia
de 500 kB; no se cambia el umbral. Posible impacto: transferencia y trabajo de
análisis/ejecución inicial; no hay medición de experiencia real o de nube.

No se modificaron dependencias ni lockfile en esta etapa. Las 14 alertas del
informe previo siguen pendientes de remediación revisada; esto no es un nuevo
`npm audit` ni una afirmación de que los avisos del registro no hayan cambiado.
Se conservan pendientes de conciliación privada, piloto 45/230 y validación nube.

### Revisión del PR #4

Build local de las correcciones: `dist/assets/index-CCggGnaR.js`, **811 984 bytes**
(811,98 kB; gzip estimado 242,94 kB); `History-CjMoDn0V.js`, **13 329 bytes**
(13,32 kB; gzip 3,99 kB); `Dashboard-4oqylh9p.js`, **13 442 bytes**.
Persiste la advertencia de 500 kB y su posible impacto en transferencia y
análisis/ejecución inicial. Sin medición de experiencia real. No se actualizaron
dependencias ni se ejecutó una nueva auditoría de vulnerabilidades.
