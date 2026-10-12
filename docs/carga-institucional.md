# Carga institucional desde originales

Recorrido permanente para administración. Entorno de validación:
<https://indicadores-academia.web.app>, exclusivamente `indicadores-academia`.
La publicación productiva y la aceptación del propietario siguen pendientes.

## Antes de comenzar

Acceder con la cuenta administradora entregada por el canal privado. Comprobar
«ENTORNO DE PRUEBAS» y la verificación de proyecto/versión. No introducir claves,
tokens o JSON en la aplicación. Las cuentas de coordinadores y sus permisos se
administran por separado: el nombre de una coordinadora en el catálogo **no crea
una cuenta ni concede acceso**.

Los verificadores técnicos solo usan datos sintéticos. El propietario selecciona
y confirma sus archivos académicos personalmente; el agente no los sube. Los
originales se conservan privados al seleccionarlos, pero todavía no son fuentes
publicadas ni afectan los indicadores. No compartir capturas reales en GitHub.

## Primera carga

1. Abrir **Fuentes → Cargar archivos y preparar el seguimiento**.
2. **Seleccionar padrón original**: elegir el CSV, XLSX u ODS. Revisar las filas
   originales. El ciclo se obtiene de los grupos; si hay varios, elegir el ciclo
   de seguimiento. El sistema no altera el ciclo de origen de cada inscripción.
3. **Seleccionar catálogo original**: elegir el libro de coordinadoras y carreras.
   Se reconocen programa, plan, abreviatura, responsable/coordinadora y campus
   cuando están disponibles. Si un dato es ambiguo, abrir **Revisar columnas
   reconocidas y formato** y elegir la columna en la lista. En libros con varias
   hojas, seleccionar la hoja de datos. No recapturar las filas.
4. Para incorporar las decisiones institucionales que aún están fuera del sistema,
   abrir **Incorporar la matriz de decisiones ya aprobadas** y seleccionar la matriz
   aprobada que incluye DEC-35 y DEC-36. Debe acompañarse de las versiones exactas
   de padrón y catálogo que fueron conciliadas. El adaptador comprueba sus hashes,
   filas y decisiones. No modificar los originales para hacerlos coincidir.
5. Pulsar **Revisar alumnos, carreras y decisiones**. Revisar cantidades, alumnos,
   principales, exclusiones, catálogo, responsables, coordinación y procedencia.
   Las páginas siguientes permiten consultar el resto de las filas.
6. Resolver únicamente observaciones nuevas. Las correspondencias de programa y
   plan son generales del ciclo; una clasificación base/C.A., baja o excepción de
   fecha es individual. Una matriz anterior no puede restaurar decisiones antiguas
   sin mostrar el conflicto y pedir una decisión con motivo. El responsable no se
   convierte automáticamente en coordinación cuando solo se declara responsable.
7. Volver a validar después de una resolución. Marcar **Revisé esta propuesta…**
   y **Confirmar padrón y catálogo**. Una propuesta con pendientes bloqueantes no
   se publica. Otra publicación concurrente obliga a revisar de nuevo.

## Corte y reportes Moodle

1. En **Corte y avance por modalidad**, preparar un nuevo corte de las fuentes
   confirmadas. Elegir Escolarizado 1/2/3 (U1–2/U1–5/U1–7), Ejecutivo U1–7 y
   Virtual U1–7. El avance se guarda una vez y no depende de fechas operativas.
   Para cargas posteriores seleccionar ese mismo corte abierto.
2. Seleccionar los reportes Moodle originales. Se aceptan CSV, XLSX y ODS, hasta
   8 MiB por archivo y 20 archivos/40 MiB por selección. Para más, usar otra carga.
   No es obligatorio incluir todas las asignaturas ni todas las unidades.
   Antes de cargarlos, comprobar **Padrón fijado en este corte**: nombre de la
   fuente, inscripciones y principales. Los cortes del piloto pueden contener
   únicamente personas sintéticas. Si acabas de confirmar tu padrón y catálogo,
   elige **Preparar un nuevo corte** para utilizarlos; los cortes anteriores no
   adoptan silenciosamente fuentes nuevas.
3. Revisar el número inicial, nombre de asignatura y ciclo reconocidos. Se distingue
   el prefijo de orden de las muestras del identificador del curso. Si la
   identificación es inequívoca, no hay que registrar el curso ni escribir su ID
   interno. Si es ambigua o contradice un curso existente, resolverla antes de seguir.
4. Revisar las actividades reconocidas. Solo las columnas ambiguas requieren
   selección visual. Totales/subtotales no son actividades; la matrícula/correo
   identifica a la persona, nunca su nombre. Los mapeos confirmados se reutilizan
   por encabezado exacto, asignatura y ciclo, conservando las columnas ausentes.
5. Los reportes inequívocos se validan automáticamente al seleccionarlos. Si hubo
   que resolver columnas o identificación, pulsar **Validar reporte**. Esperar la
   validación y abrir **Revisar resultado**. El
   trabajo y original sobreviven al cierre del navegador; **Recuperar trabajos del
   corte** permite continuar. Se ven el cruce por matrícula, grupo y modalidad
   principal, exclusiones, notas, estados y observaciones. La impartición específica
   permanece «no determinada», sin exigir asignar una inscripción al curso.
6. Revisar actividades nuevas, notas cambiadas, valores iguales y ausentes
   conservados. Prestar atención a sustituciones de números por vacío o guion.
   Marcar la confirmación del reporte concreto y publicar. Abrir otro reporte o
   cambiar una propuesta limpia la confirmación.
7. Consultar el panel con ese corte. Las unidades posteriores se conservan fuera
   del denominador hasta avanzar. Cero es numérico; guion, vacío, inválido y columna
   ausente conservan sus significados distintos. Una baja sigue excluida.
8. El cierre y las correcciones de cortes se realizan mediante el procedimiento
   auditado existente. Una nueva fuente no recalcula los cortes anteriores.

## Actualizar solo un archivo o recuperar una revisión

En Fuentes, pulsar **Recuperar revisiones guardadas → Abrir revisión**. Se recuperan
los originales y el mapeo de la propuesta, sin reescribir datos. Para actualizar
solo padrón o catálogo, conservar el otro original y seleccionar el nuevo archivo.
Una fuente confirmada reutiliza sus decisiones; no exige adjuntar la matriz otra
vez. Si una decisión deja de coincidir con un original, se muestra la inscripción
anterior y las candidatas de la misma persona. Confirmar la continuidad con motivo
o conservar esa decisión únicamente en el historial anterior. No se enlaza una
decisión con otra persona ni se descarta silenciosamente una revisión.

Si aparece «las fuentes cambiaron», recuperar la revisión vigente y repetir la
validación. No confirmar una propuesta obsoleta. Un corte ya creado mantiene sus
fuentes fijadas; para usar nuevas fuentes, preparar un nuevo corte o una corrección
auditada. Las herramientas de diagnóstico anteriores permanecen en un apartado
avanzado y no son necesarias para este recorrido.

## Aceptación del propietario

Registrar por canal privado si fue posible completar los pasos, las observaciones
que requieren decisión institucional y si cantidades/grupos/exclusiones coinciden.
La prueba técnica sintética y la conciliación local no sustituyen esta aceptación.
No publicar matrículas, nombres, correos, originales o capturas reales.

## Reportes anchos y filas de formato

La vista original permite desplazamiento horizontal, también con las flechas del
teclado cuando la tabla tiene el foco. No comprime las actividades a una letra por
línea. Conserva los valores y números de fila originales; muestra 25 registros por
página. Una fila totalmente vacía no representa un alumno: se informa cuántas se
omitieron del procesamiento, sin modificar el archivo privado. Cero, guion, error
o fórmula en una fila sin identidad siguen exigiendo revisión.

Si aparece **ninguna matrícula coincide**, comprobar la columna de matrícula/correo
y el padrón indicado en el paso 3. Primero confirmar las fuentes institucionales y
después preparar un corte que las use. No seleccionar uno de los cortes sintéticos
para cargar reportes reales. Si solo algunas matrículas no coinciden, revisar esas
incidencias; no se hacen uniones por nombre ni se inventa una carrera o rol docente.
