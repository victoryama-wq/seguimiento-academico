# Modelo implementado · etapa 03

La persistencia se verifica en emuladores. Este documento sustituye las rutas
propuestas en etapa 01 por las rutas ejecutables actuales. Los esquemas académicos
puros y parsers de etapa 02 se compilan también para Functions sin duplicarlos.
No hay agregados, indicadores, comparaciones o bitácora de etapa 04.

## Autoridad y colecciones

| Ruta Firestore | Contenido / invariante |
| --- | --- |
| `memberships/{uid}` | role admin/coordinator, active, careers. Servidor y reglas consultan esta autoridad; ignoran claims de rol. |
| `accessAudit/{id}` | UID afectado, nueva membresía, aprobador y fecha; solo servidor escribe, administración lee. |
| `bootstrap/initial-admin` | Marcador de asignación privilegiada inicial, transaccional e inmutable desde cliente. |
| `cycles/{id}` | Calendario civil explícito y punteros a versiones de fuentes actuales. |
| `courses/{id}` | Instancia interna, ciclo, ID externo, nombre y carreras; inmutable en la API actual. |
| `courseExternalIds/{hash}` | Reserva transaccional del ID externo/ciclo: impide unir instancias por una colisión. No es el ID interno Moodle. |
| `cuts/{id}` | Ciclo, fecha civil, fuentes exactas, calendario, estado open/closed, padre/motivo de revisión y autor/cierre. |
| `jobs/{hash}` | Descriptor original, mapeo, autor, fechas, estado, intentos, lease, token del intento, versión esperada y artefacto validado. Metadatos completos privados. |
| `jobs/{hash}/attempts/{token}/rows/{fila}` | Staging de filas con matrícula original, carrera afiliada, estados/valores de actividades e incidencias. Hasta 100 filas por consulta y 128 KiB por fila. |
| `sources/{hash}` | Publicación inmutable de fuente administrativa: original, artefacto, aprobador, versión anterior y procedencia. |
| `publications/{jobId}` | Versión inmutable del reporte y referencias exactas de fuentes, token de staging, corte/curso, autor/fecha y revisión. |
| `cuts/{id}/courses/{courseId}` | Único puntero activo a publicación/revisión de la instancia; se cambia mediante transacción. |

Inscripciones y personas siguen siendo entidades distintas dentro de los artefactos
académicos privados. No se deduplican inscripciones por matrícula. Se conservan
origen, seguimiento, época de cada archivo, fecha civil, originales y procedencia.
La proyección de cada reporte se asigna por afiliación resuelta; el cargador no
define la carrera del estudiante. Casos sin base resuelta bloquean publicación.

## Almacenamiento privado

| Ruta Storage | Contenido |
| --- | --- |
| `originals/{jobId}/source` | Bytes exactos; nombre y hash en metadatos privados. Escritura condicional `ifGenerationMatch: 0`; repetición exige hash idéntico. |
| `derived/{jobId}/{token}.json` | Fuente interpretada o manifiesto académico, parser, mapeos, auditorías, incidencias y exclusiones. Nunca expuesto íntegro a coordinadores. |
| `exports/{uid}/{hash}.csv` | Página de carrera y versión fija, con texto protegido contra fórmulas; descarga mediada por Functions y membresía vigente. |

Sin URLs públicas, tokens de descarga persistidos ni matrícula en rutas. Solo
administración puede leer directamente originales/derivados/exportaciones. Todas
las escrituras cliente se deniegan; el servidor verifica identidad, esquema y
alcance porque Admin SDK no depende de esas reglas. No hay borrado o retención
automáticos, incluidos intentos incompletos.

## Estados y publicación

```mermaid
stateDiagram-v2
  [*] --> awaiting_upload: descriptor validado
  awaiting_upload --> queued: bytes y hash aceptados
  queued --> processing: claim transaccional
  processing --> ready: staging completo
  processing --> invalid: contenido o mapeo inválido
  processing --> queued: fallo temporal e intento menor a 3
  processing --> failed: intentos agotados
  processing --> queued: recuperación de lease vencido
  ready --> published: confirmación sin bloqueos y CAS
```

`ready` puede tener incidencias bloqueantes: validado estructuralmente no significa
aprobado. El worker consulta estado persistido, no confía en el orden de eventos.
Cada intento tiene UUID y lease; un worker anterior no puede cambiar el resultado
de un intento nuevo. Filas parciales quedan privadas y no se activan.

Idempotencia de reporte: hash de representación canónica de corte, instancia,
fuentes fijadas, hash de bytes y mapeo. Fuente administrativa: ciclo, tipo y descriptor.
Reenviar la misma identidad de trabajo reutiliza su estado. Contenido/mapeo distinto
produce otra propuesta. La confirmación lee corte, membresía y versión esperada
dentro de la transacción; crea publicación y cambia puntero y estado juntos.
Una confirmación repetida es un no-op. Una propuesta obsoleta devuelve conflicto;
no hay overwrite forzado. No se crean agregados ni se suman versiones.

La fotografía de fuentes se fija **al crear el corte**, abierto o cerrado. Cambiar
padrón/catalogo/suplemento/excepciones no reescribe esa fotografía. Cerrar compite
transaccionalmente con publicar y no puede deshacerse; repetir cierre no modifica
su fecha. Una corrección crea otro corte con padre cerrado y motivo.

## Consultas y permisos

La API valida entradas Zod, identidad Auth y membresía activa en cada operación.
En mutaciones transaccionales vuelve a leer la membresía para evitar cambios de
rol entre prevalidación y escritura. Administración puede gestionar fuentes,
calendarios, cursos, cortes y permisos; coordinadores solo cursos que intersectan
sus carreras. Preview, resultados y exportaciones consultan una carrera autorizada.
Las incidencias sin afiliación y docentes no se distribuyen por identidad supuesta.

Reglas Firestore permiten membresía propia y, tras publicar, filas filtradas por
carrera y token activo de esa publicación. Niegan listados de expedientes sin
filtro y filas ajenas; el staging solo pasa por API autorizada. El reemplazo mantiene
las publicaciones históricas consultables en su mismo alcance. Revocar membresía
deniega incluso con un token Auth previamente emitido.

Jobs: `cutId == ...` y `__name__`, cursor de documento. Filas: `careerId == ...`
y `__name__`, cursor; 100 por página. Los índices simples automáticos cubren estas
consultas; no se añadieron filtros arbitrarios ni índices compuestos. Antes de nube
deben comprobarse en el proyecto real. `overview` limita 100 ciclos/cortes y 500
cursos y requiere ampliar navegación histórica antes de excederlos.

Retención, respaldo, costos y prueba de carga 45/230 cursos siguen pendientes.
Los estados numérica/guion/vacía/inválida se conservan; no se calcula cobertura,
aprobación, atraso docente o comparación entre poblaciones.
