# Corrección de lectura y presentación Moodle — 2026-10-09

Continuación del PR #5, sobre `7e56901efe42bad196485e8b9129c9a35b1005e7`.
El SHA final, despliegue y CI comprobados se registran en la
[entrega del PR](https://github.com/victoryama-wq/seguimiento-academico/pull/5).

## Diagnóstico y cambio

La previsualización repartía todo el ancho disponible entre muchas columnas y
permitía partir cada palabra: con 32 columnas los textos se veían verticales.
Ahora cada columna conserva un ancho legible; el desplazamiento es interno a la
tabla, accesible por teclado y sin desbordar el documento en móvil.

Un libro puede incluir un rango de 999 filas aunque casi todas solo tengan formato.
La lectura sigue verificando los límites sobre el rango físico completo. La vista
y el parser Moodle omiten únicamente filas sin contenido en ninguna celda; no
inventan identidades faltantes para ellas. Se conservan el archivo privado y los
números de fila originales. Cero, false, guion, errores y fórmulas (incluso si su
resultado es vacío) impiden tratar una fila como vacía. Las notas de una persona
identificada siguen distinguiendo vacío, guion y cero.

El cruce se realiza contra las fuentes fijadas en el corte, que pueden ser las del
piloto sintético, aunque se hayan seleccionado otros originales en pantalla.
Administración ahora ve nombre del padrón, inscripciones, personas con principal
y aviso de fuentes más recientes. Un cruce vacío explica cómo revisar la columna,
confirmar las fuentes y preparar otro corte. No sustituye fuentes ni clasifica
filas como docentes por semejanza o por ausencia en el padrón.

## Regresiones reproducibles

- Fixture sintético de 32 columnas y 999 filas físicas: cuatro registros y 995
  vacías. CSV/XLSX/ODS conservan cero, actividades, totales y procedencia; las
  vacías no crean incidencias ni registros. Las filas con contenido sin identidad
  mantienen su incidencia, incluidas fórmulas y errores.
- API: previsualización de cuatro filas, trabajo listo y publicación; resumen
  del padrón fijado, conservación de una versión anterior y denegación a ambos
  coordinadores. El cruce vacío da una acción comprensible.
- E2E escritorio/móvil: ancho mínimo de celdas, altura de fila razonable, scroll
  horizontal mediante teclado y documento sin desbordamiento. Se conserva el
  recorrido de originales a publicación y sus pruebas anteriores.
- Nube: `scripts/validate-staging-intake.mjs` usa el mismo tamaño de estructura
  sintética y comprueba publicación, denominadores, aislamiento y cierre. Su
  resultado para el SHA desplegado se informa separadamente en el PR.

El diagnóstico privado fue de solo lectura y sin subir el reporte real. Sus
conteos y discrepancias se guardan únicamente en `private/`; las capturas reales
aportadas por el usuario no se publican. La comprobación local de la conciliación
mantiene 2.661 principales, cuatro personas excluidas, 75 revisiones y cero
discrepancias de principales. Los archivos del propietario siguen pendientes de
su carga, revisión y confirmación personal.

## Cómo continuar la prueba

Validación local ejecutada: `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run test:unit` (**248**), `npm run test:emulators` (**79**) y
`npm run test:e2e` (**44**) aprobados. Capturas sintéticas de emuladores:
[escritorio](evidencias/moodle-filas-vacias/escritorio-emulado.png) y
[móvil](evidencias/moodle-filas-vacias/movil-emulado.png). No son capturas de datos
reales ni evidencia de nube; esta se registra por separado en el PR.

1. Recargar el sitio de pruebas con **Ctrl+F5** y abrir **Fuentes**.
2. Seleccionar padrón, catálogo y, en la primera incorporación, la matriz aprobada.
   Revisar y confirmar. Una previsualización por sí sola no publica las fuentes.
3. Elegir **Preparar un nuevo corte**, configurar el avance y comprobar **Padrón
   fijado en este corte**. No usar un corte sintético para los alumnos reales.
4. Seleccionar nuevamente el reporte Moodle; desplazar la tabla para ver todas
   las columnas. Revisar incidencias y confirmar solo la propuesta correcta.

Se conservan decisiones académicas, originales, cortes cerrados, permisos y los
pendientes de dependencias/capacidad/producción. No se alteran los pilotos ni se
actualizan dependencias, límites o protecciones. Guía completa:
[carga institucional](carga-institucional.md).
