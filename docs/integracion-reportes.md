# Integración de reportes por afiliación principal

Ampliación del PR #5 sobre `3e2a0694581b0e75822ebfbdb82a3d4ff9f91d1c`.
Sin merge, despliegue ni conexión de datos privados a Firebase.

**Actualización 2026-10-08:** para los cortes nuevos, el [avance explícito](avance-explicito.md)
sustituye la política de fechas descrita abajo. Este documento conserva la evidencia
y los cálculos de la implementación anterior, que continúan aplicando a sus versiones.

## Contrato y operación

El perfil `moodle-institutional-v1` reconoce los encabezados de los cuatro libros
privados ODS inspeccionados y sus equivalentes sintéticos CSV/XLSX. Conserva el
encabezado exacto como etiqueta y procedencia. Detecta Tarea, Foro, Examen y
Cuestionario; Unidad/Sesión numerada identifica la unidad y cierre/final la 7.
Encabezados desconocidos, unidades contradictorias o duplicados exigen revisión;
no se inventa una equivalencia por semejanza. Totales y subtotales se rechazan
incluso si un mapeo manual intenta clasificarlos como actividades.

Ejemplo sintético de nombre: `777._Curso_Multimodal_27-1 Calificaciones.ods`.
`Muestra 2 - 777...` conserva el prefijo separado. `2 777...` es ambiguo y
necesita resolución administrativa auditada. El número, el ciclo y, bajo la nueva
política, el nombre normalizado deben coincidir con la instancia seleccionada.
El nombre original nunca se sustituye. Los cuatro nombres privados cumplen el
formato; esto no acredita que su número sea el identificador interno de Moodle.

La matrícula enlaza la fila a la principal conciliada. La relación estable incluye
la instancia interna y el ciclo; permanece idéntica entre versiones y cortes.
Carrera, coordinación autorizada, grupo, modalidad y turno provienen de esa principal.
Si es especial C.A., se utiliza. Grupo de impartición e inscripción específica se
presentan expresamente como no determinados. No requieren selección del coordinador.
Los permisos se comprueban en servidor; cargar un curso compartido no concede acceso
a las otras carreras. Se mantienen exclusiones por baja y por ciclo.

La nueva configuración del paquete declara la primera semana vencida y los bloques
por modalidad. El ejemplo usa el domingo 2026-09-06 para el inicio del 31 de agosto;
es una referencia configurable que debe confirmarse al preparar el calendario operativo.
En Escolarizado, `schoolCut` (1–3) fija el bloque acumulado de la fotografía y
permanece igual si se ajusta la fecha. Es obligatorio al crear un corte con la
nueva política, incluso si reúne modalidades. El planificador escolarizado asigna
1, 2 y 3; para un lote semanal el administrador indica el bloque escolarizado que
lo acompaña, y crea otro lote cuando cambia de bloque. En Ejecutivo y Virtual,
la fecha de corte determina las semanas vencidas. Las unidades futuras
se conservan sin contarse todavía. Virtual es independiente. Versiones antiguas sin
esta política conservan su selección explícita y su configuración histórica.

Al confirmar una publicación se guarda también su selección de actividades, con actor,
motivo, versión y referencia a la selección anterior. Las adicionales solo cuentan con
nota numérica (cero incluido). Cargas parciales conservan filas y columnas ausentes;
notas presentes actualizan el estado, incluido un vacío explícito. Un encabezado
renombrado requiere revisión, no una unión por similitud. Para migrar versiones con
IDs manuales o sin etiquetas auditadas se conserva su mapeo explícito; el cambio al
perfil automático se rechaza si perdería esa correspondencia.

Resultados/exportación de fuentes incluyen las notas conservadas y su versión de
celda. El CSV del panel incluye únicamente el universo medido, los mismos filtros,
unidades previstas, selección y denominadores de pantalla. No confundir ambos CSV.
Cerrar congela fuentes, selecciones y reportes; corregir requiere revisión atribuible.

## Cálculos sintéticos inspeccionables

Fixture: `tests/fixtures/synthetic/report-tracking.ts`. Tres personas elegibles:
Escolarizado y Ejecutivo en una carrera; Virtual con principal C.A. en otra.
Una baja y una exclusión de ciclo tienen notas 10, pero no aportan denominadores.
Los totales de curso 999 tampoco aportan valores.

Primera versión, semana 3 y ordinal Escolarizado 1:

| Persona sintética | Unidad 1 | Unidad 3 | Adicional | Valores medidos |
| --- | --- | --- | --- | --- |
| Escolarizado | 0 | guion (futura) | vacío | 0 |
| Ejecutivo | guion | 7 | 0 | guion, 7, 0 |
| Virtual C.A. | vacío | inválida | guion | vacío, inválida |

Total **N=3, G=1, V=1, E=1, Z=2, D=6**, tres personas, cobertura 50 %.
Primera coordinación D=4, N=3; segunda D=2, N=0. Los adicionales no numéricos
se conservan en resultados pero no se cuentan como actividades medidas.

La segunda carga contiene solo Escolarizado: unidad 2=8, unidad 1=vacío explícito,
adicional=0. Conserva su unidad 3 y las otras personas. Resultado:
**N=4, G=1, V=2, E=1, Z=2, D=8**, cobertura 50 %.

Tras cierre, un corte de semana 5 y ordinal Escolarizado 2 arrastra esa fotografía y recibe solo unidad 3=9
de Escolarizado. Resultado: **N=5, G=1, V=2, E=1, Z=2, D=9**, cobertura 55,56 %.
El corte cerrado sigue D=8. Repetir archivos conserva IDs; el identificador de
relación no cambia entre los tres estados. No se atribuye recuperación a exclusiones.

Regresión de flexibilidad: ordinal Escolarizado 2 con fecha anterior a la primera
semana vencida conserva unidades 1–5 para esa modalidad. Ejecutivo/Virtual todavía
no incluyen unidades; el adicional numérico permanece válido. Resultado D=3, N=2,
G=1, Z=2. Editar la fecha antes de la carga conserva el ordinal; omitirlo al crear
un corte con la nueva política se rechaza. Los cortes anteriores no se migran:
para adoptar la política se prepara un corte nuevo o una revisión con ordinal explícito.

## Conciliación privada

El nuevo paquete se guarda exclusivamente en `private/approved-package-reportes.json`.
La comparación estructural contra DEC-35/36 verifica que **solo cambia schedule**:
originales, decisiones, principal corregida, fechas individuales y catálogo intactos.
Controles reejecutados: **2.873 inscripciones, 2.665 personas, 2.661 principales,
cuatro personas excluidas, 75 revisiones, cero pendientes y cero discrepancias**.

Los cuatro libros producen respectivamente 22, 22, 21 y 14 actividades reconocidas;
no quedan filas sin atribución ni exclusión justificada. La conciliación local recorre
parser y afiliaciones; no equivale a publicación ni validación en nube. Los informes
por fila, hashes, nombres y fuentes permanecen privados. La fecha operativa inicial,
el piloto institucional y la aceptación del corte real aún requieren verificación.

Reproducción local privada después de `npm run build`:

```text
node scripts/prepare-approved-package.mjs private/approved-package-reportes-manifest.json
node scripts/reconcile-approved-pilot.mjs private/approved-package-reportes.json private/reportes-pilot-manifest.json
```

Los manifests, paquete y fuentes reales no se adjuntan al PR. Son necesarios solo
para repetir la conciliación privada; ninguna de las suites públicas depende de ellos.
La reproducción sintética utiliza los fixtures versionados y los seis scripts raíz.

## Verificación y pendientes

Verificación local del código final (Node 22.22.0, Java 21, Windows; emuladores
aislados de `demo-seguimiento-ci`):

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Aprobado |
| `npm run typecheck` | Aprobado |
| `npm run build` | Aprobado, con advertencia de bundle |
| `npm run test:unit` | 219 aprobadas, 14 archivos |
| `npm run test:emulators` | 70 aprobadas, 10 archivos |
| `npm run test:e2e` | 36 aprobadas, escritorio y móvil |
| `npm run verify:hosting` | Cinco archivos públicos del build |
| `npm run test:pilot` | Dos casos aprobados: 45 y 230 cursos |

El piloto final completó ambos escenarios en 288,42 segundos de suite local,
conservando sus aserciones de exactitud, aislamiento, reintentos y publicación.
Se trata de una repetición en emuladores, no de una garantía de capacidad en nube.

La ejecución inicial de las nuevas pruebas de API pedía el resumen y esperaba
filas de la sección de detalle; se corrigió esa consulta. El primer E2E buscaba
un ID técnico como texto de checkbox después de cambiar la etiqueta al encabezado
original; se corrigió el selector y se repitió toda la suite. La última repetición
incluye el ordinal Escolarizado y no tiene fallos. No se modificaron timeouts.

Capturas sintéticas de la coordinación A (D=4, N=3, dos personas; no exponen la
principal Virtual de la otra coordinación), tomadas de la ejecución aprobada:
[escritorio](evidencias/etapa-06/reportes-principal-escritorio-sintetico.png) y
[móvil](evidencias/etapa-06/reportes-principal-movil-sintetico.png).

El SHA final y la ejecución automática reconocida por el PR se consignan en el
informe del PR, para no crear una referencia circular dentro del propio commit.
Las pruebas nuevas cubren formato real con datos sintéticos, modalidades compartidas,
principal C.A., parciales/reintentos, cambios de nota, adicionales, cero/vacío/ausencia,
totales, desconocidos, permisos cruzados, exportación y conservación de corte cerrado.
Las regresiones de DEC-01–36 y revisiones obsoletas continúan obligatorias.

Permanecen separados los pendientes documentados de dependencias, bundle, piloto
institucional, costos/retención y validación de Firebase real. No se actualizaron
dependencias ni límites de carga; no se alteraron workflow ni protecciones.

Bundle final: `dist/assets/index-Dd2IXbOc.js`, **821.068 bytes** minificados,
**245,43 kB gzip** según Vite. Supera el aviso de 500 kB: puede aumentar descarga,
parseo y ejecución inicial en redes o dispositivos lentos. No se elevó el umbral
ni se atribuye esta medición a rendimiento en nube. Continúa el diagnóstico previo
de 16 paquetes afectados (12 altos, cuatro moderados); sin cambios de dependencias.
