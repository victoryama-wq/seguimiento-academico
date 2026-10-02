# Parsers y previsualización de dominio · etapa 02

Esta API local Node no está conectada a React, Functions, Storage ni Firestore.
No publica cortes, autoriza usuarios o calcula indicadores. Las aprobaciones son
datos de entrada del dominio; un futuro backend deberá comprobar identidad y
rol antes de construirlas. Una cadena `approvedBy` no constituye autenticación.

## Recorrido verificable

1. `readTable(bytes, nombre, { sheet, delimiter, headerRow })` comprueba extensión,
   firma/estructura real, tamaño, integridad ZIP y límites. Retorna encabezados,
   celdas originales (valor, texto formateado, tipo, fórmula) y procedencia:
   nombre, SHA-256, bytes, parser, hoja, fila y época 1900/1904.
2. `mapRecords(table, tipo, mapa, version)` mapea padrón (`roster`), suplemento
   (`supplement`) y catálogo (`catalog`). Usa texto exacto de encabezado; se puede
   indicar columna cero-basada si se repite. Registra el mapa sin cambiar nombres
   originales. Campos faltantes, fórmulas, errores e identidad no textual son
   incidencias. No aprueba automáticamente el significado de una columna.
3. `prepareRoster(table, mapa, version, ciclo)` produce inscripciones con ID
   fuente/fila. Retiene todos los originales y las incidencias; no convierte
   números a matrículas ni elimina otras inscripciones de la misma persona.
4. `resolveAffiliations(inscripciones, contexto)` valida entradas con Zod. El
   contexto incluye catálogo con plan y versión, calendario por ciclo, bajas,
   excepciones y resoluciones auditadas de base por corte. Devuelve todas las
   inscripciones, clasificación, atributos derivados, personas, base confirmada
   e incidencias. No usar una clasificación sola como autorización de inclusión:
   hay que revisar sus problemas y resolver la afiliación antes de publicar.
5. `applySupplement(originales, cambios)` recibe correcciones/altas aprobadas con
   versión, autor, motivo e inscripción objetivo explícita (`replacesId`). Conserva
   historial y las demás inscripciones. Conflictos/reintentos no suman duplicados;
   un cambio de identidad requiere resolución. Nunca unir personas por nombre.
6. `parseMoodle(table, mapa)` requiere aprobar el tipo de **cada** columna y un
   ID explícito por actividad. `suggestColumn` solo ayuda a revisar: no confirma.
   Categorías, totales y fecha de descarga se conservan fuera de las actividades.
   No hay selección automática de actividades futuras ni cálculo de D/cobertura.
7. `resolveDuplicateRows` conserva originales y decisión (filas, fila conservada,
   autor, motivo, versión); después se vuelve a ejecutar `parseMoodle`. Los
   duplicados idénticos y los conflictivos se retienen completos y no entran a
   `accepted` mientras estén sin resolver. La resolución exige una misma identidad.

Los mapeos de catálogo conservan `careerId`, `abbreviation`, `coordination`,
`kind` y `plan`. No se fusionan carreras por abreviatura. Para el dominio se debe
confirmar además `architecture`: el código 48 no autoriza por sí mismo inferir
Arquitectura. Los calendarios, tipos y excepciones son entradas explícitas, no
valores deducidos de un nombre de archivo o de la fecha de hoy.

## Ejemplo de mapa de padrón

```ts
const mapa = {
  identity: { header: "Matrícula" }, name: { header: "Nombre" },
  careerId: { header: "Carrera" }, group: { header: "Grupo" },
  modality: { header: "Modalidad" }, shift: { header: "Turno" },
  date: { header: "Fecha de inscripción" },
};
const table = readTable(bytes, "padron.xlsx");
const preview = prepareRoster(table, mapa, "padron-v1", "27-1");
// Revisar preview.issues y preview.records antes de resolver afiliaciones.
```

Este mapa es un ejemplo sintético; no declara aprobado ese encabezado en las
fuentes reales. El nombre y valor originales siguen en `records`.

## Estabilidad y ambigüedad

- La identidad conserva el original, ceros y prefijos. Solo normaliza espacios,
  mayúsculas y local-part. Docente exige coincidencia completa `tup-d` + dígitos.
- Los IDs de actividad vienen del mapa aprobado, nunca del tipo de actividad,
  la posición o una nota. Reordenar encabezados únicos conserva sus IDs; cambiar
  un texto exige revisar el mapa. Encabezados repetidos exigen además
  `sourceSha256` del archivo exacto: su mapa posicional no se reutiliza en otra
  fuente silenciosamente. Dos tareas tienen dos IDs.
- `courseFilename` reconoce `ID Nombre Ciclo` y sufijos `calificaciones`/`grades`.
  Prefijos de descarga, copias numeradas y nombres dudosos requieren
  `resolveCourseFilename` con versión, autor y motivo. El ID externo nunca se
  convierte automáticamente en ID Moodle o ID de instancia.
- `courseCollisions` compara ID externo/ciclo contra instancias confirmadas. Una
  colisión se resuelve administrativamente; no publica ninguna de las versiones.
- Bajas sin fecha solo aplican al corte explícitamente confirmado. Excepciones
  entre ciclos conservan el original y requieren una base válida del mismo
  estudiante. Resolver varias bases exige una decisión administrativa por corte.

## Límites actuales

8 MiB de entrada, 32 MiB descomprimidos, 256 entradas ZIP, 10 000 filas,
256 columnas y 200 000 celdas. Se rechazan ZIP64/multivolumen, cifrado, rutas
inseguras, entradas solapadas, CRC incorrecto, entidades XML, expansiones ODS
excesivas, celdas combinadas y hojas ambiguas. ODS admite el namespace `table`
estándar; alias alternativos requieren conversión revisada. No se admiten ZIP de
lotes, XLS, macros ni adjuntos arbitrarios. CSV exige UTF-8 y delimitador
explícito (coma por defecto); no se adivina la configuración regional.

Las fechas son civiles ISO o DD/MM/AAAA, o seriales enteros con época explícita;
no se acepta el falso 29/02/1900 de Excel. Notas con coma decimal requieren un
mapeo futuro aprobado; actualmente son incidencias y no se convierten. Fórmulas
y errores nunca se ejecutan ni se usan como calificaciones válidas. Los valores
numéricos no permiten inferir una escala ni un umbral de aprobación.

El parser es síncrono y acotado; aislamiento de procesos, cuotas, procesamiento
persistente, versiones atómicas e interfaz de revisión pertenecen a la importación
servidor posterior. No hay conciliación real ni prueba de carga 45/230 cursos.
