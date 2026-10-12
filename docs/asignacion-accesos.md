# Asignación de accesos con catálogo confirmado

En el entorno de pruebas, Administración abre **Configuración → Asignar acceso**:

1. Escribe el correo exacto de una cuenta existente y pulsa **Buscar cuenta**.
   Verifica nombre, correo y estado de Authentication. Si no existe, el sistema
   lo indica; no crea cuentas ni envía invitaciones.
2. Elige el ciclo cuyo catálogo institucional confirmado deseas consultar. Se
   muestran programa, abreviatura, plan y responsable. Sin catálogo, carga y
   confirma primero las fuentes desde Administración → Fuentes.
3. Elige **Coordinador** o **Administrador** y el estado **Acceso activo**.
   Administrador tiene acceso institucional completo; una lista de carreras no
   limita ese rol. No se permite editar el propio acceso.
4. Busca por carrera, abreviatura o responsable; usa el filtro de responsable y
   las casillas. **Seleccionar carreras visibles** añade únicamente los resultados
   del filtro. La relación del catálogo ayuda a elegir; no concede permisos.
5. Revisa los permisos existentes. Los ausentes del catálogo elegido aparecen en
   un apartado separado y permanecen seleccionados. Solo se retiran si se desmarcan
   expresamente. Si no tienen referencia identificable, conserva el permiso hasta
   aclararlo por el procedimiento institucional; no adivines su equivalencia.
6. Pulsa **Revisar cambios de acceso**, verifica cuenta, rol, estado, carreras
   concedidas, retiradas y conservadas. Marca la confirmación y guarda.

Consultar un ciclo **no limita los permisos a ese ciclo ni cambia su vigencia**.
Los permisos mantienen la política existente de alcance actual por carrera, también
para consultas históricas. Cambiar el ciclo conserva los permisos previamente
concedidos y descarta adiciones todavía no confirmadas.

Si cambian la cuenta, sus permisos o la fuente del catálogo, la confirmación se
rechaza: busca la cuenta de nuevo para actualizar la consulta y revisa la selección.
Modificar la propuesta limpia la confirmación. Un reintento de una confirmación
aplicada no vuelve a conceder permisos que después fueron retirados.

## Contrato y verificación

`lookupAccess`, `accessCatalog`, `reviewAccess` y `assignMember` requieren membresía
administrativa vigente del servidor. `assignMember` admite exclusivamente una
revisión del mismo administrador, vigente durante 30 minutos. Comprueba dentro de
una transacción la membresía del actor, los permisos del destinatario y la fuente
confirmada. El servidor consulta Authentication por correo exacto y vuelve a
comprobar la identidad al confirmar. No se crea/modifica ninguna cuenta Auth.

Las carreras nuevas deben existir en el catálogo confirmado; una abreviatura no es
un ID. Los permisos anteriores ausentes pueden conservarse o retirarse, pero no
inventarse. La auditoría conserva antes/después, autor, revisión y versión de
catálogo. Revisiones y UID se utilizan internamente, no se solicitan en la interfaz.
Las fixtures antiguas de pruebas pasan ahora por el mismo protocolo completo.

Regresiones: `tests/emulators/member-access.test.ts`, `tests/e2e/access.spec.ts`.
Se mantienen las suites anteriores, incluidas reglas, importaciones, exclusiones,
versiones y cortes. Ejecutar las seis verificaciones del proyecto antes de entregar.

Prueba de nube reproducible, únicamente con cuentas sintéticas existentes:

```powershell
$env:CONFIRM_STAGING_PROJECT='indicadores-academia'
node scripts/validate-staging-access.mjs
```

Requiere build limpio y Functions/Hosting con el SHA del checkout. Usa el catálogo
sintético confirmado 99-95; si falta o no corresponde a la fixture, se detiene.
No importa fuentes ni reportes. Revisa el acceso de una cuenta sintética, agrega
una carrera sintética y restaura el conjunto original por el procedimiento auditado.
Compara los documentos académicos y membresías anteriores; los informes y capturas
quedan en `private/cloud-runs/`. Los resultados realmente ejecutados, SHA y CI se
registran en el PR. No usar el script con cuentas reales.

La prueba con el coordinador real requiere identidad y carreras verificadas por
Administración. No se asignan permisos a personas reales durante esta validación.
La aceptación del propietario y producción siguen pendientes. Se conservan los
pendientes anteriores de dependencias, bundle, conciliación, capacidad y recuperación.

## Evidencia local del 12 de octubre de 2026

Aprobados lint, tipos, build, 252 pruebas unitarias, 98 de emuladores y 48 E2E.
Después del ajuste visual final se repitieron lint/build y las dos pruebas del
formulario (escritorio/móvil), aprobadas. CI ejecuta todas las suites sobre el SHA
publicado. [Captura sintética escritorio](evidencia/accesos/escritorio-sintetico.png)
y [móvil](evidencia/accesos/movil-sintetico.png).

La prueba del bootstrap detectó carga lenta del SDK antes del rechazo de un entorno
no permitido. El guard se ejecuta ahora antes de importar los SDK privilegiados;
no se ampliaron tiempos ni se omitieron comprobaciones. La herramienta sigue
restringida exclusivamente al emulador demo.
