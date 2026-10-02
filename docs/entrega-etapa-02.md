# Entrega de etapa 02: reglas y parsers

Fecha: 2026-10-02 (America/Cancun). Rama: `etapa-02-reglas-y-parsers`.
Base revisada: `518f09a515d197ef051eb627137fc0ca1a1f252a` en `origin/main`.
El commit exacto y el resultado de Actions se adjuntan al PR de la rama; este
documento registra la verificación local, no anticipa un resultado remoto.

## Criterios y evidencia

| Criterio de etapa 02 | Implementación y comprobación |
| --- | --- |
| ODS/XLSX/CSV, validación y procedencia | `files.ts`, fixtures binarios versionados, CSV independiente y ODS mínimo independiente de SheetJS. Formato real, CRC, límites, hojas, UTF-8, CSV citado, seriales y época 1904. |
| Padrón, suplemento y catálogo configurables | `mapRecords` conserva encabezados, celdas y mapa/versiones; pruebas de los tres formatos. `prepareRoster` integra lectura con dominio conservando filas no resueltas. |
| Identidad y docentes | Ceros, prefijos, espacios, local-part, patrón docente completo, valores numéricos rechazados; varios docentes separados. |
| Grupo, calendario y prioridad | Todos los códigos, grados ordinarios, 48 fuera de Arquitectura, COMPUB, C.A fuera de 29/08 y mal formado; no equiparar CA. ISO/DD/MM/AAAA/serial sin desplazamiento de día. |
| Afiliación e incidencias | Base + especial, inglés/clinicos/deportes + carrera, varias bases, especial sin base, campos desconocidos; resolución administrativa versionada por corte. |
| Suplementos, bajas y excepciones | Sustitución de inscripción específica con historial, alta, conflicto/reintento, rechazo de cambio de identidad; baja con/sin fecha, excepción de otro ciclo conservando original y aprobación. |
| Columnas y calificaciones | Cero, guion, vacío, inválido, fórmula/error; categorías/totales/metadatos fuera de actividades. No se infiere escala ni se seleccionan actividades futuras. |
| Actividades estables | Dos tareas no se fusionan; IDs explícitos, columnas reordenadas, renombradas y duplicadas; estas últimas exigen hash de fuente revisado. |
| Curso y duplicados | Nombres con ID/nombre/ciclo, ambigüedad y resolución auditada, colisión de instancias; duplicados/conflictos retenidos y resolución por fila aprobada. |
| Alcance y riesgos | README corregido: indicadores/panel en etapa 04. Informe de dependencias y bundle conserva pendientes sin degradaciones. |

## Verificación local ejecutada

Windows; Node **22.22.0**, npm **10.9.4**, Java Temurin **21.0.12.1**.
Instalación limpia con `npm ci`, usando el lockfile actualizado; salida 0.

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Aprobado, sin warnings. |
| `npm run typecheck` | Aprobado en web/dominio/tests y Functions. |
| `npm run test:unit` | **168/168**, seis archivos; conserva las 26 regresiones de fuentes/afiliación/suplemento y añade 17 para las tres conversaciones de revisión. |
| `npm run build` | Aprobado web y Functions; advertencia de bundle documentada. |
| `npm run test:emulators` | **11/11**, Auth/Firestore/Storage/Functions demo reales. |
| `npm run test:e2e` | **8/8**, Chromium escritorio/móvil con emuladores limpios. |
| `git diff --check` | Sin errores de whitespace. |
| `npm audit --json` | 14 avisos (10 altos, 4 moderados), pendiente; no es un check de CI aprobado. |

Emuladores y E2E se ejecutaron secuencialmente. Su ámbito sigue siendo el contrato
de etapa 01: denegación de datos y diagnóstico/interfaz inicial. No se presentan
como evidencia de permisos operativos o importación nube, que aún no existen.
La cobertura nueva de etapa 02 está en las unidades de dominio y parsers.

## Datos, acceso y limitaciones

- Solo fixtures sintéticos. No se accedió ni concilió ningún archivo privado de
  padrón/Moodle, suplemento, catálogo o bajas. Las tres bajas reales no se
  inventaron. La conciliación real queda separada y pendiente.
- No hay cambios visuales; no se generan capturas que aparenten una interfaz de
  importación existente. Los borradores y resoluciones son APIs locales puras.
- No cambian reglas Firebase, Functions, UI, workflow ni controles de CI.
  No hay migraciones, escrituras cloud, publicación de cortes o nuevos permisos.
- Escalas, plazos, catálogo real, calendarios y actividades aprobadas requieren
  entradas reales autorizadas. No se calculan indicadores ni denominadores.
- Límites/formatos admitidos y restricciones deliberadas están en
  `src/importing/README.md`. Aislamiento de procesos y pruebas de carga 45/230
  cursos quedan para importación/piloto; no se promete rendimiento.
- `docs/dependencias-y-bundle.md` conserva 14 alertas y el JS de 774 279 bytes.
  No se aplicaron `audit fix --force`, overrides ni degradaciones automáticas.

La entrega requiere revisión independiente del PR. No se fusiona ni se despliega.

## Corrección de la revisión del PR #1

Se conserva el ciclo de origen (mapeado o derivado del grupo), separado de
`trackingCycle`; discrepancias no se rellenan. Las fechas se normalizan con la
época del archivo y los originales/procedencia acompañan a cada inscripción.
El dominio ya no recibe una época global del calendario. Los suplementos
encadenados se rechazan íntegramente antes de aplicar cambios, conservando las
correcciones independientes e historial con resultado determinista.

`tests/unit/roster-regressions.test.ts` recorre archivos→lectura→mapeo→borradores→
afiliación, incluidas excepciones entre ciclos, libros 1900 y 1904 mezclados,
44803→2026-08-31, discrepancias e incidencias. Recorre también archivos→borradores→
suplemento→afiliación y compara todas las permutaciones de un lote con cadena y
corrección independiente, altas encadenadas, ciclos y destinos ya existentes.

El commit exacto, resultado y enlace del CI reconocido por el PR se registran en
su descripción, actualizada después de la publicación. Un run manual no se
presenta como solución del disparo automático pendiente.

### Diagnóstico del disparo automático

La API de permisos indicaba Actions habilitado y el workflow activo, pero la
página de Actions, consultada con la sesión del propietario, mostraba
`Workflows aren't being run on this repository` y el botón
`Enable Actions on this repository`. No había ejecuciones esperando aprobación.
El PR y sus eventos pertenecen al propietario y a ramas del mismo repositorio;
no proceden de un fork. La autenticación de publicación usa GitHub CLI del
propietario, sin `GITHUB_TOKEN` de un workflow.

Se habilitaron las ejecuciones mediante ese control de GitHub, que confirmó
`Actions Enabled`. No se cambiaron el YAML, los permisos del token, las políticas
de aprobación ni la protección de `main`. La publicación de esta documentación
permite comprobar nuevamente el evento `pull_request` de sincronización con el
último commit. El resultado se verifica en los checks del PR; la habilitación
por sí sola no prueba que CI haya pasado. No se conoce qué operación previa
originó esa deshabilitación.

Las seis verificaciones locales se repitieron para la corrección del código:
151 unidades, 11 pruebas de emuladores y 8 E2E aprobadas, además de lint,
typecheck y build. La instalación limpia y el audit de la tabla anterior
corresponden a la entrega inicial de etapa 02; no se repitieron para esta
corrección y el lockfile permanece sin cambios.

## Tres conversaciones pendientes atendidas

Base de esta corrección: `9ebb0054de4a530e4da70074d080f23f6ddcb1fa`.
Evidencia en `tests/unit/review-regressions.test.ts`, solo datos sintéticos:

| Conversación | Corrección y regresión |
| --- | --- |
| [Bajas e identidad nula](https://github.com/victoryama-wq/seguimiento-academico/pull/1#discussion_r4167261585) | Comparación condicionada a identidad no nula. Cuatro identidades inválidas mantienen incidencia y ninguna baja; tres valores no textuales se rechazan en la frontera. Bajas válidas con/sin fecha conservan auditoría, ambas inscripciones y separación de otra persona. |
| [Límite de celdas CSV](https://github.com/victoryama-wq/seguimiento-academico/pull/1#discussion_r4167261596) | Conteo acumulado por celda antes de almacenarla; rechazo temprano de filas anchas/cortas. Se prueban encabezado estrecho con 1 000 filas de 256 columnas, 200 000 celdas exactas, celda 200 001, EOF, vacíos y texto citado con delimitadores/saltos. Un sufijo truncado demuestra que se falla antes de seguir leyendo filas/celdas inválidas. |
| [Agrupación Moodle](https://github.com/victoryama-wq/seguimiento-academico/pull/1#discussion_r4167261605) | Índice `Map` construido una vez; elimina `parsed.filter` por identidad. Un archivo de 9 999 filas prueba identidades únicas, docentes, faltantes, duplicados, conflictos, conservación de originales y resoluciones auditadas. También prueba docentes duplicados/conflictivos. Sin umbrales de tiempo. |

Antes de corregir código, la suite nueva reprodujo nueve fallos (cuatro de bajas
y cinco de lectura CSV). Después de corregir, las 17 pruebas nuevas y las 151
anteriores pasan. La revisión del algoritmo confirma una sola construcción del
índice Moodle y consultas directas; el caso grande comprueba semántica y
conservación, no pretende establecer una garantía temporal.

Se ejecutaron y aprobaron los seis comandos del contrato sobre esta corrección:
lint, typecheck, 168/168 unidades, build, 11/11 emuladores y 8/8 E2E. También pasó
`git diff --check`. El commit final y la ejecución automática reconocida por el
PR se registran en su informe después de verificarlos. Las conversaciones solo
se resuelven tras comprobar esa evidencia. No cambia el workflow, lockfile, reglas Firebase, UI,
ciclos/épocas/suplementos ni la protección de `main`.
