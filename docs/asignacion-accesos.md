# Usuarios y accesos con catálogo confirmado

## Directorio y alta de usuario

Administración abre **Configuración → Usuarios y accesos**. El directorio incluye
cuentas sin membresía académica, permite buscar por nombre/correo y pagina desde
Authentication en servidor (hasta 15 cuentas por página). El filtro se aplica en
servidor a cada página; si no hay coincidencias pero aparece **Siguiente página**,
continúa la consulta. No se descarga todo el directorio al navegador. Se distinguen
cuenta deshabilitada, acceso inactivo y acceso sin asignar. Administrador se muestra
con alcance institucional. **Gestionar** abre la identidad y los permisos existentes.

**Nuevo usuario → Datos y carreras → Revisar alta → Confirmar alta** solicita nombre,
correo, rol (Coordinador por defecto) y carreras del catálogo confirmado. Revisa el
correo antes de confirmar. No se pide ni muestra contraseña. Si el correo existe,
se abre la cuenta existente sin sustituir identidad ni asignar permisos desde el alta.

La cuenta se crea sin contraseña. Tras asignar permisos se solicita a Firebase un
correo de restablecimiento de contraseña para que el destinatario establezca la suya.
Es el mecanismo [oficial de Firebase](https://firebase.google.com/docs/auth/web/manage-users#send_a_password_reset_email),
con enlace de un solo uso administrado por Firebase. La interfaz distingue cuenta
creada, permisos asignados y solicitud aceptada por Firebase; no afirma recepción.
No se guardan enlaces ni contraseñas en auditorías. En nube, los correos sintéticos
`@example.invalid` quedan expresamente sin envío. El emulador comprueba la solicitud
sin correo externo y oculta sus enlaces OOB de stdout/CI.

Si se interrumpe un alta, **Recuperar alta pendiente** conserva la propuesta del
navegador. También aparece **Recuperar alta de…** en el directorio para procesos
creados por el administrador actual, incluso en otro navegador. Si la revisión
vence o cambia el catálogo, la cuenta creada se conserva sin añadir permisos:
ábrela con **Gestionar**, revisa nuevamente y después recupera la activación.
Los reintentos nunca vuelven a conceder permisos retirados. Una solicitud incierta
de activación puede reintentarse expresamente después de un minuto; Firebase puede
haber aceptado el primer correo aunque su respuesta se haya perdido.

### Alta de un coordinador real durante la aceptación

1. Obtén su correo institucional verificado y confirma con Administración la lista
   completa de carreras; no deduzcas que las observadas antes sean todas.
2. Búscalo en el directorio. Si existe, pulsa **Gestionar**; si no, **Nuevo usuario**
   y captura su nombre y el correo verificado.
3. Consulta el ciclo institucional confirmado y filtra por su responsable.
   Revisa las carreras, planes y correcciones de carreras.xlsx. La coincidencia del
   nombre ayuda a seleccionar, pero no autoriza por sí misma ni sustituye la revisión.
4. Elige Coordinador, selecciona las carreras confirmadas, revisa el resumen y confirma.
   Solo esta confirmación concede acceso. Si se creó la cuenta, solicita al usuario
   comprobar el correo y establecer su contraseña sin compartirla.
5. Comprueba con él el ámbito visible. Su aceptación operativa sigue pendiente.

Las pruebas automáticas no crean su cuenta, no inventan su correo ni le envían mensajes.

## Edición de permisos existentes

En el entorno de pruebas, Administración abre **Configuración → Usuarios y accesos → Asignar acceso**:

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
comprobar la identidad al confirmar. La edición no crea/modifica cuentas Auth;
el alta es una operación separada revisada explícitamente.

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


## Permiso de ejecución y validación de nube

En indicadores-academia, el propietario autorizó el rol personalizado
`projects/indicadores-academia/roles/seguimientoUserCreator`, con exclusivamente
`firebaseauth.users.create`, para la cuenta de ejecución dedicada. Se conservan
los roles previos; no se conceden actualización ni eliminación de cuentas, ni se
crean claves. Este permiso no autoriza el uso desde coordinaciones: el servidor
sigue comprobando Administración vigente en todas las operaciones.

La preparación carga la configuración pública Auth del proyecto verificado en
Functions; no usa proveedores de correo externos ni almacena enlaces de activación.
Referencia: [permisos oficiales de Authentication](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaseauth).

`CONFIRM_STAGING_PROJECT=indicadores-academia node scripts/validate-staging-users.mjs`
verifica el SHA exacto, crea solamente una cuenta sintética nueva, prueba el directorio,
la asignación revisada y los rechazos a coordinadores, y compara los documentos
académicos/membresías preexistentes. Requiere el catálogo sintético confirmado 99-95;
no lo reemplaza ni importa datos. Conserva la cuenta sintética y su auditoría.
Los resultados realmente ejecutados y el SHA se registran en el PR. La entrega de
un correo real y la aceptación del propietario quedan pendientes de su prueba.

## Verificación de Usuarios y accesos — 12 de octubre de 2026

Lint, tipos, build y 253 unitarias aprobados; suite completa de emuladores: 104;
E2E completo: 50. Tras el ajuste menor del formulario de alta se repitieron las seis
regresiones de directorio/alta y los dos E2E de escritorio/móvil, aprobados. El CI
vuelve a ejecutar las suites completas sobre el SHA final, además del piloto existente.

Las regresiones cubren paginación, cuentas sin permisos, deshabilitadas, ámbito
institucional, selección múltiple, correo existente/concurrente, recuperación de
creación parcial, activación incierta, catálogo obsoleto, reintentos sin reponer
permisos y denegación a coordinadores. Se mantienen las 98 pruebas de emuladores y
48 E2E anteriores. No hay omisiones ni aumento de timeouts. Un primer arranque local
de Functions agotó su tiempo de inicialización antes de descubrir funciones;
la repetición completa, sin compilaciones simultáneas, pasó con los límites existentes.

Capturas exclusivamente sintéticas: [escritorio](evidencia/usuarios/escritorio-sintetico.png)
y [móvil](evidencia/usuarios/movil-sintetico.png). La guía personalizada del coordinador
real permanece únicamente en `private/guia-alta-leonardo.md`; el PR no publica nombres
ni correos del catálogo real. Entrega de correo real y aceptación operativa pendientes.
