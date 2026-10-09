# Padrón activo y posibles bajas

Decisión institucional del piloto, 2026-10-09. Continúa las decisiones aprobadas;
no sustituye DEC-01–36 ni modifica la conciliación de inscripciones.

## Regla y alcance

Un padrón confirmado, íntegro y fijado en el corte define sus alumnos activos.
El trabajador comprueba ciclo, fuente publicada, autor de confirmación, ausencia
de bloqueos y contenido válido. Una matrícula textual normalizable ausente se
excluye antes de guardar calificaciones académicas, con el motivo
«No pertenece al padrón activo del ciclo». No suma N/G/V/E/Z/D ni estudiantes
medidos. La ausencia de fuente, errores de lectura o una fuente sin confirmar
no habilitan esta regla. Una identidad vacía/no textual, una contradicción de
filas o una afiliación pendiente mantienen su revisión. No se unen nombres.

`Posibles bajas` cuenta matrículas normalizadas únicas por ciclo y corte, agrupa
asignaturas y conserva nombres originales y sus variantes, estado y procedencia.
Es una lista informativa, separada de los indicadores. Una baja confirmada puede
no tener inscripción en el padrón: se registra en `cycleWithdrawals`, con motivo
y referencia, sin inventar una inscripción ni alterar sus conteos. La API de
revisión añade actor real, fecha del sistema, versión anterior y nueva versión.
Requiere Administración y conserva la confirmación/publicación de fuentes.

Una carrera verificada en las inscripciones fijadas permite mostrar una baja
atribuible al coordinador autorizado. Una matrícula ausente sin esa atribución
queda solo para Administración. Compartir curso o cargar el archivo no concede
acceso. El servidor filtra antes de agrupar, contar, paginar y exportar; vuelve
a comprobar los permisos vigentes. El filtro por carrera no incluye casos sin
atribución, tampoco para Administración.

## Versiones y reintentos

Los trabajos conservan la versión del padrón, originales y filas. Las cargas
parciales conservan casos de los reportes anteriores; un mismo alumno en varios
cursos cuenta una vez. Las calificaciones excluidas nunca se reincorporan por
arrastre. Una nueva fuente se aplica mediante actualización auditada de un corte
sin resultados o revisión de corte; el original se revalida explícitamente.
Los derivados existentes y los cortes cerrados no se reclasifican con fuentes
nuevas. `revalidate` identifica la política `active-roster-v1`, para no recuperar
por accidente un resultado procesado antes de esta corrección.

Las actualizaciones visuales de padrón/catálogo conservan las decisiones
individuales de baja del ciclo y las distinguen de las correspondencias generales.
La comparación del catálogo ignora el orden de las claves al serializar una
revisión; conserva la revisión obligatoria cuando cambia un valor original.
Una decisión de baja sin inscripción no aumenta el conteo de inscripciones
excluidas. Las variantes de nombre de cargas previas mantienen su procedencia.
La decisión real solicitada se registra y verifica únicamente en el canal privado.
No se incluye su matrícula ni evidencia en este documento, fixtures o GitHub.

## Recuperar el reporte pendiente

1. Recarga el entorno de pruebas e inicia sesión como administrador.
2. En **Fuentes**, confirma tu padrón, catálogo y matriz aprobada si todavía
   no lo has hecho. Comprueba conteos y observaciones antes de confirmar.
3. En **Padrón utilizado por el corte**, verifica el nombre y conteos. Si apunta
   al padrón sintético, prepara un corte con las fuentes confirmadas y selecciona
   el avance por modalidad. Un corte previo no adopta fuentes nuevas solo por
   recargar la página. Para conservar el mismo corte sin publicaciones existe
   **Actualizar fuentes del corte abierto** en las operaciones avanzadas; exige
   motivo y comprobación de versión. Si tiene resultados, usa revisión de corte.
4. Selecciona el corte, pulsa **Recuperar trabajos del corte** y abre el resultado
   pendiente. En ese mismo corte, **Revalidar con versiones vigentes** conserva
   el original y genera un nuevo trabajo. Para un corte nuevo, selecciona tú el
   archivo original y pulsa **Validar reporte**.
5. Comprueba **Alumnos incluidos**, exclusiones, matrícula, fila original, motivo
   y acción. Las matrículas/principales tienen columnas de ancho legible y la
   tabla se desplaza horizontalmente con teclado. Los códigos quedan en
   **Diagnóstico**. Las notas inválidas conservan su estado; las identidades o
   afiliaciones sin resolver requieren revisión.
6. Marca la confirmación de esa propuesta y pulsa **Confirmar publicación del
   reporte**. El agente no realiza esta carga/publicación por el propietario.
7. En **Panel → Posibles bajas**, consulta el conteo, materias y estado.
   Exportar conserva filtros, permisos y fotografía de versiones. Sin alumnos
   medidos, D=0 y cobertura sin datos; una baja no representa recuperación.

## Evidencia sintética reproducible

`tests/emulators/possible-withdrawals.test.ts` usa dos asignaturas compartidas:
dos alumnos activos con notas 0 y 8 producen **D=2, N=2, Z=1, estudiantes=2**.
Un ausente en ambas asignaturas, un ausente con baja confirmada y una baja del
padrón producen **tres personas** en la lista, sin aumentar D. Para el ausente
filtrado: **D=0, cobertura=null, estudiantes=0**. El coordinador A ve solo la baja
con carrera comprobada; B no ve ninguna; Administración ve las tres. También
comprueba 27 casos con páginas de 25+2 y CSV completo, idempotencia, revisión
concurrente obsoleta y fotografías cerradas.

Pruebas unitarias: agrupación, variantes de nombre, contratos y continuidad al
actualizar fuentes. E2E: revisión, resumen, legibilidad y lista del panel en
escritorio/móvil. `scripts/validate-staging-intake.mjs` ejecuta el flujo real en
Firebase con fuentes sintéticas, dos coordinadores, confirmación individual,
exportación y cierre. Requiere árbol limpio, SHA desplegado comprobado y
`CONFIRM_STAGING_PROJECT=indicadores-academia`; no usa datos del propietario.

Los resultados finales, SHA desplegado y CI se registran en el PR #5. La aceptación
operativa del propietario sigue pendiente. Permanecen separados los pendientes
de dependencias, capacidad/costos de nube, retención y conciliación privada; este
cambio no actualiza dependencias, límites, protecciones ni despliega producción.

Verificación local ejecutada el 2026-10-09: `npm run lint`, `npm run typecheck`,
`npm run build`, `npm run test:unit` (**252**), `npm run test:emulators` (**87**)
y `npm run test:e2e` (**44**, escritorio/móvil): aprobados. Se conservan las
advertencias del logger de emuladores; no se ampliaron límites ni se omitieron
pruebas. La comprobación privada mantiene 2.661 principales, cuatro personas
excluidas, 75 revisiones y cero discrepancias de principales, sin subir fuentes.

Capturas exclusivamente sintéticas de la ejecución local:
[escritorio](evidencias/padron-activo/escritorio-emulado.png) y
[móvil](evidencias/padron-activo/movil-emulado.png). La evidencia de Firebase
se registra por separado para no atribuir estos resultados a la nube.
