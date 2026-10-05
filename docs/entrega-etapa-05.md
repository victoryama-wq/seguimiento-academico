# Entrega de etapa 05 · historial y seguimiento

Base: merge `d3718516c4cfca64d97469ee249aeb2ba3f3211c`, verificado como ancestro
de main sincronizado. Árbol inicial limpio. Rama exclusiva:
`etapa-05-historial-y-seguimiento`. SHA final y ejecución automática exacta se
registran en el PR de esta entrega, evitando una referencia circular en el commit.

## Alcance y criterios

| Criterio | Implementación y evidencia |
| --- | --- |
| Calendario | Fechas civiles cada 21 días, ajustes atribuibles previos a carga, pendientes autorizados; sin mensajes. |
| Cierre coherente | Manifiesto privado + afiliaciones materializadas; comprobación transaccional antes de activar el cierre. Carrera entre cierre/publicación/selección probada. |
| Pasado y revisiones | Fuentes, reportes, mapeos, selecciones y originales conservados. Revisión padre/motivo/autor/fecha; legado incompleto no recalculado automáticamente. |
| Comparación | Correspondencia explícita uno a uno por instancia/actividad; intersección de personas autorizadas; N/G/V/E/Z/D y diferencia en puntos porcentuales. |
| Cambios de universo | Bajas, incorporaciones, afiliaciones, actividades sin pareja, exclusiones y falta de archivo fuera del cálculo común. |
| Bitácora | Contexto académico inicial fijo, abiertos/cerrados, autor/registro/contacto separados, cadena inmutable, CAS y reintentos sin duplicados. |
| Permisos | Autoridad vigente de membresías, carreras históricas de filas/casos, acceso cruzado denegado, IDs/cursor/exportaciones comprobados. |
| Interfaz | Español, navegación por teclado, carga/vacío/error, administrador y dos coordinadores en escritorio/móvil. |

[Operación y política histórica](operacion-etapa-05.md),
[cálculo manual](calculos-etapa-05.md), [decisiones](decisiones.md) y
[modelo](modelo-datos.md). Archivos nuevos principales: dominio/contrato history,
Functions history, UI History y fixtures/suites de etapa 05.

## Resultados locales

Windows, Node 22.22.0, Java 21, Firebase demo completo; datos sintéticos.

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Aprobado, sin relajar advertencias. |
| `npm run typecheck` | Aprobado, web y Functions. |
| `npm run build` | Aprobado; advertencia de bundle documentada. |
| `npm run test:unit` | 185 aprobadas / 9 archivos. |
| `npm run test:emulators` | 53 aprobadas / 7 archivos, 152,72 s de Vitest. |
| `npm run test:e2e` | 30 aprobadas en escritorio/móvil, repetición final completa tras revisión visual (4,5 min). |

Los primeros intentos detectaron serialización de propiedades opcionales en la
fotografía, un fixture con columna sin mapear y una aserción de CSV que no usaba
la forma normalizada de matrícula. Se corrigieron y se repitieron las suites;
no se omitieron pruebas ni se relajaron workflow o comprobaciones. El historial
de cada intento queda en logs locales ignorados; CI publica sus propios logs.

Ejemplo: primer universo completo D=7, N=4 y dos personas. La comparación conserva
solo cuatro observaciones comunes de una persona: 50 % → 75 %, **+25 puntos**.
La baja del otro estudiante y la actividad nueva no contribuyen a esa diferencia.
Coordinación B recibe “no comparable” y su propia trazabilidad, sin datos de A.

## Evidencia visual y CI

Capturas sintéticas de escritorio y móvil se adjuntan en
`docs/evidencias/etapa-05/`: comparación administrativa, bitácora de coordinación A
y ausencia de universo comparable en coordinación B. El PR enlaza la ejecución
automática `pull_request`, SHA exacto y check `ci` (quality + integration).
Una ejecución manual no sustituye esa evidencia.

## Limitaciones conservadas

- Sin expedientes privados ni conciliación real. Sin piloto 45/230, tiempos/costos
  medidos en nube, usuarios reales, política de retención/recuperación aprobada.
- Guardas de emuladores demo activas: no se declara validación de producción.
- 14 alertas históricas de dependencias pendientes de remediación revisada; sin
  cambios de paquetes/lockfile ni audit fix. Bundle y aviso de SDK Storage siguen
  en [informe de dependencias y bundle](dependencias-y-bundle.md).
- Correspondencias entre ciclos o instancias distintas no se presuponen. Las
  fechas con trabajos aceptados requieren una revisión; las versiones de fuentes
  de cortes planificados quedan fijadas al crearlos y deben revisarse antes de carga.
- Procesamiento/agregación en servidor acotados, sin ensayo de capacidad a escala.
  La creación de un objeto preparado que pierde una carrera de cierre puede dejar
  un objeto privado sin puntero; no se borra sin política de retención.
- Sin merge, despliegue, cambio de protecciones, recordatorios ni etapa 06.

## Correcciones de revisión del PR #4

Base comprobada: `7454698f09de5b6ee212ab306a0f62f072d2d932`, árbol limpio.
Se conserva la rama y el mismo PR; sin cambios de dependencias, reglas, workflow
o protecciones. El SHA final y enlace al CI automático se registran en el PR.

1. **Conversación de actividad**: selector por instancia y extremo, obtenido
   exclusivamente de correspondencias aprobadas. `activity` identifica el corte
   anterior; A→A2 y A→A pueden coexistir en cursos distintos. Se aplica antes de
   conteos y estado de registro. Sin pareja, no comparable. API y CSV comprueban
   alcance de ambos coordinadores y rechazan filtros de carrera/curso ajenos.
2. **Conversación de baja solo en padrón**: exclusión general (`courseId: null`)
   reconocida por matrícula autorizada sin fila Moodle posterior. Se conserva
   procedencia versión/fila y D común vacío; sin evidencia se mantiene ausencia
   del universo. No se convierten bajas en recuperación ni se incluyen sus notas.
3. **Hallazgo adicional: ausencia de correspondencias**: contrato de tres estados
   (omitido/vigente, nulo/ausencia fijada, ID/versión fijada). Paginación y CSV
   conservan el estado consultado. Dos sesiones E2E demuestran que crear el primer
   mapeo no cambia la consulta anterior hasta usar Actualizar correspondencias.
   Se conserva la regresión de versiones no nulas revisadas posteriormente.

Evidencia reproducible: `tests/unit/history.test.ts`,
`tests/emulators/history-review.test.ts`, `history-pagination.test.ts` y
`tests/e2e/history.spec.ts`. Cálculos y operación actualizados sin nuevas reglas
académicas. Las conversaciones solo se resuelven tras verificar las correcciones.

Verificación local de esta revisión (Windows / Node 22.22.0 / Java 21):

| Comando | Resultado de la revisión |
| --- | --- |
| `npm run lint` | Aprobado, cero advertencias. |
| `npm run typecheck` | Aprobado, web y Functions. |
| `npm run build` | Aprobado; principal 811 984 bytes, aviso de bundle conservado. |
| `npm run test:unit` | 191 aprobadas, 9 archivos. |
| `npm run test:emulators` | 59 aprobadas, 8 archivos; 188,51 s de Vitest. |
| `npm run test:e2e` | 32 aprobadas, escritorio/móvil; repetición completa en 6,1 min. |

La primera ejecución unitaria agotó el tiempo de arranque de un proceso Node en
una prueba existente; la repetición completa pasó sin cambios a sus límites. En
emuladores, una nueva aserción esperaba un número HTTP en el mensaje del helper;
se corrigió para comprobar `PERMISSION_DENIED` y pasó la suite completa. No se
suprimieron casos ni se relajaron comprobaciones. Persiste el aviso del SDK
Storage ya documentado en dependencias y bundle.

La primera ejecución E2E obtuvo 31/32: un caso previo del panel agotó sus 5 s
tras recargar mientras seguía calculando. La repetición completa obtuvo 32/32,
sin modificar esa prueba, sus límites ni configuración. Los ocho casos E2E de
historial (cuatro en cada dispositivo) pasaron en ambas ejecuciones.

Se conservan las capturas de la entrega inicial y se añaden seis de esta revisión
en [evidencia de revisión](evidencias/etapa-05/revision-pr4/README.md). Solo datos
sintéticos: filtro A, ausencia de mapeo fijada y baja solo en padrón. CI exacto y
respuestas a ambas conversaciones quedan enlazados en el PR, una vez comprobados.
