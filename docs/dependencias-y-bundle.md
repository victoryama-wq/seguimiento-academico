# Pendientes de dependencias y bundle

Actualización: 2026-10-02, America/Cancun. Esta etapa añade únicamente SheetJS CE
0.20.3; el diff del lockfile no cambia las versiones previamente instaladas.

## Resultado de herramientas

`npm audit --json` y `npm ci` mantienen **14 entradas: 10 altas y 4 moderadas**.
Respuesta completa: [npm-audit.json](evidencias/etapa-02/npm-audit.json).
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
| gaxios | Moderada | Transitiva | Desarrollo: firebase-tools → gaxios; Functions opcional: firebase-admin → @google-cloud/storage → gaxios | firebase-tools 14.23.0 |
| uuid | Moderada | Transitiva | Desarrollo y Functions opcional: las rutas anteriores → gaxios → uuid | firebase-tools 14.23.0 |

Las rutas son representativas. El uso declarado no demuestra ejecución del código
vulnerable ni explotación en el navegador. Se conservan las rutas de etapa 01;
el único nodo nuevo del lockfile es `xlsx`. No se ha realizado una auditoría
exhaustiva de alcanzabilidad en esta etapa.

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
500 kB minificados. Archivo: **dist/assets/index-BbyLDZop.js**, **774 279 bytes**
en disco; Vite muestra **774,27 kB**, gzip estimado **231,81 kB**. El parser nuevo
no aumenta este bundle: no hay importación desde la UI. No se subió el umbral.

Valoración: la carga inicial de SDK/UI puede aumentar transferencia, análisis y
ejecución en redes o dispositivos limitados. No se midieron LCP/INP ni impacto
real en dispositivos. Pendiente analizar composición y carga diferida en un PR
posterior; el tamaño no se presenta como una medición de rendimiento.
