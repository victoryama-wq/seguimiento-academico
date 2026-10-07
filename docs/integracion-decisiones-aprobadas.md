# Integración de decisiones aprobadas — ampliación revisable del PR #5

Esta entrega integra las decisiones vigentes recibidas el 7 de octubre de 2026.
Sustituye el estado de «solo preparar matrices» de la conciliación anterior.
Las fuentes reales, sus decisiones individuales y los informes detallados están
en `private/`, ignorado por Git. No se modifican los originales. No se publica en
Firebase, no se crean cuentas ni se asignan permisos a partir del catálogo.

## Comportamiento implementado

El administrador incorpora un **paquete académico JSON** como fuente versionada.
Contiene catálogo, inscripciones originales, calendario, programación por modalidad,
decisiones individuales y revisiones de la matriz. El backend valida el contrato,
las referencias y las huellas de los registros antes de confirmar la fuente.
La UI presenta originales, efectivos, regla, estado, motivo y procedencia; permite
crear otra propuesta administrativa sin sobrescribir la anterior. Los coordinadores
solo consultan las observaciones de las carreras autorizadas por el servidor.

La clave de inscripción combina los campos originales y la ocurrencia de un
registro idéntico; no depende de la posición de la fila. La fila, archivo, hoja
y hash se conservan como procedencia. Cambiar un campo original invalida la
referencia de una decisión previa. Un paquete de otro ciclo se rechaza. Las filas
repetidas con fechas o modalidades distintas conservan claves distintas.

El perfil `approved-2026-10` es explícito. Las fuentes antiguas siguen usando su
contrato previo y los cortes cerrados conservan sus fotografías. El paquete es una
fuente administrativa completa: sus inscripciones y decisiones sustituyen el uso
operativo del padrón, suplemento y resoluciones separados **para cortes que lo
referencien**. No anexar otra vez el suplemento ya incorporado.

| Decisiones | Implementación y límite |
| --- | --- |
| DEC-01/02/06/07/09/10 | Catálogo oficial verificado contra la matriz; programa confirmado, plan original, responsable, facultad y campus separados. DIGRAF→DIGRAFT y COMPUB→CONPUB; no constantes con nombres de responsables. |
| DEC-03/04/05 | Espacios, mayúsculas y separador del ciclo; CA/C.A./C.A y ARQ EJEC. ESP. El ciclo nunca se inventa. Los grupos parciales requieren confirmación explícita ligada al registro, sin inventar grado o sección. |
| DEC-08/14/15 | Calendario por ciclo; base prioritaria o especial única como principal, conservando su tipo. Una ambigüedad bloquea. |
| DEC-11–13/16/17/24 | Padrón actualizado único; bajas de persona completas y exclusión por ciclo diferenciadas. No fechas de baja inventadas ni calificaciones convertidas en cero. |
| DEC-18–23 | Programación editable por modalidad y semana vencida; cargas parciales acumulativas, IDs explícitos de actividad y adicionales solo con evidencia numérica, incluido cero. |
| DEC-25/28 | Sustituciones y cambio de modalidad: antecedentes conservados sin vigencia operativa; nuevas inscripciones no se deduplican por matrícula+grupo. |
| DEC-26 | Pares base/especial y antecedentes conservados; las revisiones se importan en bloque con procedencia. |
| DEC-29 | Fecha efectiva corregida separada de la fecha original. |
| DEC-30 | Prioridad de fecha sobre CA solo en el conjunto delimitado por las resoluciones vigentes de la matriz. No regla global. |
| DEC-31/32/34 | Elección individual de principal y descarte de una inscripción errónea; no exclusión de toda la persona. |
| DEC-27 | Modalidad administrativa original conservada; Virtual muestra horario sabatino matutino. Un código 53 no convierte otra modalidad en Virtual. |
| DEC-33 / IMP-001–004 | Observaciones, corrección, revalidación y confirmación; calendario flexible, acumulación y alcance real de la carga. |

Los nombres de responsables son etiquetas del catálogo, no identidades de Auth.
Los IDs técnicos de carrera generados por el adaptador proceden de la abreviatura
normalizada; el administrador debe vincular explícitamente las membresías reales
mediante el mecanismo existente. Los seis responsables del catálogo no implican
seis cuentas ni restringen el número de coordinadores del sistema.

## Importación y corrección privada

1. Ejecutar `npm run build` y preparar un manifest local en `private/` con rutas
   `matrix`, `roster`, `catalog`, `output` (dentro de `private/`), `cycle`, `calendar`
   y `schedule`. El calendario usa fechas civiles ISO; `schedule` contiene bloques
   de unidades de `escolarizado`, `ejecutivo` y `virtual`, más `flexible: true`,
   `cumulative: true`, `completedWeek: true`. Virtual permanece `null` hasta decisión.
2. Ejecutar `node scripts/prepare-approved-package.mjs private/manifest.json`.
   Verifica los hashes P02/C02 declarados por la matriz, todos los originales y
   las afiliaciones esperadas. Produce el paquete y un informe privado. Una
   discrepancia u observación pendiente produce salida 1; no implica aprobación.
   El adaptador admite esta estructura de matriz y época 1900; otra estructura o
   época requiere adaptación explícita, no interpretación aproximada.
3. Administrador → Fuentes → Fuentes administrativas → «Catálogo, calendario y
   decisiones aprobadas (JSON)». Subir el paquete con mapeo `{}`. Revisar las
   observaciones paginadas antes de confirmar. No hay recaptura de las 73 revisiones.
4. En una observación, «Registrar revisión» crea otra propuesta. Requiere motivo,
   regla, fecha de decisión y referencia de autorización. El actor y la hora del
   registro provienen del servidor; el autor declarado en la matriz se conserva
   como procedencia, sin otorgarle permisos. Se conserva auditoría y referencia
   a la fuente anterior; repetir la misma solicitud no duplica la propuesta.
5. Publicar la nueva fuente tras revisarla. Para un corte abierto **sin resultados**,
   actualizar sus fuentes explícitamente y volver a validar el original del
   reporte. Una propuesta validada contra fuentes antiguas no puede publicarse.
   La confirmación de sustitución sigue vinculada a la propuesta concreta.
6. Si el corte ya tiene resultados, conservarlo y crear una revisión atribuible
   después de cerrarlo (`parentId` y motivo). `carryCutId` permite elegir la
   fotografía cerrada del mismo ciclo que aporta el acumulado. Nunca editar el
   snapshot cerrado ni trasladar decisiones de otro ciclo.

Una observación estructural, de identidad o afiliación pendiente impide confirmar.
Una calificación inválida conserva su estado y original y puede publicarse;
no se convierte en cero ni en ausencia de entrega. Los detalles sin una atribución
autorizada quedan para revisión administrativa; el coordinador recibe el bloqueo
sin acceder a identidades de otra carrera. Corregir un catálogo o añadir una
inscripción se realiza mediante otro paquete completo, con sus originales.

## Acumulación y cálculos inspeccionables

Los mapeos declaran `activityId` estable, `unit` opcional y `additional` opcional.
No se deduce equivalencia por posición ni parecido del encabezado. Cambiar el
significado de un ID ya cargado (unidad/adicional) requiere revisar el mapeo.
La unión se hace por identidad normalizada y actividad. Una columna o fila ausente
conserva el valor anterior; una celda presente sustituye solo ese valor, manteniendo
la publicación anterior y la versión de procedencia de cada celda. Las fuentes
actuales vuelven a comprobar la elegibilidad de las filas arrastradas.

Cada nueva publicación requiere revisar la selección explícita de actividades
para esa versión. `configureMetrics` ofrece también las actividades acumuladas,
no solo los encabezados del último archivo. Los resultados/exportación de filas
conservan todos los estados; el panel y su exportación no cuentan una actividad
adicional sin calificación numérica. Ausencia de celda no genera observación cero.
Se mantienen los límites de archivo/lote y se limita el acumulado a 10.000 personas,
256 actividades y 200.000 celdas, con límite de tamaño por derivado.

Fixture inspeccionable (`tests/emulators/approved-decisions.test.ts`):

| Momento | Carrera A | Carrera B | Totales institucionales |
| --- | --- | --- | --- |
| Primer archivo | U1=0 | U1=`-` | N=1, G=1, D=2, Z=1 |
| Parcial nuevo | U2=7, Extra=0; conserva U1 | Fila ausente, conserva U1 | N=3, G=1, D=4, Z=2; dos personas; cobertura 75 % |
| Corte posterior con origen cerrado explícito | Corrige U1=9 y Extra=`-`; conserva U2 | Conserva U1 | Extra sin número no cuenta: N=2, G=1, D=3, Z=0; cobertura 66,67 % |

El corte anterior permanece en D=4. La baja sintética conserva sus inscripciones
y procedencia pero no aporta filas de calificaciones ni estudiantes medidos.
Otra regresión comprueba 105 observaciones de cada carrera, dos páginas autorizadas,
CSV completo y un principal especial que sigue clasificado como especial.

El planificador usa los bloques configurados: Escolarizado 1–2, 3–5, 6–7;
Ejecutivo una unidad semanal. La primera fecha representa el primer corte por
semana vencida. Los cortes siguientes enlazan su origen; deben cerrar ese origen
antes de aceptar el acumulado. Las fechas se pueden editar antes de recibir archivos.
Virtual no hereda automáticamente ninguna de esas frecuencias. Las cargas no exigen
bloques completos ni fechas rígidas de actividades.

## Conciliación real: únicamente agregados

Se ejecutaron los parsers y el motor de afiliaciones localmente, sin escribir
datos reales en Firebase ni en CI público. Resultados del padrón:

| Control | Resultado |
| --- | ---: |
| Inscripciones originales conservadas | 2.873 |
| Identidades distintas | 2.665 |
| Principales resueltas | 2.661 |
| Personas excluidas | 4: tres bajas y una exclusión por ciclo |
| Revisiones importadas como resueltas | 73 |
| Pendientes en esas 73 revisiones | 0 |
| Diferencias frente a afiliaciones aprobadas | 0 |
| Observaciones nuevas de fecha, fuera de esas revisiones | 2 |
| Catálogo / responsables distintos | 36 / 6 |

El usuario indicó conservar las dos observaciones nuevas como pendientes. No se
modificaron sus fechas ni se declaró conciliación completa. Bloquean la publicación
del paquete real; la implementación se verifica con paquetes sintéticos válidos.

`node scripts/reconcile-approved-pilot.mjs private/approved-package.json private/pilot-manifest.json`
lee los cuatro libros y conserva el detalle en `private/approved-pilot-reconciliation.json`:

| Fuente privada | Filas | Docentes | Filas con principal | Excluidas | Sin atribución | Columnas candidatas | Numéricas / guiones |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| M01 | 20 | 0 | 19 | 1 | 0 | 22 | 76 / 342 |
| M02 | 32 | 1 | 31 | 0 | 0 | 22 | 61 / 621 |
| M03 | 37 | 0 | 34 | 3 | 0 | 21 | 254 / 460 |
| M04 | 27 | 0 | 27 | 0 | 0 | 14 | 102 / 276 |

Son celdas inspeccionadas de las filas con principal, **no denominadores publicados**.
No hubo filas Moodle ambiguas, vacíos ni calificaciones inválidas en esas columnas.
La selección institucional de actividades por curso/corte y la correspondencia
de asignatura a inscripción siguen requiriendo validación; el grupo principal
no demuestra dónde cursa cada asignatura. El guion no demuestra falta de entrega.

## Verificación y límites

Los resultados finales de las ocho verificaciones, SHA y CI se consignan en la
entrega y en el PR. La evidencia E2E es exclusivamente sintética. Se conservan los
pendientes anteriores de dependencias, bundle, piloto institucional, configuración
de destino y validación en nube; ningún tiempo de emulador garantiza capacidad real.
No se realizaron merge, despliegue, cambios de protecciones ni comunicaciones a
estudiantes o responsables.

El build de esta ampliación produce `dist/assets/index-Bu7tHCvu.js` (819.095 bytes;
244,70 kB gzip según Vite). Sigue el aviso de más de 500 kB. Puede aumentar la
transferencia y el trabajo inicial de parseo en clientes lentos; no se modificó
el umbral ni se presenta el E2E móvil como medición de hardware real. El diagnóstico
previo de dependencias continúa en [dependencias-etapa-06.md](dependencias-etapa-06.md),
sin actualizaciones ni degradaciones en esta ampliación.

### Resultados ejecutados de esta ampliación

| Comando | Resultado local |
| --- | --- |
| `npm run lint` | Aprobado |
| `npm run typecheck` | Aprobado |
| `npm run test:unit` | 211 pruebas aprobadas, 13 archivos |
| `npm run build` | Aprobado; advertencia de bundle conservada |
| `npm run test:emulators` | 64 pruebas aprobadas, 9 archivos |
| `npm run test:e2e` | 34 pruebas aprobadas en escritorio/móvil, 4,4 min |
| `npm run test:pilot` | 45 y 230 cursos aprobados, 282,95 s de suite |
| `npm run verify:hosting` | Aprobado: cinco archivos exclusivamente públicos en `dist/` |

El piloto existente usa su fixture sintético y no mide un despliegue real ni la
capacidad del paquete privado con toda la institución. Se ejecutó nuevamente sin
subir límites ni omitir pruebas. Evidencia de esta repetición:
[45 cursos](evidencias/etapa-06/aprobadas-piloto-45.json) y
[230 cursos](evidencias/etapa-06/aprobadas-piloto-230.json). Las duraciones completas
fueron 59.708 y 222.437 ms. La telemetría de Functions de ambos JSON abarca el log
combinado; no se presenta como memoria o tiempos aislados por escenario. Continúa
la advertencia de listeners del SDK/emulador descrita en la entrega anterior.

Capturas tomadas de las pruebas aprobadas e inspeccionadas visualmente:

- [Observación pendiente y bloqueo de confirmación](evidencias/etapa-06/observacion-aprobadas-sintetica.png).
- [Resolución reutilizada y publicación desde coordinación en móvil](evidencias/etapa-06/resolucion-aprobadas-movil-sintetica.png).

Durante la verificación se corrigieron dos defectos: cierre ocurrido durante el
trabajo no debe impedir conservar su validación (solo su publicación), y referencias
largas de una observación no deben ensanchar la página móvil ni interceptar pulsaciones.
La repetición completa pasó sin modificar protecciones ni tiempos de espera.

También se corrigió la sincronización de la prueba E2E nueva: ahora espera a que la
propuesta aparezca antes de consultar su ID. El primer intento unitario tuvo un
límite de tiempo excedido en el proceso hijo de una prueba preexistente; su repetición
sin cambios de código, aserción ni timeout aprobó. Lint detectó dos variables sin uso
en un generador privado anterior; se conservaron su copia y comportamiento y se
eliminaron solo las declaraciones no usadas, sin excluir archivos del lint.

La conciliación local no es una suite aprobatoria: el adaptador terminó con salida
**1**, por las **dos observaciones nuevas pendientes** que el usuario decidió
conservar. Las 73 revisiones resueltas y los controles de afiliación coinciden. La
lectura de los cuatro libros terminó con salida 0; no publicó resultados académicos.
Los hashes de los siete archivos suministrados permanecen sin cambios.

El SHA final y el enlace del CI automático reconocido por el PR se registran en el
cuerpo del PR #5; la ejecución remota verifica ese commit. No se usa ejecución manual
para sustituir el check del PR.
