# Modelo de datos · etapa 01

Este documento diseña la persistencia posterior. **No hay importaciones, publicaciones
ni datos académicos persistidos por la aplicación en esta etapa.** Los contratos
ejecutables iniciales están en `src/domain/schemas.ts`; las relaciones, transacciones
y políticas descritas aquí aún no se implementan. Las reglas actuales deniegan toda
lectura/escritura cliente. Firebase Auth y Storage se prueban solo con emuladores.

## Identidad, inscripciones y autorización

| Colección / clave propuesta | Contenido y relaciones |
| --- | --- |
| `persons/{personId}` | Identidad estable interna, matrícula original y normalizada textual. La unicidad institucional se resolverá por matrícula normalizada; nunca se unirá por nombre. Índice de identidad administrado exclusivamente por servidor. |
| `rosterVersions/{versionId}` | Ciclo, procedencia, autor, hash del original, versión anterior y estado de validación/publicación. Publicaciones inmutables. |
| `rosterVersions/{versionId}/enrollments/{enrollmentId}` | `personId`, fila de origen, carrera/plan, grupo y fecha originales, fecha civil interpretada, modalidad/turno originales y derivados, clasificación y afiliación base resuelta o nula. Una persona conserva tantas inscripciones como fuentes válidas tenga. |
| `catalogVersions/{versionId}/programs/{programId}` | Carrera, plan, abreviatura, coordinación y procedencia. No fusionar planes por parecido del nombre. |
| `exceptionVersions/{versionId}/entries/{entryId}` | Altas/correcciones/bajas auditadas: aprobador, motivo, fuente sustituida, ciclo original y fecha de efecto nullable. No inventar fechas ni codificar matrículas reales. |
| `memberships/{uid}` | Rol autorizado, coordinaciones asignadas, estado, asignador y versión. Solo administración mediante backend confiable podrá cambiarlas; nunca un rol enviado por el navegador. |

`personId` y `enrollmentId` son distintos. Las claves no exponen matrículas ni correos
en URLs o rutas Storage. El contrato inicial permite afiliaciones nulas para que los
casos sin resolver no se atribuyan arbitrariamente. La resolución académica pertenece
a etapa 02. Se conservarán matrícula y valores fuente incluso después de normalizar.

## Ciclos, cortes, cursos y publicaciones

| Colección / clave propuesta | Contenido y relaciones |
| --- | --- |
| `cycles/{cycleId}` | Nombre, fechas civiles de inicio/fin y calendario configurable. `27-1` es ciclo de prueba documentado, no selección activa automática. |
| `cycles/{cycleId}/cuts/{cutId}` | Fecha civil, estado, referencias exactas de padrón, catálogo y excepciones, publicación vigente y fecha de cierre. |
| `courseInstances/{instanceId}` | Identificador interno propio, ciclo, nombre original, número leído del nombre y Moodle ID opcional independiente. Dos instancias con el mismo número requieren incidencia, no una unión automática. |
| `courseInstances/{instanceId}/activities/{activityId}` | Identidad estable, encabezado original, tipo actividad/categoría/total y mapeo aprobado entre fuentes. Escala desconocida nullable. |
| `courseVersions/{versionId}` | Tupla `cycleId + cutId + courseInstanceId`, revisión, importación fuente y selección explícita de actividades. El número del nombre no constituye la instancia. |
| `publications/{publicationId}` | Manifiesto inmutable de versiones y selecciones, autor/fecha, versión esperada del corte y estado preparado/publicado. |
| `publications/{publicationId}/courses/{instanceId}` | Referencia de versión publicada por curso. Evita un array creciente de cursos en un único documento. |

Claves compuestas se derivarán en servidor de una representación canónica de tuplas
(no concatenación ambigua). Cada revisión tendrá ID propio; la identidad lógica
del curso sigue siendo ciclo + corte + instancia. La reimportación de igual hash y
tupla será idempotente. Un hash nuevo crea una propuesta de revisión, nunca suma dos
versiones activas. Publicar exigirá transacción de versión esperada sobre el puntero
vigente, y solo derivados ya preparados. Un cierre hará inmutable su fotografía;
corregir requiere otra revisión con autor, motivo y referencia a la anterior.

## Observaciones, procesamiento y trazabilidad

| Colección / clave propuesta | Contenido y relaciones |
| --- | --- |
| `imports/{importId}` | Original privado, SHA-256, bytes, nombre, usuario, fecha, parser y versión; clave de idempotencia, estado persistente por archivo, errores limitados al alcance del lector. |
| `imports/{importId}/mappings/{mappingId}` | Mapeo confirmado de columnas, curso, actividades y decisiones de previsualización; versión y autor. |
| `jobs/{jobId}` | Intentos, fase, progreso, control de concurrencia, lease y resultado. Reintentar no duplica efectos. El navegador no es dueño de la ejecución aceptada. |
| `courseVersions/{versionId}/grades/{observationId}` | Persona + instancia + actividad + versión/corte, referencias de inscripciones elegibles, valor original, estado numérico/guion/vacío/inválido e incidencia opcional. |
| `issues/{issueId}` | Fuente/fila/campo, tipo, estado y resolución auditada. El documento completo es privado al procesador/administración. Proyecciones por alcance evitan filtrar matrículas ajenas. |
| `caseNotes/{noteId}/revisions/{revisionId}` | Persona/curso/corte, observación, responsable, fecha de contacto, siguiente acción, estado, autor y cambios. Nunca altera una calificación importada. |
| `scopes/{coordinationId}/publications/{publicationId}/results/{resultId}` | Proyecciones autorizables y paginables por afiliación del estudiante, independientes del cargador del original compartido. |
| `scopes/{coordinationId}/publications/{publicationId}/aggregates/{aggregateId}` | Contadores D, N, Z, G, V, E por conjunto de filtros y selección publicada. Personas únicas se cuentan por identidad, no sumando matrículas por curso. |

Los estados de calificación se conservan separados. `0` es numérico, `-` no indica
entrega ni atraso, vacío no es guion. Los esquemas no calculan indicadores. En etapas
posteriores se comprobará `D = N + G + V + E`, `Z <= N`, y `D=0` no mostrará 0 %.
Solo actividades seleccionadas participan; categorías y totales quedan fuera.

La comparación requerirá un universo común explícito de estudiantes, cursos y
actividades. Bajas, incorporaciones y cambios de afiliación/selección se informan
por separado. Sin correspondencia estable será «no comparable».

## Storage y límites

- Rutas previstas: `originals/{importId}/{sourceVersionId}/source` y
  `exports/{exportId}/result`. El nombre original queda en metadatos privados.
- Originales compartidos: administrador/procesador, nunca lectura por ser cargador.
  No persistir URLs públicas o tokens de descarga reutilizables en proyecciones.
- No guardar libros, listas completas de estudiantes ni cortes enteros en un
  documento Firestore. Observaciones/inscripciones/incidencias son documentos
  separados. No diseñar cerca del límite de 1 MiB por documento de Firestore.
- Listas futuras con `limit` y cursor estable; límite inicial propuesto 50 por
  página. No descargar la institución completa al cliente. El límite se validará
  con el piloto; no se han medido rendimiento ni costos.
- Límites de archivo, filas, actividades por libro, concurrencia y exportación
  se definirán y probarán al implementar importación. ZIP no está admitido ahora.
- Fechas académicas `YYYY-MM-DD` sin cambio de día por zona; instantes de auditoría
  como Timestamp UTC, presentados según `America/Cancun`.
- Retención y eliminación de originales pendientes de aprobación; no hay borrado
  automático ni estimación inventada de capacidad.

## Índices y fronteras de confianza

`firestore.indexes.json` está vacío porque esta etapa no hace consultas académicas.
Se proponen, para crear junto a sus consultas y pruebas en etapas posteriores:

| Ámbito | Índice compuesto previsto |
| --- | --- |
| Inscripciones de una versión | `personId`, `classification`, `__name__` |
| Cursos de ciclo | `cycleId`, `parsedCourseNumber`, `__name__` |
| Importaciones | `cycleId`, `cutId`, `status`, `createdAt`, `__name__` |
| Resultados bajo un alcance | `programId`, `baseGroupId`, `courseInstanceId`, `__name__` |
| Incidencias autorizadas | `status`, `kind`, `createdAt`, `__name__` |

No se implementan todavía combinaciones arbitrarias de filtros. Antes de permitir
consultas se probarán lecturas permitidas/denegadas, originales, exportaciones y
accesos cruzados. El backend con SDK Admin deberá verificar identidad, membresía,
alcance, versión y esquema independientemente de las reglas cliente. La etapa 01
no importa el SDK Admin en Functions ni abre un endpoint de datos: solo expone
diagnóstico técnico, rechazado fuera del entorno demo completo.
