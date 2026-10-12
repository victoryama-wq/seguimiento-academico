# Conciliación privada provisional

El 5 de octubre de 2026 el propietario proporcionó por ruta local cuatro libros
ODS y el padrón CSV. Se leyeron con `readTable`, `parseMoodle`, normalización de
identidad, fechas civiles y parser de grupos del proyecto. No se subieron a
Firebase, GitHub ni Hosting; no se editaron originales. SHA-256 verificado antes
y después de la lectura. Manifest y reporte detallado están en `private/`,
ignorado por Git y fuera del build. Este documento solo contiene agregados.

## Inspección, todavía no aceptación académica

| Libro (ID externo) | Bytes | Filas entrada | Filas identificadas como docente | Filas sin conflicto de identidad | Coinciden con padrón | Sin padrón | Actividades candidatas |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 6.068 | 20 | 0 | 20 | 19 | 1 | 22 |
| 10 | 6.544 | 32 | 1 | 31 | 31 | 0 | 22 |
| 600 | 7.723 | 37 | 0 | 37 | 34 | 3 | 21 |
| 616 | 5.989 | 27 | 0 | 27 | 27 | 0 | 14 |

Sin filas duplicadas/conflictivas detectadas en estos cuatro reportes. «Sin padrón»
no se interpreta como baja. La fila de docente se reconoce por la regla exacta
existente de identidad, no por nombre. Las filas sin conflicto pueden todavía
requerir resolución académica o una exclusión aprobada.

Las candidatas se tomaron de encabezados de tareas, foros y exámenes, conservando
su texto y orden originales; totales/categorías/metadatos no se incluyeron. Su
identificación es **inspección técnica**, no aprobación de selección para un corte.
Algunos libros tienen columnas en orden distinto: no se infiere equivalencia por
posición. La lista privada permite revisar cuáles corresponden al corte.

| Libro | Celdas numéricas candidatas | Guion | Vacío | Inválido | Ceros incluidos en numéricas |
|---|---:|---:|---:|---:|---:|
| 1 | 80 | 360 | 0 | 0 | 5 |
| 10 | 61 | 621 | 0 | 0 | 0 |
| 600 | 262 | 515 | 0 | 0 | 1 |
| 616 | 102 | 276 | 0 | 0 | 0 |

Estos conteos excluyen la fila docente detectada, pero **no son N/G/V/E/D finales**:
faltan aprobación de actividades, bajas, catálogo y afiliaciones. No se calculó
cobertura ni se atribuyeron entregas, retrasos, aprobación o promedios.

Padrón: 318.734 bytes, 2.867 inscripciones, 2.661 identidades normalizadas y 177
personas con varias inscripciones, todas conservadas. Sin identidades vacías ni
fechas ilegibles. La inspección sin catálogo encuentra 48 grupos con incidencia
de formato/código/arquitectura; no se resuelven automáticamente. Hay una inscripción
de otro ciclo. Conteo provisional por fecha/grupo: 2.500 candidatas base, 356 con
fecha especial o sufijo C.A, 11 con fecha fuera del calendario considerado. La
precedencia C.A y la fecha original se conservan. No se ha inferido una carrera,
plan o coordinación por el nombre para declarar afiliación resuelta.

## Pendientes precisos de aceptación

- Catálogo autorizado con ID de carrera, plan, abreviatura, coordinación y tipo;
  el propietario anunció que lo compartirá. Sin él no se acepta distribución final
  ni aislamiento sobre los expedientes reales, ni se determina si 48 corresponde
  a Arquitectura en cada fila.
- Suplemento de altas/cambios o declaración explícita de que no aplica. Sin ello
  no se acepta la completitud del padrón ni las cuatro filas sin correspondencia.
- Listado de bajas aprobado con fecha efectiva y corte (incluidas las tres bajas
  mencionadas en requisitos), y excepciones/afiliaciones base de casos especiales,
  incluyendo la inscripción de otro ciclo. Sin ello no se acepta universo excluido
  ni base final. No se inventaron bajas a partir de ausencias.
- Corte/fecha y selección de actividades por instancia de curso. Sin ellos no se
  acepta denominador, cobertura ni comparabilidad real.
- Revisión institucional de discrepancias, posterior piloto de usuario y validación
  de nube. Coincidencias de texto normalizado no reemplazan esa revisión.

## Reproducción privada

Compilar Functions (`npm run build --workspace functions`), preparar
`private/pilot-manifest.json` con rutas locales, ciclo, columnas reales del padrón
y mapeos explícitos; ejecutar `node scripts/reconcile-private.mjs`. El script exige
manifest bajo `private/` y guarda ahí el reporte; no realiza llamadas de red.
No distribuir el manifest ni el informe de filas. Mantener las fuentes originales
en su ubicación privada. El CI usa exclusivamente fixtures sintéticos.

La evaluación final debe ejecutar `prepareRoster`, suplemento y
`resolveAffiliations` con catálogo y decisiones realmente aprobados y comparar
las cuentas por archivo, exclusiones y procedencia. Esa aceptación sigue pendiente,
no se sustituye con el fixture sintético.
