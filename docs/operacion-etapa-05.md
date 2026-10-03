# Historial y seguimiento

## Calendario y fotografías

En **Historial y seguimiento**, administración propone una primera fecha y de
1 a 20 cortes separados por 21 días civiles. Se crean cortes abiertos con las
versiones administrativas vigentes en el momento de creación, como `createCut`.
Un reenvío conserva los cortes existentes y los ajustes. Revisar estas versiones
antes de comenzar cargas; crear un corte nuevo si deben usarse fuentes distintas.
La lista muestra pendientes según cursos esperados y publicaciones del alcance,
no según una constante de 230. No envía mensajes ni recordatorios.

Las fechas se ajustan con motivo y comparación de la fecha anterior, antes de
aceptar cualquier trabajo. Después de aceptar archivos, una fecha distinta
podría cambiar la aplicación de una baja: se exige cerrar y crear una revisión
atribuible, sin reinterpretar silenciosamente las filas ya procesadas.

Cerrar desde **Ciclos y cortes** genera un objeto privado `closures/{hash}.json`:
versiones de fuentes, calendario, afiliaciones resueltas con originales y
procedencia, catálogo de instancias, reportes publicados, mapeos, selección de
actividades, actor y versión de reglas. Reportes y fuentes referidos conservan
sus originales inmutables. El manifiesto se escribe antes de activar su puntero.
Una transacción vuelve a comprobar la captura y publica el cierre solamente si
no cambió. Publicar un reporte o cambiar actividades lee el mismo documento del
corte: un conflicto aborta o reintenta; no se ensambla una fotografía híbrida.
Un objeto preparado cuya transacción pierde puede quedar privado sin referencia;
no se borra automáticamente ni se considera una publicación.

El panel cerrado lee el manifiesto y las afiliaciones materializadas; no usa el
padrón o catálogo actual. Un corte legado cerrado sin fotografía materializada
no se recalcula automáticamente: requiere conciliación/migración explícita. Esta
etapa no inventa una fotografía antigua ni migra datos privados.

Una corrección usa **Crear corte**, referencia el corte cerrado de origen y un
motivo obligatorio. La revisión registra autor y fecha del sistema, permite
reimportar/confirmar fuentes y reportes para ese corte y se cierra por separado.
No copia notas a una revisión que pudiera tener fuentes o afiliaciones distintas.
Ambas fotografías se conservan y el calendario muestra su relación.

## Comparación

Elegir dos fotografías cerradas distintas del mismo ciclo. Consultar primero la
comparación vigente. Administración registra correspondencias JSON con
`courseId`, `before` y `after`, usando IDs de las actividades seleccionadas que
pueden inspeccionarse en Panel. La API comprueba existencia en ambos cortes y
relación uno a uno; conserva motivo, autor, versión previa y fecha. No admite
cambios de instancia implícitos ni equivalencias automáticas entre ciclos.

La intersección se forma en servidor por matrícula normalizada, instancia y
pareja de actividades aprobada. Devuelve 25 observaciones/cambios por página,
conteos sobre el universo completo autorizado y CSV íntegro (máximo 8 MiB).
Páginas y exportación fijan el ID de correspondencia revisado; las fotografías
cerradas son inmutables. Filtros API reutilizan los de etapa 04; la interfaz de
comparación ofrece matrícula y carrera, además de elegir cortes.

Separar bajas, incorporaciones, cambios de afiliación, actividades sin pareja,
exclusiones y archivos faltantes. “Fuera del universo” no supone baja cuando no
hay evidencia de baja. Una actividad sin pareja se describe como añadida/retirada
**o sin correspondencia**, sin deducir si se renombró. Sin denominador o mapeo,
no comparable. [Ejemplo manual](calculos-etapa-05.md).

## Política de acceso histórico

La autoridad es la membresía **vigente del servidor**, no el rol de la solicitud,
el de la fecha del corte ni el de quien cargó el archivo. Administración tiene
alcance institucional. Un coordinador ve únicamente filas cuya carrera histórica
esté entre sus carreras actualmente autorizadas. Adquirir una carrera habilita su
historial; perderla revoca también consultas, exportaciones, paginación y bitácora
con un token ya emitido. Revocar la membresía completa deniega toda operación.

Para comparar, cada extremo se filtra antes de formar la intersección. Un cambio
de carrera fuera del alcance no expone la carrera de destino ni sus observaciones;
solo puede aparecer ausencia en el universo autorizado. No se conserva un permiso
dentro de la fotografía. Las consultas largas revalidan la membresía al entregar.
Ni siquiera el cliente administrador tiene lectura directa de closures o nuevas
colecciones; las operaciones pasan por Functions. Los originales compartidos
siguen restringidos conforme a etapa 03.

## Bitácora

Se vincula a una **fotografía de consulta inmutable**, incluso en un corte abierto,
para fijar persona/curso/corte y carrera histórica. La creación del caso verifica
transaccionalmente que esa captura sigue vigente. El contexto inicial del caso se
conserva aunque luego cambie el reporte o se cierre el corte. Cada revisión conserva
la referencia de contexto; su acceso exige actualmente alguna de las carreras
históricas de ese caso. Admite observaciones de filas elegibles o excluidas de reporte
(incluidas bajas) pertenecientes al alcance; no atribuye un estudiante a un curso
solo porque aparezca en un padrón general. Consultar primero, luego registrar
observación, responsable, contacto civil opcional, siguiente acción y estado.

Cada guardado crea una revisión inmutable y actualiza el puntero mediante
comparación de revisión anterior. Dos ediciones simultáneas no se sobrescriben:
una obtiene conflicto y debe consultar/revisar. El identificador de reintento es
propio del actor; el mismo ID con contenido distinto se rechaza. La UI conserva
el ID de un intento fallido mientras no cambie su contenido.

La historia se recorre por referencias anteriores, desde la revisión consultada,
en páginas de 25; nuevas ediciones no alteran una página fijada. El CSV conserva
todas las revisiones del punto consultado (máximo 10 000 / 8 MiB). Registro del
sistema en milisegundos UTC, contacto como fecha civil YYYY-MM-DD: nunca se
confunden. El responsable es un dato operativo, no una asignación de permisos.
No hay envío de contactos, calificaciones editables ni automatización de mensajes.

## Límites pendientes

Entorno demo con Auth, Firestore, Storage y Functions reales emulados. Pendientes
de dependencias/bundle, conciliación privada, piloto 45/230, capacidad/costos,
retención/recuperación y validación en nube conservados. Sin despliegue ni etapa 06.
La comparación entre ciclos/instancias diferentes no está habilitada: requiere
una política adicional de correspondencia.
