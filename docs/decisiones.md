# Registro de decisiones

Este registro se amplía en cada PR. Distinguir reglas académicas confirmadas, propuestas técnicas y asuntos pendientes; no convertir una suposición en requisito aprobado.

| Fecha | Decisión | Estado y motivo |
| --- | --- | --- |
| 2026-10-01 | Implementación por Codex y revisión por etapas mediante PR. | Solicitado por el usuario; reduce el alcance de cada entrega. |
| 2026-10-01 | CI significa integración continua en este paquete. | Interpretación declarada; también se incluye AGENTS.md para instrucciones permanentes. |
| 2026-10-01 | React/TypeScript y Firebase como base de los prompts. | Base tecnológica de trabajo; comprobar compatibilidad e infraestructura en etapa 01. |
| 2026-10-01 | Pruebas automáticas con datos sintéticos y emuladores. | Permite validar sin publicar expedientes ni requerir un proyecto real. |
| 2026-10-01 | Repositorio, proyecto de destino y despliegue. | Pendientes de identificar; este paquete no crea infraestructura. |

Para cada nueva decisión registrar fecha, contexto, alternativas pertinentes, decisión, impacto sobre datos/permisos/historial y vínculo al PR. Las reglas académicas del usuario se conservan en docs/requisitos.md.

## Etapa 01 · 2026-10-01 · decisiones técnicas

- **Base local nueva:** la inspección encontró solo el paquete de instrucciones,
  sin aplicación ni repositorio Git. Se conserva íntegro el paquete y se prepara
  una rama local de etapa 01. Remoto y PR pendientes de destino.
- **Workspace:** web en raíz, Functions como workspace npm, un solo lockfile.
  Dominio e infraestructura separados de UI; no se instala un parser todavía.
  Alternativa descartada: dividir cada carpeta en un paquete sin consumidores.
- **Node 22 y Java 21:** base común con CI. Dependencias directas exactas y árbol
  resuelto en lockfile; no se modifica la instalación global del equipo.
- **Contrato inicial:** Zod estricto en entidades iniciales y respuesta de API;
  las matrículas nunca se coaccionan a número y las fechas académicas son texto
  civil. Esquema no equivale a validación de relaciones o publicación transaccional.
- **Acceso cerrado:** Firestore/Storage deniegan todas las operaciones cliente.
  Solo se permite diagnóstico técnico sin datos en Functions y únicamente bajo
  emuladores demo completos. La etapa 01 admite esta base restrictiva; permisos
  útiles por coordinación requieren implementación y casos permitidos/denegados
  posteriores. No se presenta este cierre como autorización operativa terminada.
- **Entorno explícito:** configuración compartida de puertos desde `firebase.json`,
  conexiones explícitas de cada SDK, ejecutores que rechazan proyectos reales y
  puertos ocupados. Perfil temporal de CLI y ruta ADC deshabilitada evitan heredar
  credenciales locales. Sin fallback a nube ni dependencia de un `.firebaserc` privado.
- **Interfaz vacía:** no activar automáticamente el ciclo de ejemplo ni usar 230
  como denominador. Navegación a estados explicativos, sin cargas o roles ficticios.
- **Modelo futuro:** versiones inmutables, personas/inscripciones separadas,
  proyecciones por coordinación y publicación mediante control de versión. Índices
  compuestos propuestos se implementarán junto a consultas reales y sus pruebas.

## Reglas académicas y configuración pendientes

Sin nuevas reglas académicas. Se conserva `docs/requisitos.md` sin modificaciones.
Continúan pendientes calendario concreto, actividades por corte, catálogo completo,
fuentes privadas, excepciones auditadas, fechas de baja cuando existan, escalas y
umbrales. Ningún vacío se resolvió inventando datos. No se implementó etapa 02.

Evidencia y vínculo de entrega: `docs/entrega-etapa-01.md`; PR pendiente de remoto.

## Etapa 02 · 2026-10-02 · decisiones técnicas

- Rama exclusiva desde `origin/main` en `518f09a515d197ef051eb627137fc0ca1a1f252a`.
  La etapa 01 ya está en GitHub con CI aprobado y main protegida. Los comentarios
  anteriores sobre remoto pendiente describen el estado histórico de etapa 01.
- Parser Node SheetJS CE 0.20.3 del CDN oficial, fijado en lockfile; alternativa
  ExcelJS descartada por falta de ODS. Licencia, mantenimiento, avisos y límites
  documentados en `dependencias-y-bundle.md`. No se añade al bundle del navegador.
- Lectura acotada previa a interpretar hojas: 8 MiB, 32 MiB expandidos, 256 entradas
  ZIP, 10 000 filas, 256 columnas, 200 000 celdas. Son límites técnicos iniciales,
  no estimaciones del tamaño real ni capacidad del piloto.
- Dominio puro separado de adaptadores. Los originales permanecen junto a los
  valores normalizados y las incidencias. No hay persistencia ni publicación en
  esta etapa; la autorización de una aprobación corresponde al futuro backend.
- Los IDs de actividad son explícitos y versionados en mapeos aprobados. Textos
  desconocidos requieren revisión. Los encabezados duplicados ligan el mapeo al
  hash de fuente para no reutilizar posiciones en otra importación.
- Duplicados de reporte, incluso idénticos, quedan retenidos hasta una resolución
  auditada. Alternativa de conservar la primera fila descartada: oculta conflictos.
- Suplementos apuntan a inscripción específica y conservan historial. No se
  deduplican personas eliminando sus inscripciones. Varias bases pueden resolverse
  por decisión administrativa explícita, válida solo para el corte indicado.
- Fechas civiles sin zona local: ISO, DD/MM/AAAA y seriales enteros 1900/1904.
  CSV UTF-8 con delimitador explícito; coma decimal queda como incidencia hasta
  aprobar un mapeo regional. Fórmulas se conservan pero no se toman como nota.
- El README separa parsers/normalización/clasificación/resolución (etapa 02) de
  indicadores y panel académico (etapa 04). No se implementa etapa 03.

### Reglas académicas y conciliación pendientes

No se alteró `requisitos.md`. Calendarios reales, catálogo completo, selección de
actividades, bajas privadas (incluidas las tres informadas), excepciones auditadas,
escalas y umbrales siguen pendientes de fuentes/decisiones autorizadas. Ningún
fixture sustituye una conciliación de los libros piloto. Bajas sin fecha no se
aplican retrospectivamente: solo al corte confirmado explícitamente en la entrada.

Entrega y vínculo de revisión: `entrega-etapa-02.md` y PR de esta rama.

## Correcciones del PR #1 · 2026-10-02

- **Origen y seguimiento separados:** `prepareRoster` conserva `cycle` del campo
  mapeado o, sin ese mapeo, del grupo reconocido. El cuarto argumento solo fija
  `trackingCycle`; nunca completa el origen. Los conflictos se retienen para
  revisión y las excepciones se contrastan con el origen y el corte de destino.
- **Época por fuente:** normalizar a fecha civil antes de combinar archivos.
  Conservar serial/fecha original, época, hash, nombre, parser, hoja y fila en la
  inscripción. Se elimina `calendar.epoch`: un calendario académico no determina
  la codificación de todos los libros. El dominio rechaza como incidencia un
  serial recibido sin época propia; no supone 1900 silenciosamente.
- **Suplementos deterministas:** se rechazan todas las operaciones conectadas
  por consumo/producción de IDs dentro del mismo lote, incluso altas encadenadas
  y ciclos. La alternativa de aplicar la primera corrección y dejar un sufijo
  pendiente se descarta porque depende del orden. Se conservan originales y
  operaciones rechazadas; los cambios independientes mantienen su historial.
  Resolver una cadena requiere una corrección directa aprobada contra el original.
- **Regresiones de recorrido:** libros sintéticos 1900/1904 mezclados, serial
  44803, tres zonas horarias, ODS/XLSX/CSV y excepciones entre ciclos, además de
  todas las permutaciones del lote de tres operaciones. No cambia una regla
  académica ni se introducen datos reales.

La investigación de CI distingue evidencia del commit de checks reconocidos por
el PR; una ejecución manual no cierra el pendiente de `pull_request`. No se cambian
permisos ni protecciones para eludirlo. Evidencia actualizada en el informe del
[PR #1](https://github.com/victoryama-wq/seguimiento-academico/pull/1).

## Tres conversaciones de revisión del PR #1 · 2026-10-02

- Las bajas solo se comparan cuando la matrícula de la inscripción está
  normalizada y no es `null`. Una identidad faltante conserva su incidencia,
  originales y falta de afiliación resuelta. No cambia la vigencia por fecha o
  corte de las bajas válidas ni la prioridad docente.
- El CSV cuenta cada celda al cerrarla, antes de almacenarla, incluyendo el
  encabezado y los vacíos. Rechaza el exceso de 200 000 durante la lectura.
  Un separador que implica una columna adicional al ancho del encabezado falla
  inmediatamente; una fila corta falla al terminarla. Los saltos y delimitadores
  citados siguen siendo contenido de la celda. No se elevan límites.
- Moodle construye un `Map` de identidad a filas en una sola pasada. La
  clasificación consulta ese índice y mantiene el orden anterior, docentes,
  originales, incidencias y grupos completos de duplicados/conflictos. Las
  identidades no resueltas no se agrupan entre sí. La agrupación es lineal en
  filas; comparar originales sigue siendo proporcional a las celdas recorridas.
- El reporte sintético de 9 999 filas (10 000 con encabezado) verifica conservación
  de todas las filas y resoluciones auditadas sin aserciones de tiempo. No es una
  prueba de carga de 45/230 cursos ni evidencia de rendimiento del futuro servidor.

Estas decisiones corrigen implementación y límites técnicos; no añaden reglas
académicas. Continúan las limitaciones de datos privados, dependencias y bundle.

## Etapa 03 · 2026-10-02 · decisiones técnicas

- Base integrada `3963f46d5513e3918774edfcb219d8d4cf102744`; rama exclusiva
  `etapa-03-acceso-e-importacion`. No se cambian reglas académicas aprobadas.
- Membresías Firestore consultadas por servidor y reglas, sin autoridad derivada
  de claims/payload. La revocación se comprueba con el mismo token. Bootstrap es
  privilegiado y solo local; autoasignación pública de roles no existe.
- Una callable con operaciones discriminadas y Zod; autorizar también dentro de
  transacciones. Originals solo Admin/procesador; coordinador recibe proyección
  por afiliación, incluida una versión compartida por varias carreras.
- Reutilizar el mismo código de parsers/dominio al compilar Functions. SheetJS y
  Zod se declaran en el workspace con las versiones ya fijadas; sin copiar reglas
  ni actualizar dependencias. No incorporar SheetJS al bundle web.
- La fuente de decisiones acepta excepciones entre ciclos y resoluciones de base
  con los mismos contratos de etapa 02. El servidor fija aprobador y versión;
  las decisiones por filas de Moodle conservan originales y auditoría privada.
- Eventos Firestore persistentes con reintentos, claim/lease y staging por token.
  Los eventos pueden repetirse o llegar desordenados: diseño según
  [garantías de eventos](https://firebase.google.com/docs/functions/firestore-events)
  y [reintentos](https://firebase.google.com/docs/functions/retries). Máximo tres
  intentos, publicación transaccional y un único puntero activo por corte/instancia.
- Original inmutable con precondición de generación, más hash verificado. No
  publicar filas hasta terminar staging; abortar conflicto de versión esperada.
  Correcciones conservan historial y requieren propuesta nueva/confirmación.
- Fijar las fuentes al crear el corte, para reproducibilidad incluso durante su
  preparación. Revisiones de cortes cerrados tienen padre y motivo; no reabrir.
- Límites 20 archivos/40 MiB por lote, 8 MiB por archivo y límites del parser
  de etapa 02. Transferencia callable base64; no implementar ZIP ni resumible por
  bloques en esta etapa. Progreso por fase persistida, no porcentaje de bytes.
- Páginas de 100 filas/trabajos y exportación de carrera completa sobre versión
  fija. Texto CSV protegido contra fórmulas; originales exactos retenidos. No
  persistir URLs de descarga públicas ni incluir matrículas en rutas.
- Fixtures SDK Admin cargadas mediante entradas CommonJS nativas: evita el fallo
  de enlace ESM `jose` bajo el transformador Playwright en Node 22. No se degrada
  una dependencia ni se omite una suite. Bootstrap cierra la transacción antes de
  rechazar una repetición, evitando salir durante rollback asíncrono del SDK.

### Reglas académicas y pendientes

Se conservan origen/seguimiento, épocas 1900/1904, suplementos deterministas,
identidades nulas, docentes/bajas, duplicados y mapeos auditables. No se infieren
escalas, fechas, carreras o actividades. No hay conciliación con archivos reales.
Dependencias, bundle, carga 45/230 cursos, retención, costos, recuperación y nube
continúan pendientes. Indicadores y panel corresponden a etapa 04.
