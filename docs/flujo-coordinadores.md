# Reportes para coordinaciones

Recorrido: **seleccionar corte → subir archivos → revisar → confirmar → consultar resultados**.
El entorno de pruebas es `indicadores-academia`; la aceptación del propietario y la
publicación en producción siguen pendientes. No es necesario dividir un reporte
compartido por carreras ni registrar manualmente la asignatura.

## Prueba del propietario con un coordinador autorizado

1. Administración comprueba por un canal privado la identidad de su cuenta y las
   carreras que debe tener autorizadas. Esta entrega no crea su cuenta ni modifica
   sus permisos. Si no dispone de acceso, detener esta parte hasta verificarlo.
2. Entrar en <https://indicadores-academia.web.app> con la cuenta autorizada y abrir
   **Fuentes**. Seleccionar el corte por nombre, ciclo y estado. El avance por
   Escolarizado, Ejecutivo y Virtual aparece en lectura; solo Administración lo
   configura. La elección se conserva durante la sesión y entre cargas.
3. Seleccionar los reportes originales CSV/XLSX/ODS: hasta 20 archivos y 40 MiB por
   lote, 8 MiB por archivo. El servidor reconoce número, asignatura y ciclo y cruza
   por matrícula con las fuentes fijadas. Los archivos válidos continúan aunque
   otro falle. Reintentar o validar únicamente el archivo afectado.
4. Si los encabezados requieren elección, abrir **Revisar columnas reconocidas y
   formato**. Elegir hoja, fila de encabezados, separador o columna de identidad.
   Las ambigüedades institucionales de curso o actividad se dejan pendientes para
   Administración, con el original conservado. No escribir JSON ni inventar datos.
5. Abrir **Revisar** en el trabajo listo. Comprobar incluidos, exclusiones visibles,
   matrícula, fila, principal de seguimiento, actividades y cambios. Un cero es
   calificación; vacío y guion conservan sus estados. La sustitución de una nota
   numérica por vacío/guion se destaca. Impartición específica sigue no determinada.
6. Marcar la confirmación de esa propuesta y pulsar **Confirmar publicación**. Si
   otro usuario publicó después de la revisión, recuperar/revalidar y volver a
   revisar; nunca forzar la versión anterior. Cambiar de propuesta limpia la marca.
7. Pulsar **Consultar resultados de este corte**. Revisar filtros, posibles bajas
   y **Exportar alcance filtrado**. Solo deben aparecer personas atribuibles a las
   carreras autorizadas. Una persona sin atribución verificable queda para
   Administración, aunque aparezca en el mismo archivo.
8. Volver a Fuentes o cerrar y abrir la sesión: **Recuperar trabajos** consulta los
   trabajos persistentes del corte. Revalidar conserva el original y genera una
   propuesta para revisión cuando cambian fuentes/versiones; no publica por sí solo.

## Qué verificar antes de aceptar

- Primera carga de una asignatura sin carga administrativa previa.
- Archivo compartido: cada coordinación revisa/publica únicamente su ámbito. Los
  datos ya publicados por otra coordinación permanecen idénticos.
- Actualizar unidades anteriores conserva alumnos/columnas ausentes y el avance.
- Unidad posterior guardada fuera de los indicadores; totales no son actividades.
- Padrón activo, bajas y exclusiones conservadas; conteos/exportaciones autorizados.
- Corte cerrado consultable, sin permitir nuevas cargas o modificación silenciosa.
- Administración conserva su recorrido de padrón, catálogo, decisiones y cortes.

Los originales reales, decisiones individuales y capturas del propietario permanecen
privados. Las pruebas automáticas utilizan exclusivamente datos y cuentas sintéticas
y no recuperan ni publican los reportes reales pendientes del propietario.

## Diseño y límites

La membresía vigente del servidor determina el ámbito inmutable de cada propuesta.
Una versión compuesta conserva filas publicadas de otros ámbitos sin modificarlas;
el puntero del curso cambia atómicamente. Dos publicaciones concurrentes no se
combinan por orden de llegada: la segunda debe revalidarse contra la versión vigente.
La clave de reintento incluye ámbito, fuentes y contenido; no vuelve a aplicar un
trabajo publicado antiguo. La revisión lleva una huella de versión y permisos.

Las propuestas anteriores sin ámbito pueden consultarse según permisos, pero un
coordinador debe revalidarlas antes de publicar. Administración mantiene su capacidad
institucional. Los originales compartidos no se entregan a coordinadores: sus vistas
de filas y derivados se filtran en servidor. Los casos retenidos se revisan en
Administración, sin convertirlos en permisos por compartir archivo.

Se conservan los pendientes de dependencias, conciliación privada, capacidad a
escala en nube, retención/restauración y aceptación operativa documentados previamente.
