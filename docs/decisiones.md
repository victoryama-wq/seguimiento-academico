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

### Correcciones de revisión del PR #2

- Solo `calificacion_invalida` es incidencia publicable; cualquier código distinto
  o desconocido bloquea por defecto. Se conserva la incidencia en la fila y el
  estado/valor original en resultados y exportación del alcance autorizado.
- La confirmación de sustitución se vincula a ID de propuesta y versión anterior.
  Cada nueva revisión invalida la selección; un contador de solicitudes impide
  que respuestas fuera de orden reemplacen la propuesta actual. Se aplica a
  reportes y fuentes administrativas, sin cambiar la transacción de publicación.
- `filenameResolution` usa el contrato del resolver académico aprobado. Solo
  administración puede adjuntarla; servidor valida ID/ciclo contra la instancia
  y fija actor de sesión/versión de trabajo. La identidad del trabajo incorpora
  nombre original y decisión cuando hay resolución. Esto permite corregir un
  original ya rechazado, conservar ambos trabajos y reutilizar el reenvío exacto.
  Nombre, hash, decisión, motivo, actor y versión quedan disponibles en revisión
  administrativa y artefacto privado. No se atribuye este permiso al cargador.
- No se introducen reglas académicas nuevas ni cambios de dependencias/workflow.

## Etapa 04 · 2026-10-03 · decisiones técnicas

- Administración aprueba la selección global del curso/corte, porque los cursos
  compartidos afectan varias coordinaciones. Coordinadores consultan/exportan su
  alcance. No se usa un rol enviado por el navegador para conceder facultades.
- Selección vinculada a versión publicada, con comparación de revisión previa,
  historial inmutable y reenvío idempotente. Reemplazar reporte invalida la
  selección para la versión nueva. Cerrar corte congela además los cursos esperados.
- Fotografías privadas por usuario y huella de membresía capturan atómicamente
  fuentes, punteros y selecciones. Paginación y exportación usan esa misma versión;
  revocar carreras invalida fotografías previas. Nuevas colecciones deniegan
  acceso directo mediante las reglas generales existentes.
- El manifiesto se guarda inmutable en Storage antes de publicar su índice privado
  en Firestore. Así los mapeos de cientos de cursos no se concentran en un documento
  sujeto al límite de 1 MiB. El hash permite reintentos sin duplicar manifiestos.
- Agregación bajo demanda en servidor; páginas de lectura 200 y de respuesta 25.
  No se envían todos los registros de la institución al navegador. El piloto debe
  medir el costo de recorrer el universo y decidir materialización de agregados.
- Exportación completa del filtro, con metadatos y denominadores; límite explícito
  de 8 MiB. Texto de fórmula neutralizado sin cambiar originales privados.
- Conteos de personas mediante matrícula normalizada única; observación única por
  instancia/persona/actividad. Inscripciones especiales se conservan sin duplicar D.
  El estado de registro se calcula por estudiante sobre su universo filtrado.
- Docentes identificados por filas del archivo o asignación administrativa auditada;
  múltiples docentes comparten observaciones sin duplicar el total institucional.
- Panel cargado de forma diferida. No se cambian paquetes ni comprobaciones de CI.

### Reglas académicas y pendientes

No cambia la interpretación aprobada de guion, cero, vacío, inválido, bajas,
inscripciones o grupo base. No se crea una regla de atribución provisional ni
se infieren escalas, mínimos aprobatorios, vencimientos o entregas. Conserva
pendientes de datos reales, dependencias, bundle, piloto, capacidad y retención.

### Revisión PR #3 · coherencia de exclusiones y filtros

La condición de caso especial pertenece a la persona en el alcance autorizado,
no a la fila que se está mostrando. Se reutiliza en observaciones, exclusiones de
reporte e inscripciones del padrón. La ausencia de observaciones elegibles no elimina
la trazabilidad coincidente ni incorpora notas excluidas a D. Las exclusiones del
padrón se vinculan al catálogo autorizado del filtro, sin inferir presencia en un
reporte concreto. Grupo y modalidad se filtran con atributos conservados y base
confirmada cuando exista dentro del alcance.

Una exportación corregida conserva la anterior: su ruta incorpora huella del CSV,
manifiesto y filtros. Reintentos idénticos reutilizan archivo; no se modifica el
original ni el corte. Esta corrección no cambia clasificación académica, permisos,
dependencias ni workflow.

## Etapa 05 · historial y seguimiento

### Decisiones técnicas

- `closures/{hash}.json` conserva manifiesto de fuentes/reportes/mapeos/selecciones,
  catálogo de instancias y resultado completo de resolución académica. Se escribe
  antes de comparar nuevamente la captura en una transacción y activar el puntero
  del cierre. Publicación y selección compiten sobre el mismo documento de corte.
  Una captura perdedora no se expone ni se elimina automáticamente.
- Los cortes cerrados usan las afiliaciones materializadas y versiones originales.
  Un cerrado legado sin materialización exige conciliación explícita: no se
  inventa una fotografía mediante reglas actuales. Revisiones de corte conservan
  padre, motivo, actor y fecha, sin sustituir ni copiar silenciosamente el original.
- Calendario civil cada 21 días, 1–20 cortes por operación, reenvío sin duplicados.
  Fechas editables con auditoría/CAS antes de aceptar trabajos; después, revisión.
  Los cursos esperados determinan pendientes dentro de cada alcance autorizado.
- Comparación solo entre fotografías del mismo ciclo y misma instancia, con
  correspondencias de actividades explícitas, uno a uno, aprobadas por servidor
  para administración. Se versionan; páginas/CSV fijan esa versión. Nada se infiere
  por índice, nombre parecido o igual posición de columna.
- Intersección normalizada de persona + instancia + pareja aprobada. Ambos extremos
  se filtran antes de unir. N/G/V/E/Z/D se suman sobre ese mismo universo; diferencia
  de N/D en puntos porcentuales. Bajas y cambios de universo quedan separados.
- Política histórica: carreras de la fila histórica intersectadas con membresía
  vigente. Ganar carrera habilita su historial; revocarla retira acceso incluso
  con un token previo. Un destino fuera del alcance no se revela en comparación.
- Bitácora independiente de las notas, en cortes abiertos o cerrados. Al crear un
  caso se fija transaccionalmente una captura académica autorizada y sus carreras;
  no se pierde su contexto si cambia el reporte. Lecturas y ediciones comprueban
  las carreras históricas del caso contra permisos actuales. Una matrícula en el
  padrón sin evidencia de ese curso no basta para crear un seguimiento.
- Revisiones inmutables enlazadas, CAS de cabeza y clave de reintento por actor.
  Mismo ID/contenido retorna la misma revisión; mismo ID con otro contenido falla.
  Paginación por enlaces anteriores desde la cabeza consultada y exportación
  completa de esa cabeza, con topes 10 000 revisiones/8 MiB. Fecha civil de contacto
  separada de timestamp del sistema. El responsable no concede permisos.
- Nuevos datos privados solo vía Functions. Reglas cliente existentes deniegan
  colecciones nuevas y fotografías incluso al cliente administrador. Revalidación
  de membresía en operaciones largas; no se cambian workflow ni protecciones.

### Reglas académicas y pendientes

Sin cambios a interpretación de guiones, ceros, vacíos, inválidos, inscripciones,
bajas o excepciones. Sin entrega, vencimientos, escalas o mínimos no se calculan
atrasos, aprobación ni promedios normalizados. Actividades sin pareja no implican
equivalencia ni recuperación. Mantener dependencias, bundle, conciliación privada,
piloto, capacidad/costos, retención/recuperación y validación nube pendientes.
No se envían recordatorios, mensajes ni comunicaciones a responsables.

### Revisión del PR #4: filtros, bajas generales y ausencia de mapeo

- Decisión técnica: `activity` en comparación designa el ID del extremo anterior.
  Servidor construye un mapa por instancia y extremo a partir de la versión de
  correspondencias aprobada, antes del conteo y filtro de estado de registro.
  Este selector interno no es una facultad aceptada desde el navegador; las
  consultas siguen comprobando carreras vigentes y fotografías autorizadas.
- Corrección de regla existente: una exclusión general autorizada por baja se
  vincula por matrícula normalizada aunque no exista fila Moodle posterior.
  Procedencia conservada; ausencias sin esa evidencia no se convierten en bajas.
- Decisión técnica: ausencia fijada (`mappingId: null`) y consulta vigente
  (propiedad omitida) son estados distintos. Páginas/CSV conservan el nulo o ID
  observado hasta actualización explícita. No se alteran versiones cerradas,
  fórmulas, reglas académicas ni pendientes de validación privada y nube.

## Etapa 06 — decisiones técnicas y aceptaciones pendientes

- Se conserva la arquitectura y los contratos existentes. El piloto usa las APIs
  callable y el worker real de emuladores, con cinco membresías de coordinador,
  50 personas sintéticas y dos cortes. Veinte archivos por lote como máximo;
  no se elevan límites de carga, filas, celdas, exportación ni recursos Functions.
- Cuello de botella observado: panel institucional de 230 cursos con 17,7–19,6 s
  y cierres de 17,4–17,7 s en la base. `captureMetrics` releía trabajos ya consultados
  y esperaba tres lecturas por curso. Ahora reutiliza esa consulta transaccional,
  indexa trabajos por curso y agrupa punteros/selecciones en bloques de 400 refs.
  Conserva la misma transacción, el control de membresía vigente y el CAS del cierre;
  no añade caché global ni cambia denominadores. La repetición y las regresiones
  de concurrencia son condición de validación; no se promete latencia de nube.
- CSV/XLSX/ODS se generan determinísticamente; un docente no entra a denominadores.
  Las cinco actividades son cero, número, guion, vacío e inválido. No se calcula
  rendimiento con el número de cursos sin declarar densidad y bytes.
- Telemetría optativa `PILOT_METRICS=1` funciona solo en demo completo; registra
  operación, tiempo y memoria antes/después, nunca argumentos, respuestas,
  identidades, tokens ni nombres de archivo. RSS muestreada no es pico continuo.
  Emuladores no miden operaciones facturadas de nube ni su capacidad productiva.
- La prueba de interrupción inyecta estado abandonado y fila parcial mediante SDK
  privilegiado del fixture demo. Después ejecuta reintento y publicación reales.
  Se distingue de matar procesos del SO o ensayar una caída de servicio en nube.
- Conciliación privada: solo lectura con parsers aprobados, comparación de hashes
  antes/después y reporte local ignorado. Coincidencia de identidad no significa
  afiliación base resuelta; se conservan las inscripciones múltiples. Las columnas
  candidatas no se convierten en actividades seleccionadas de un corte.
- Se prepara configuración separada de staging, sin proyecto por defecto ni
  credenciales. El usuario confirma que aún se creará Firebase. Activación explícita
  de runtime/bucket/región, IAM, bootstrap y validación real quedan pendientes del
  destino; no se debilitan guardias demo para simular una publicación.
- Retención y presupuestos son propuestas documentadas; no TTL, purga, lifecycle,
  minInstances reservado ni backup remoto activado. Restauración de nube y RPO/RTO
  todavía no están probados. Las decisiones académicas no se sustituyen por estas
  decisiones técnicas.

## Integración de decisiones aprobadas — 7 de octubre de 2026

La nueva solicitud autoriza implementar las decisiones vigentes y el flujo de
correcciones dentro del PR #5. Sustituye el alcance anterior de solo preparar
matrices; los datos identificables y las resoluciones individuales siguen privados.

- Regla académica aprobada: perfil `approved-2026-10`, catálogo oficial y plan
  conservado, normalización de grupos y prioridad individual explícita. El calendario
  se configura por ciclo. Las resoluciones posteriores delimitan o sustituyen las
  anteriores; DEC-30 no se convierte en una prioridad global de fecha sobre CA.
- Decisión técnica: paquete administrativo completo, JSON validado, con originales,
  huellas por contenido+ocurrencia, catálogo, configuración, aprobaciones y revisiones.
  El adaptador local evita recapturar las resoluciones. Las membresías siguen siendo
  asignaciones explícitas en servidor; los responsables del catálogo no son cuentas.
- Decisión técnica: correcciones como propuestas inmutables con referencia al original,
  actor real, motivo, fecha y auditoría. Los cortes abiertos sin resultados pueden
  adoptar fuentes nuevas mediante comparación de la versión esperada. Los demás
  requieren una revisión atribuible. La revalidación conserva bytes y autoría de
  resoluciones anteriores y publica únicamente contra las fuentes revisadas.
- Regla académica aprobada: cargas acumulativas y flexibles; conservar filas/columnas
  ausentes, separar todos los estados, adicionales computables solo con calificación
  numérica. La selección de actividades sigue siendo explícita por publicación.
  Un corte puede arrastrar una fotografía cerrada del mismo ciclo (`carryCutId`).
- Regla académica pendiente: calendario específico de Virtual; horario sabatino
  matutino confirmado, sin convertir otra modalidad por su código de grupo.
- Conciliación anterior a DEC-35/36 (sustituida por la actualización inferior):
  2.873 inscripciones, 2.665 personas, 2.661 principales,
  cuatro personas excluidas, 73 revisiones resueltas y cero diferencias de afiliación.
  Se detectaron dos observaciones adicionales de fecha, fuera de esas 73 revisiones.
  El usuario indicó conservarlas pendientes: bloquean la publicación del paquete
  real. No modificar sus originales ni repetir la solicitud de decisiones ya aprobadas.
- Se mantienen los pendientes de piloto institucional, selección de actividades reales,
  correspondencia curso/inscripción, nube, dependencias y bundle. No se modifican
  protecciones, permisos de infraestructura ni guardias de emuladores.

Contrato, procedimiento, cálculos y agregados en
[integración de decisiones aprobadas](integracion-decisiones-aprobadas.md).

## Actualización institucional DEC-35/36 y revisiones antiguas (2026-10-07)

- Regla académica aprobada: la matriz actualizada sustituye la instrucción de dejar
  pendientes dos fechas. Se importan ambos registros de cada par base/especial y
  la elección de principal, conservando fechas y grupos originales. La aceptación
  explícita de la fecha pertenece a la inscripción identificada por su huella y
  al ciclo del paquete; no es una nueva fecha de calendario ni una excepción global.
  Fechas inválidas, nuevas inscripciones y otros ciclos conservan sus validaciones.
- Decisión técnica: `originalDateApproved` exige una clasificación base/especial y
  no puede combinarse con una fecha efectiva distinta. El adaptador solo la importa
  cuando la matriz confirma la clasificación individual y la aceptación del original.
- Decisión técnica: revisar una versión publicada sustituida o un borrador cuya base
  ya cambió falla antes de crear la propuesta. La transacción comprueba la fuente
  vigente, conserva la versión esperada para publicar y admite reintentos idénticos.
  No fusionar automáticamente dos revisiones concurrentes: cargar la ganadora y
  revisar explícitamente la siguiente decisión, preservando las anteriores.
- Conciliación privada actual: 75 revisiones resueltas, 2.661 principales, cuatro
  personas excluidas y cero pendientes/diferencias contra la matriz. El cambio de
  principal solicitado y la conservación de las 2.873 inscripciones originales se
  comprueban privadamente. Siguen pendientes actividades, asignatura/inscripción,
  calendario Virtual, piloto institucional y nube; no se publicaron datos reales.

## Integración de reportes por afiliación principal (2026-10-07)

Esta autorización sustituye los pendientes anteriores de correspondencia
curso/inscripción, calendario Virtual y reconocimiento de actividades. Conserva
íntegras DEC-01 a DEC-36 y las decisiones individuales. No modifica fotografías
de cortes anteriores ni concede permisos a responsables del catálogo.

- Regla aprobada: la matrícula enlaza cada fila con la principal conciliada,
  incluso principal C.A. El grupo principal es de seguimiento; el grupo de
  impartición y la inscripción específica permanecen no determinados, sin bloqueo.
  Matrícula desconocida, principal pendiente, ciclo incompatible y curso ambiguo
  conservan sus validaciones. No se enlazan personas por nombre.
- Regla aprobada: Escolarizado acumula bloques 1–2, 3–5 y 6–7; Ejecutivo y Virtual
  acumulan una unidad por semana vencida, hasta siete, como modalidades distintas.
  La configuración se versiona con el paquete del ciclo y las fuentes del corte.
  Cargas flexibles conservan datos aún fuera de las unidades previstas.
- Aclaración institucional: sesiones numeradas corresponden a sus unidades;
  cierre/final corresponde a unidad 7. Actividades sin unidad reconocible son
  adicionales, computables con nota numérica, incluido cero. Totales y subtotales
  no son actividades; guion, vacío, inválido y columna ausente se distinguen.
- Decisión técnica: `principal-modality-v1` incluye `firstWeekEnd` civil explícito.
  Los ejemplos usan 2026-09-06; la fecha debe revisarse al configurar cada ciclo.
  No se deduce de las fechas individuales de inscripción ni se altera el calendario
  de clasificación de DEC-35/36. Escolarizado usa `schoolCut` explícito (1–3) en
  la fotografía del corte; su bloque no se deduce de semanas ni cambia al editar
  la fecha. Un lote de calendario escolarizado asigna los ordinales en orden; un
  lote semanal requiere indicar el bloque escolarizado que lo acompaña.
- Decisión técnica: publicar bajo esta política conserva una selección versionada
  de los IDs conocidos, actor y selección anterior en la misma transacción.
  El panel intersecta esa selección con la modalidad y fecha del alumno. La selección
  administrativa explícita sigue disponible y requiere revisión para cada versión.
- Decisión técnica: identidad operativa estable por matrícula normalizada, instancia
  interna y ciclo. El número externo del archivo no se presume ID interno Moodle.
  Prefijos de muestra etiquetados se separan; dos números sin etiqueta se rechazan
  para revisión. Nombre original, hash y decisiones administrativas se conservan.
- Decisión técnica: IDs de actividad derivados del encabezado exacto, estables ante
  reordenación. Renombrar no crea equivalencia automática; cambiar un mapeo previo
  exige conservar explícitamente sus IDs. Datos ausentes se arrastran con procedencia;
  una celda vacía presente sí actualiza el estado. Reintentos no duplican relaciones.

Pruebas, cálculos y limitaciones: [integración de reportes](integracion-reportes.md).

## Continuación aprobada 2026-10-08: avance explícito del corte

Para los nuevos cortes, la selección explícita sustituye la dependencia de semanas
vencidas y fechas operativas descrita en la decisión anterior. Escolarizado elige
1/2/3 (U1–2/U1–5/U1–7); Ejecutivo y Virtual eligen independientemente U1–7.
Cada estudiante utiliza su modalidad principal conciliada. Los archivos y sus
reintentos no cambian el avance. Unidades posteriores se guardan fuera del cálculo;
adicionales numéricas, incluido cero, conservan su regla aprobada.

Decisión técnica: configuración `explicit-progress-v1` por corte, validada en API,
historial inmutable con actor, hora del servidor, motivo y predecesor; CAS al editar
y comprobación de versión al publicar. Fecha operativa editable separada de la
referencia académica inicial. Los cortes anteriores conservan su política y sus
cálculos; ninguna migración automática. Cierre, paginación y exportación congelan
también la configuración de avance. La revisión acumulativa muestra antes/después
y advierte numéricos reemplazados por vacío/guion, limitada a carreras autorizadas.
No cambia DEC-01–36, sus originales ni la conciliación aprobada.

Contrato, ejemplos manuales y evidencia: [avance explícito](avance-explicito.md).

## Fase 2: preparación de nube (2026-10-08)

Decisión técnica: staging necesita un destino compartido explícito, proyecto de
ejecución coincidente, bucket/Hosting/región revisados y SHA idéntico entre web y
Functions. `null` bloquea nube; modo demo no hace fallback. Los emuladores y sus
credenciales aisladas siguen siendo el entorno de CI. No se asume ningún proyecto
listado como destino, ni se crean recursos facturables. La aceptación del usuario
y las mediciones cloud se registran separadas de pruebas locales.

Decisión técnica: cliente utiliza únicamente Auth y Functions; Firestore y Storage
se acceden por backend autorizado. Se difiere el espacio de trabajo y se conserva
un estado de recuperación ante fallo de descarga. Corrección gRPC dirigida con
override y lockfile, sin actualizar dependencias masivamente. No cambia ninguna
regla académica, DEC-01–36, afiliación principal, exclusión ni corte histórico.

Evidencia, riesgos restantes y procedimiento: [fase 2](validacion-nube-fase-2.md).

### Destino de pruebas confirmado

El propietario aprobó `indicadores-academia`, Blaze y región `us-central1`.
Hosting fija el sitio del mismo ID; Firestore `(default)`, Auth, bucket
`indicadores-academia.firebasestorage.app` y Functions permanecen en ese proyecto.
Cuenta `seguimiento-runtime` sin claves: `roles/datastore.user` y
`roles/firebaseauth.viewer` en el proyecto; `roles/storage.objectCreator` y
`roles/storage.objectViewer` solo en el bucket. Alcance expresamente autorizado;
sin Owner/Editor ni permiso para borrar objetos. Firestore tiene protección contra
eliminación; el bucket impide acceso público por IAM. Las Rules siguen vigentes.
No se eliminan fuentes ni se activa una política de retención destructiva.

Validación cloud separada: `CONFIRM_STAGING_PROJECT=indicadores-academia` y
`node scripts/validate-staging.mjs smoke` (después `45` y `230`). Requiere árbol
limpio, backend del mismo SHA, app y cuentas de prueba en `private/`, más el
manifest generado por `npm run prepare:cloud-fixtures`. No usa seed/reset demo,
SDK administrativo ni claves. Cada ejecución crea cortes nuevos identificables,
conserva los anteriores y registra resultados/tiempos privados. Los tiempos y
lecturas del cliente no sustituyen métricas facturadas ni aceptación del usuario.

### Ejecución de nube y latencia observada (2026-10-08)

El propietario autorizó a la cuenta dedicada `roles/eventarc.eventReceiver` solo
en `indicadores-academia` y `roles/run.invoker` solo en `importworker` de
`us-central1`. Identidad y destino verificados y registrados; permisos anteriores
preservados, sin claves ni acceso público al trabajador.

La medición de 45 cursos mostró panel institucional p50 3.516 ms (29 respuestas)
con lecturas secuenciales. Se preparan hasta cuatro cursos en paralelo por petición,
consumiendo resultados en orden, sin cache global ni lecturas de carreras ajenas.
Se mantiene la revalidación final de membresía y todos los límites/fórmulas.
La repetición medida, permisos y recuperación se documentan en
[ejecución cloud](validacion-nube-ejecucion.md), separados de aceptación del usuario.
La recuperación inyecta un lease vencido con auditoría solo en un trabajo sintético
nuevo no publicado; no demuestra caída de contenedor ni restauración de respaldo.

La evidencia añadida después del despliegue identifica por separado SHA de la
aplicación y revisión del verificador. `STAGING_RELEASE_SHA` admite un ancestro
solo con árbol limpio y diferencias de documentación, pruebas o verificadores
cloud enumerados; rechaza cambios de build, aplicación, configuración y
dependencias. La comprobación del backend permanece exacta. No se redespliega
la aplicación solo para atribuir al informe un SHA nuevo.

### Recorrido permanente de originales (continuación técnica, 2026-10-09)

La administración selecciona padrón, catálogo y reportes originales con revisión
visual de columnas; no necesita JSON ni identificadores internos en el recorrido
habitual. Se reutilizan el adaptador de matriz aprobada, los parsers, el motor de
afiliación y los trabajos persistentes. La matriz se incorpora expresamente una vez,
verificando sus fuentes; no se suben decisiones privadas por código ni se incluyen
en el build. DEC-01–36 no cambian.

Una propuesta administrativa fija la versión previa y los hashes/mapeos de los
originales, conserva el paquete anterior y se publica con comparación transaccional
de versión. Una matriz antigua requiere resolver conflictos con decisiones vigentes.
Se distinguen correspondencias generales de programa/plan y excepciones individuales;
los cambios de original requieren continuidad explícita y motivo. Se conservan las
fuentes y revisiones anteriores incluso cuando una decisión deja de ser aplicable.

La identificación inequívoca por número/nombre/ciclo registra la instancia en servidor;
los ámbitos se obtienen del padrón conciliado, sin conceder acceso por el responsable
del catálogo. Cargas parciales nunca reducen los ámbitos previos del curso compartido.
La revisión de columnas publicada se conserva por curso/ciclo y encabezado exacto,
con protección contra revisiones simultáneas. Los cortes mantienen sus fuentes y
avance explícito; no se infiere avance a partir del archivo. Todos los endpoints de
preparación institucional comprueban administración en servidor y guardan originales
fuera de Hosting. Las operaciones anteriores siguen disponibles como diagnóstico.

Guía: [carga institucional](carga-institucional.md). La aceptación del propietario
y la publicación productiva siguen pendientes; la validación técnica usa sintéticos.

### Reportes anchos y padrón del corte (corrección técnica, 2026-10-09)

La previsualización mantiene ancho legible por columna y desplazamiento horizontal
local al contenedor. Los límites de bytes, filas físicas, columnas y celdas se
comprueban antes de omitir filas totalmente vacías del reporte Moodle. Fórmulas,
errores, cero y valores booleanos no se consideran filas vacías; una nota sin
matrícula mantiene su incidencia. Se conservan el original privado y los números
de fila, sin convertir ausencia de contenido en una inscripción.

Administración puede inspeccionar el nombre y conteos del padrón fijado en un corte;
el servidor deniega esta consulta institucional a coordinadores. Si las fuentes
vigentes cambiaron, se informa sin recalcular el corte. Un cruce vacío explica qué
comprobar y cómo preparar otro corte después de confirmar las fuentes. No se
modifican decisiones académicas, cortes existentes ni datos del piloto.
