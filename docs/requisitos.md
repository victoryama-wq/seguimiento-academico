# Requisitos de seguimiento académico

## 1. Alcance

Aplicación institucional con panel consolidado, cinco coordinaciones, unas 45 asignaturas por coordinación y aproximadamente 230 en total. Cada tres semanas se crea un corte: las coordinaciones cargan sus reportes Moodle por lote y administración mantiene un padrón y catálogo de carreras versionados por ciclo.

El ciclo de prueba es `27-1`, del 31/08/2026 al 12/12/2026. Los ciclos son datos configurables. El calendario propuesto cada 21 días debe permitir ajustes y mostrar pendientes de carga; no enviar recordatorios ni mensajes automáticamente en esta primera versión.

La meta inicial es el registro de calificaciones y su seguimiento. Las fechas límite y el estado de entrega real quedan para una fase posterior.

## 2. Entradas

- Padrón: matrícula, nombre, carrera, grupo, modalidad, turno y fecha del grupo. El encabezado puede decir «fecha de inscripción»; conservar nombre y valor originales y documentar el mapeo aprobado.
- Catálogo: relación de carreras y abreviaturas con coordinación. Versionarlo; no convertir distintas versiones de plan en un solo plan sin evidencia.
- Suplemento: correcciones o altas de registros individuales; registrar quién aprobó el cambio y a qué fuente sustituye.
- Estado administrativo: bajas confirmadas, con fecha de efecto cuando exista. Tres bajas ya fueron informadas; sus matrículas se suministrarán privadamente. No inventar fechas de baja ni modificar retrospectivamente cortes ya cerrados.
- Reportes Moodle ODS, XLSX o CSV, varios archivos por lote. ZIP es una comodidad de carga, no un requisito para usar la app; implementar límites de tamaño y descompresión si se admite.

Los nombres originales de los cursos empiezan con un número y terminan con el ciclo, antes del sufijo de exportación. Separar ID, nombre y ciclo conservando el nombre original. El ID leído del nombre no se presupone igual al ID interno de Moodle. Las copias de archivos pueden tener prefijos de descarga; ante ambigüedad pedir corrección en la previsualización y no adivinar.

Los libros de prueba corresponden a Interculturalidad (1), Autogestión del Aprendizaje y Competencias Digitales (10), Gestión del Estrés y Bienestar Integral (600) y Derecho Fiscal (616). Sus actividades y columnas varían; no fijar una plantilla única de 21 actividades. Inspeccionar cada encabezado; categorías y totales no son actividades. «Último descargado desde este curso» es un dato de exportación, no evidencia de acceso del estudiante.

## 3. Identidad y afiliaciones

Matrícula normalizada: texto antes de `@`, espacios exteriores eliminados y comparación sin distinción de mayúsculas; conservar el original. No quitar prefijos ni ceros. Para padrón sin correo aplicar la misma normalización textual. Si falta identidad, crear incidencia; no unir por nombre.

El patrón completo `^tup-d\d+$` identifica una fila docente, después de normalizar el local-part. Excluirla de indicadores estudiantiles. Su presencia es evidencia de docente del archivo; su ausencia no permite inferir un responsable. Soportar varios docentes y una asignación administrativa validada, indicando procedencia.

Una persona puede tener varias inscripciones. No borrar todas menos la primera. La afiliación base se usa para atribución institucional; las inscripciones especiales se conservan por separado. Una inscripción especial no prueba por sí sola en qué grupo se imparte una asignatura determinada.

## 4. Grupo

Estructura ordinaria: ciclo + abreviatura de carrera + código de modalidad/turno + grado/sección, por ejemplo `27-1 LAF 24 01A`.

| Código | Modalidad | Turno / jornada |
| --- | --- | --- |
| 11 | Escolarizado | Matutino |
| 12 | Escolarizado | Vespertino |
| 23 | Ejecutivo | Matutino |
| 24 | Ejecutivo | Vespertino |
| 53 | Virtual | Sabatino Matutino |
| 48 | Escolarizado | Nocturno; aplicable a Arquitectura |

Guardar modalidad/turno derivados y valores originales; señalar discrepancias. `COMPUB` se normaliza a `CONPUB`, corrección aprobada de captura, sin borrar el dato fuente. Otros grupos que no encajen se separan para revisión, sin repararlos automáticamente.

El sufijo explícito `C.A`, por ejemplo `05C.A`, clasifica la inscripción como caso especial aunque la fecha no sea 29 de agosto. Si además está mal formado, conservar la clasificación especial y dejar sin resolver los atributos desconocidos. No asumir que `CA` sin puntos es equivalente sin una regla aprobada.

## 5. Fechas y prioridad

Reglas del ciclo 27-1, año 2026; para otro ciclo se carga un calendario equivalente, no se reutilizan estas fechas silenciosamente.

| Fecha | Tipo | Indicadores principales |
| --- | --- | --- |
| 31 de agosto | Grupo base / nuevo ingreso | Sí, para carrera |
| 29 de agosto | Caso especial | Sí, con afiliación resuelta |
| 30 de agosto | Práctica profesional | Fuera del alcance inicial base + especiales |
| 28 de agosto | Inglés | Excluido |
| 27 de agosto | Campos clínicos | Excluido |
| 26 de agosto | Deportes | Excluido |

Orden de resolución:

1. Separar filas docentes y registros administrativos de baja del universo activo del corte.
2. Excluir inscripciones de inglés, campos clínicos y deportes, usando catálogo/tipo además de fecha. Una ficha de inglés de nuevo ingreso del 31 de agosto no se transforma en grupo base. Excluir la inscripción, no a la persona que también tenga una inscripción de carrera válida.
3. En inscripciones elegibles, `C.A` prevalece para tipo especial; de lo contrario aplicar las fechas configuradas.
4. Si hay una única base elegible, atribuir al estudiante a ella y conservar sus especiales. Si hay varias bases candidatas, crear incidencia sin elegir arbitrariamente.
5. Si solo hay especial, conservar «sin grupo base confirmado». La atribución provisional requiere regla explícita o resolución administrativa auditada; no convertir el especial en base. El caso especial de otro ciclo ya informado requiere importar su excepción aprobada y conservar el ciclo original.
6. Fechas desconocidas, campos faltantes o carreras sin coordinación generan incidencias visibles. No ocultarlas en una categoría válida ni sumarlas a una coordinación arbitraria.

La fecha del grupo no es la fecha de entrega de una actividad. Guardar fechas académicas como fecha civil para que una conversión de zona horaria no cambie el día.

## 6. Estados de calificación

- Número, incluido `0`: calificación registrada.
- `-`: sin calificación registrada / pendiente de calificar; no sabemos si hubo entrega.
- Vacío: dato faltante, distinguirlo del guion.
- Texto inesperado, error o dato no interpretable: incidencia; conservar el valor.
- Totales/categorías: conservar si resulta útil, fuera del denominador de actividades.

No calcular automáticamente incumplimiento, morosidad docente, aprobación ni promedios comparables: faltan entrega, vencimientos, nota mínima y escalas. No inferir escala máxima a partir del mayor valor observado.

Antes de publicar un corte seleccionar las actividades que se analizarán por curso. No interpretar unidades futuras como obligaciones vencidas. En el panel llamar a la medida «cobertura de calificaciones registradas en actividades seleccionadas».

## 7. Métricas y filtros

Unidad de observación: estudiante + instancia de curso + actividad + corte/versiones de fuente. Estudiante institucional = matrícula única en el universo incluido; la suma de estudiantes por asignatura no es el total de personas.

Sea D el número de observaciones esperadas en las actividades seleccionadas para inscripciones elegibles y resueltas del curso. Publicar D y los conteos separados:

- N: valores numéricos; Z: numéricos iguales a cero (subconjunto de N).
- G: guiones; V: vacíos; E: valores inválidos. Debe cumplirse D = N + G + V + E.
- Cobertura = N / D × 100. Si D = 0, mostrar «sin actividades seleccionadas» o «sin datos», nunca 0 % como si fuera medición.
- Porcentaje de guiones = G / D × 100, con el mismo filtro y denominador.
- Por estudiante: todas las observaciones seleccionadas numéricas, registro parcial o ninguna numérica; datos faltantes/inválidos deben seguir visibles.
- Asignaturas con guiones por estudiante, actividades con mayor número de guiones, evolución comparable entre cortes.
- Archivos/cursos esperados, recibidos, validados, publicados y pendientes. El catálogo de cursos esperados se carga explícitamente; «230» es una referencia de planeación, no un denominador constante.
- Calidad: matrículas sin padrón, varias bases, grupo ilegible, catálogo incompleto, filas excluidas, bajas y errores de importación.

Filtros: ciclo, corte, coordinación, carrera/plan, grupo base, modalidad, turno, curso, docente conocido, condición base/especial y estado de registro. Las selecciones de actividades y exclusiones deben verse en pantalla y exportación. Al agregar porcentajes, sumar numeradores y denominadores; no promediar porcentajes de cursos.

Comparar cortes sobre estudiantes, cursos y actividades comunes con mapeo estable y explícito. Mostrar aparte incorporaciones, bajas, cambios de afiliación, cambios de actividades y archivos faltantes. Las bajas no son estudiantes recuperados. Sin correspondencia suficiente, mostrar «no comparable».

## 8. Carga e historial

- Administración publica versiones de padrón, catálogo y excepciones. Cada corte referencia las versiones utilizadas.
- Selección múltiple de archivos; progreso y resultado por archivo. Una falla no invalida los otros archivos.
- Previsualización de curso/ciclo, actividades, estudiantes incluidos, excluidos e incidencias; confirmar para publicar.
- Conservar archivo original, hash, nombre, tamaño, usuario, fecha, parser/version y mapeos.
- Misma fuente/clave ya importada: detectar duplicado. Misma clave con contenido distinto: proponer nueva versión; no sumar ambas. Conservar la anterior.
- Dos cargas simultáneas: publicar mediante control de versión o transacción; evitar que el resultado más antiguo desplace silenciosamente al más reciente.
- Cortes cerrados inmutables. Una corrección produce revisión con autor/motivo y referencia al corte, conservando la fotografía original.
- Operaciones de procesamiento persistentes y reintentables en servidor. Refrescar/cerrar el navegador no debe cancelar ni duplicar un trabajo aceptado.

Un curso compartido entre coordinaciones se procesa una vez por versión y distribuye sus resultados por afiliación del estudiante, no por el usuario que subió el archivo. No inferir que cada coordinación tiene cursos exclusivos. Una colisión de ID entre instancias requiere resolución antes de publicar.

## 9. Acceso, almacenamiento y rendimiento

Administrador: vista institucional, catálogos, ciclos, cortes, roles y resolución de incidencias. Coordinador: carga autorizada, seguimiento y exportaciones de sus carreras. Identidad y asignaciones se verifican en backend; usuarios no se autoasignan roles.

Los originales de cursos compartidos pueden contener estudiantes de varias coordinaciones: lectura restringida al administrador/procesador. El coordinador recibe resultados e incidencias de su alcance; ni las URLs de descarga ni los errores deben filtrar otras matrículas.

Firestore: registros y agregados paginables, no un documento gigante por ciclo ni una descarga de toda la institución al navegador. Cloud Storage: originales y exportaciones privadas. Functions: validación, procesamiento y publicación autorizada; documentar comprobaciones de alcance porque el SDK administrativo no depende de las reglas del cliente.

Registrar tamaño de originales, versiones y exportaciones por corte. Medir con el piloto y estimar capacidad por número de cursos × tamaño medio × cortes × retención, agregando derivados. No fijar retención o borrar originales hasta que el usuario apruebe la política. Reportar almacenamiento y costos estimados con los supuestos usados.

Prueba de carga con archivos sintéticos: lote de 45 cursos y consolidado de 230. Registrar duración, memoria, volumen y entorno; detectar errores parciales, reintentos y navegación durante la carga. No prometer tiempos de respuesta sin medir.

## 10. Seguimiento operativo

Bitácora por estudiante/curso/corte: observación, responsable, fecha de contacto, siguiente acción y estado del caso. Las observaciones no cambian las calificaciones importadas. Registrar autor y cambios. No enviar correos o mensajes en esta fase. Permitir exportación de resultados filtrados, con corte, actividades y exclusiones identificables; proteger celdas de texto contra interpretación como fórmulas.

## 11. Pendientes que no impiden programar con emuladores

- Repositorio y proyecto Firebase de destino; usuarios reales y asignaciones de acceso.
- Catálogo completo de cursos esperados y relación curso/grupo/docente donde el libro no la provea.
- Cargar datos privados y excepciones aprobadas; resolver otras ambigüedades que aparezcan.
- Acordar actividades incluidas en cada corte y calendario concreto de cortes.
- Fechas de entrega, escalas y umbrales de aprobación para indicadores posteriores.
- Retención, recuperación, presupuesto y tamaño real de archivos antes de producción.

No inventar valores para completar esos pendientes. Implementar estados «por configurar» y continuar con el desarrollo verificable.

## Actualización aprobada del catálogo y cargas

Las reglas vigentes recibidas en octubre de 2026 se detallan en
[integración de decisiones aprobadas](integracion-decisiones-aprobadas.md).
La referencia original a cinco coordinaciones describe el dimensionamiento inicial;
no es un límite de autorización. El catálogo revisado tiene seis responsables y
las membresías del sistema se asignan por separado.

Para el perfil aprobado, Escolarizado sigue bloques 1–2, 3–5, 6–7 y Ejecutivo
unidades semanales, por semana vencida y con fechas flexibles. Virtual tiene horario
confirmado y calendario semanal independiente aprobado en la integración de
reportes. Las cargas parciales acumulan datos por ID
estable de actividad sin convertir ausencias en cero. La prioridad de excepciones
individuales se limita a su inscripción y ciclo; no se alteran cortes cerrados.

La relación operativa es matrícula + instancia de curso + ciclo. La afiliación
principal conciliada (también C.A.) organiza carrera, grupo, modalidad y ámbito.
La inscripción específica de impartición no está determinada y no bloquea cargas.
El perfil institucional reconoce unidades/sesiones 1–7, cierre/final como unidad 7,
y adicionales con nota numérica, incluido cero; excluye totales y subtotales.
Contrato y límites en [integración de reportes](integracion-reportes.md).
