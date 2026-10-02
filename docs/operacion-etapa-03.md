# Operación local de etapa 03

Solo emuladores desechables. La aplicación y las Functions rechazan proyectos reales.
Node 22, Java 21, `npm ci`, `npm run build`, `npm run emulators`; otra terminal para
`npm run dev`. No hay registro público que conceda roles.

## Identidades y primer administrador

Crear una cuenta Auth sintética existente mediante el SDK Admin o API del emulador.
En PowerShell, con los emuladores ya iniciados:

```powershell
$env:GCLOUD_PROJECT = 'demo-seguimiento-ci'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199'
node scripts/bootstrap-admin.mjs UID_EXISTENTE
```

El script comprueba la cuenta y crea membresía y marcador de inicialización en una
transacción. Una segunda asignación se rechaza. Después, el administrador usa
**Configuración → Asignar acceso**: UID existente, `admin` o `coordinator`, carreras
por ID y activo `true`/`false`. No puede cambiar su propia membresía. Los cambios
quedan en `accessAudit`; retirar acceso surte efecto con el mismo token Auth.
La gestión de cuentas reales y recuperación de administradores queda para piloto.

Para revisar directamente un escenario completo **ficticio**, con las mismas
variables anteriores y un entorno local desechable:

```powershell
node --experimental-strip-types scripts/seed-demo.mjs --reset-synthetic
```

**Este comando vacía Firestore del proyecto demo**, crea cuentas sintéticas y
publica las fuentes de la fixture. No borra originales Storage: los hashes deben
coincidir si se reutilizan. Cuentas `admin-sintetico@example.invalid`,
`coordinador-a@example.invalid`, `coordinador-b@example.invalid`; contraseña pública
de prueba `Synthetic-only-stage03-2026`. No usar estas identidades en ningún
proyecto real. La asignación inicial de la fixture usa privilegios locales de
prueba; el flujo normal de la app solo permite asignar por administrador.

## Fuentes y mapeos

Administración configura primero el ciclo y calendario explícito. En **Fuentes**,
seleccionar **Fuentes administrativas**, ciclo, tipo, archivo y mapeo revisado.
Una fuente validada se previsualiza y se publica mediante confirmación. Sustituir
una existente requiere marcar la casilla correspondiente. Cada fuente conserva
archivo, hash, tamaño, nombre, mapeo, autor y versión anterior.

| Tipo | Formato y campos lógicos |
| --- | --- |
| `roster` | ODS/XLSX/CSV: identity, name, careerId, group, modality, shift, date; cycle opcional mapeado. Sin cycle, el origen procede del grupo validado, nunca del seguimiento. |
| `catalog` | ODS/XLSX/CSV: careerId, plan, abbreviation, coordination, kind, architecture (`true`/`false` explícito). |
| `supplement` | Campos del padrón más replacesId (vacío para alta), reason y approvedBy; el servidor impone actor/versión reales de la sesión. Referenciar el ID de inscripción anterior, no solo matrícula. |
| `withdrawals` | JSON UTF-8: array de identity, effectiveDate civil o null, confirmedCutId obligatorio y reason. El servidor incorpora version y approvedBy. |
| `exceptions` | JSON UTF-8: array de enrollmentId, originalCycle, targetCycle, cutId, baseEnrollmentId y reason. El servidor incorpora version y approvedBy. |

`exceptions` también admite un objeto `{"exceptions":[],"baseResolutions":[]}`.
Cada resolución de base contiene identity, cutId, baseEnrollmentId y reason; el
servidor asigna actor/versión. Así se reutiliza la resolución de bases ambiguas de
etapa 02 sin excluir silenciosamente inscripciones. Publicar estas decisiones antes
de crear el corte referido o su revisión; no cambia cortes existentes.

Un selector es `{"header":"Encabezado exacto"}`; encabezados ambiguos requieren
índice explícito según el parser de etapa 02. Ejemplos completos sintéticos y
calendario en `tests/fixtures/synthetic/stage03.ts`. Los mapeos son configuración,
no código evaluable. Un nombre de curso ambiguo se rechaza; no se infiere su ID.
Para corregirlo, administración vuelve a seleccionar el mismo original y completa
**Resolución administrativa del nombre** con JSON como
`{"externalId":"1","name":"Curso compartido","cycle":"27-1","reason":"Motivo contrastado"}`.
ID y ciclo deben coincidir con la instancia seleccionada. La API deniega esta
facultad a coordinadores y rechaza actor/versión enviados por cliente: los asigna
desde la sesión y el trabajo. La revisión administrativa muestra nombre exacto,
hash y decisión auditada. No se renombra ni sobrescribe el original rechazado;
la decisión crea otra propuesta, y reenviar la misma decisión reutiliza su versión.

Crear los cursos esperados con ID interno propio, ID externo leído del nombre,
nombre y carreras autorizadas. No se admite otra instancia con el mismo ID externo
en ese ciclo sin resolver previamente la colisión. Publicar padrón y catálogo
antes de crear un corte. **El corte fija las fuentes desde su creación**, incluido
calendario; cambiar las fuentes del ciclo afecta únicamente a cortes nuevos.

## Lotes, revisión y recuperación

Seleccionar varios reportes ODS/XLSX/CSV, instancia y mapeo por archivo. Ejemplo Moodle:

```json
{"identity":{"header":"Correo"},"columns":[{"selector":{"header":"Nota"},"kind":"activity","activityId":"actividad-1"}]}
```

La selección explícita identifica actividades; categorías/totales se mapean con
su tipo y no se publican como actividades. No se calcula escala o indicador.
Solo administración puede adjuntar `resolutions` al mapeo para resolver duplicados
con `rows`, `keep`, selector `identity`, `reason` y auditoría impuesta por servidor.
Para corregir mapeos, volver a enviar el
mismo archivo con el mapeo corregido: se crea otro trabajo y se conserva el anterior.
Las excepciones académicas se incorporan a una revisión de corte con nuevas fuentes.

El progreso muestra envío, cola, procesamiento, validado, inválido, error o publicado.
El trabajo sobrevive al cierre **después de aceptar todos los bytes en servidor**;
un envío interrumpido antes de ese punto requiere seleccionar nuevamente el archivo.
Los archivos inválidos no impiden publicar otros válidos del lote. Toda incidencia
bloqueante exige revisión; un coordinador no ve identidades de otra carrera.
Una calificación inválida conserva su valor original, estado `invalida` e incidencia
`calificacion_invalida`; permite confirmar y aparece en resultados/exportación
de la carrera autorizada. Identidades pendientes, duplicados y problemas
estructurales siguen bloqueados. No se convierte texto, vacío o guion en cero.
La casilla de sustitución corresponde únicamente a la propuesta revisada:
cambiar trabajo, página de revisión, corte o carrera la limpia. Las respuestas
antiguas de otras previsualizaciones no cambian la propuesta ni su confirmación.

Los trabajos y filas se paginan de 100 en 100. La exportación recorre todas las
páginas de una carrera y versión fija; revalida membresía en cada llamada. CSV
protege texto con prefijo de fórmula mediante apóstrofo. El valor exacto se
conserva en original privado y respuesta estructurada; el CSV es una presentación
segura. Exclusiones autorizadas se muestran hasta 100 por previsualización; el
artefacto completo permanece privado. No se exportan notas de bajas o docentes.

Reintentar un trabajo recuperable no crea otra publicación: máximo 3 intentos.
El worker usa arrendamiento de 150 s y ejecución de 120 s; un intento abandonado
se recupera tras vencimiento por redelivery o por **Reintentar**. Un inválido requiere
corregir contenido/mapeo. No se reinicia el contador de fallos desde el navegador.

Dos propuestas contra la misma versión no se pisan. Una confirma; la otra recibe
conflicto. Se conserva para inspección. Para continuar debe prepararse una nueva
propuesta revisada (contenido/mapeo distinto) contra el puntero actual; no se permite
forzar la propuesta obsoleta ni restaurar automáticamente una versión antigua.

Cerrar un corte es irreversible por la API de esta etapa y bloquea cargas y nuevas
publicaciones, aunque staging termine después. Una corrección usa corte nuevo,
`parentId` cerrado y motivo explícito; conserva el corte anterior y sus originales.

## Límites y condiciones de piloto

20 archivos/lote, 8 MiB/archivo, 40 MiB/lote; parser 10 000 filas incluyendo
encabezado, 256 columnas, 200 000 celdas, 32 MiB descomprimidos y 128 KiB por fila
persistida. JSON administrativo: 10 000 registros. Sin ZIP de lotes. La UI resume
100 ciclos, 100 cortes y 500 cursos; ampliar navegación histórica antes de excederlos.
Los uploads viajan en base64 en la callable; no son subidas reanudables por bloques.

No se han medido 45/230 cursos, latencias, memoria/costos reales o recuperación ante
pérdida de la infraestructura. No se aprueba retención ni se elimina una fuente.
Antes de nube: proyecto, IAM, App Check/cuotas operativas, índices medidos, respaldo,
usuarios/asignaciones reales y revisión de dependencias. Estas validaciones locales
no equivalen a habilitar producción.
