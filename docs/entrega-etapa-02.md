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
| `npm run test:unit` | **151/151**, cinco archivos; incluye 26 regresiones nuevas del recorrido de fuentes/afiliación/suplemento. |
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
