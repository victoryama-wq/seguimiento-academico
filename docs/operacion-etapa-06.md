# Operación y preparación de staging

Estado: proyecto Firebase y región **pendientes de creación/decisión**. Esta etapa
no despliega. `firebase.staging.json` es configuración revisable de Hosting,
Functions Node 22, Rules e índices existentes, sin alias a proyecto real.
`config/staging.example.json` enumera decisiones sin secretos.

## Prerrequisitos antes de autorizar staging

1. Identificar un proyecto separado de producción, propietario, región de Firestore,
   bucket y Functions. Las Functions actuales usan `us-central1`; confirmar esa
   región o revisar el cambio explícitamente. No inferir el nombre del bucket:
   el código demo usa `demo-seguimiento-ci.appspot.com`; buckets nuevos pueden
   tener otro sufijo. Elegir residencia institucional antes de crear recursos.
2. Habilitar facturación Blaze, APIs necesarias, Auth correo/contraseña, dominio
   autorizado de staging y registro de app web. Recoger configuración pública
   Firebase en un archivo local ignorado. No introducir claves de servicio ni
   credenciales ADC en GitHub, el chat o el bundle.
3. Cuenta de ejecución dedicada: Firestore/Storage para operaciones de backend y
   permisos de identidad que realmente necesite; separar operador y desplegador.
   Revisar IAM de Functions Gen2, Cloud Run, Eventarc, Artifact Registry, Cloud
   Build, Service Account User y Rules/Hosting para el desplegador. No conceder
   Owner a coordinadores ni usar su rol del navegador como autorización.
4. Acordar admin inicial mediante usuario Auth existente, UID verificado y operación
   privilegiada auditada de bootstrap. El script demo actual rechaza proyectos
   reales: **no quitarle su guardia ni ejecutarlo contra nube**.
5. Aprobar y probar una activación explícita del runtime de nube para el proyecto
   exacto, su bucket y región. El frontend y Functions siguen deliberadamente
   limitados a emuladores; esta configuración no hace operativa la nube. No hay
   fallback por error de conexión. Ese paso depende del destino, requiere revisión
   y pruebas negativas; publicar ahora el bundle demo no produciría staging usable.
6. Validar permisos e índices reales, revocación, subida, triggers y recuperación,
   límites/costos, App Check según política institucional, y smoke de los cinco
   responsables con datos sintéticos. Registrar evidencia aparte de emuladores.

## Procedimiento de publicación, todavía no ejecutado

Con autorización posterior para el proyecto identificado y runtime revisado:
checkout del SHA aprobado; `npm ci`; las seis verificaciones; `npm run test:pilot`;
build para el destino y `npm run verify:hosting`. Revisar inventario de archivos y
hashes. Hosting apunta exclusivamente a `dist`, rechaza archivos adicionales,
directorios ajenos, symlinks, fuentes, exportaciones y claves privadas. Esta
verificación técnica no reemplaza el control de contenido del código fuente.

Ejecutar Firebase CLI con `--project ID_APROBADO --config firebase.staging.json`
y `--only firestore:rules,firestore:indexes,storage,functions,hosting` **solo cuando
exista la autorización**. No hay script de deploy automático ni credenciales CI.
Registrar SHA, versiones de Rules/Functions/Hosting, índices y releases antes/después.
Esperar índices listos y hacer smoke de lectura/escritura, accesos cruzados,
revocación y worker. No activar datos reales por un build o CI exitoso.

El Hosting público contiene interfaz y SDK; originales, manifiestos académicos,
exportaciones y expedientes permanecen en Storage/Firestore privados. Ni el
cargador de un curso compartido puede descargar sus originales completos. Las
exportaciones de coordinadores pasan por Functions y permisos vigentes.

## Operación cada tres semanas

1. Admin verifica catálogo carrera/plan/coordinación y padrón versionados; carga
   suplemento con autor/motivo y bajas/excepciones aprobadas. Resolver identidades
   y afiliación base antes de publicar. No resolver por semejanza de nombres.
2. Alta de coordinador: crear cuenta Auth por canal institucional y asignar servidor
   `coordinator`, `active: true`, carreras explícitas con `assignMember`. Revisar
   acceso con sesión de cada coordinación, incluyendo un curso compartido.
3. Planificar calendario cada 21 días y editar fechas con motivo. Pendientes se
   consultan en calendario/panel; no se envían recordatorios desde la app.
4. Cargar hasta 20 archivos y 40 MiB por lote (8 MiB/archivo). Repetir lotes para
   45/230 cursos. Revisar progreso persistente; cerrar navegador no cancela trabajos
   aceptados. Reabrir sesión y consultar trabajos antes de reenviar.
5. Incidencias estructurales/identidad bloquean. Un valor de calificación inválido
   conserva original y estado y permite revisión/publicación. Resolver nombres
   ambiguos/duplicados solo por admin y registrar motivo/actor/versiones. Confirmar
   cada sustitución revisada; una confirmación no se traslada a otra propuesta.
6. Seleccionar actividades explícitas por curso/corte. Revisar N/G/V/E/Z y D;
   guion no prueba falta de entrega ni retraso docente; cero es numérico. Sin
   datos, cobertura nula. No inventar aprobación ni promedios normalizados.
7. Revisar cargas pendientes, fuentes, selección y afiliaciones antes de cerrar.
   El cierre congela la fotografía coherente. Si hay conflicto concurrente,
   actualizar y revisar; no forzar. Corregir mediante revisión vinculada al original
   con autor y motivo; ambos cortes permanecen consultables.
8. Comparar solamente correspondencias explícitas y universo común. Mantener
   incorporaciones/bajas/cambios separados; una baja no es recuperación.
9. Bitácora: observación, responsable, contacto, próxima acción y estado; fecha
   del contacto distinta del registro. Conflicto de edición exige actualizar;
   no sobreescribir. La bitácora no altera notas ni cierres.
10. Revocar: `assignMember` con carreras actuales o `active: false`; confirmar con
    el mismo token previo que consultas, ID directo, originales y exportaciones
    quedan denegados. Un snapshot histórico no conserva permisos revocados.

## Fallos, reversión y restauración

- Trabajo aceptado: consultar estado. Con lease vencido, `retry` reclama intento
  nuevo; las filas de intentos incompletos no se publican. Hay tres intentos máximos.
  Corregir la causa y revisar antes de crear nueva propuesta si se agotaron; no
  editar punteros ni filas directamente en producción.
- Publicación concurrente: solo una propuesta avanza el puntero. La otra exige
  revisión; ninguna se convierte automáticamente en sustitución autorizada.
- Reversión de interfaz/backend: volver a release/SHA compatible anterior mediante
  revisión y autorización. No borrar nuevas fuentes ni bajar versiones de datos.
  Comprobar compatibilidad de esquema y mantener bloqueadas mutaciones si es incierta.
- Restauración de datos: inventario consistente de Firestore y objetos referenciados,
  hashes y versiones; restaurar primero en destino aislado, validar cierres,
  permisos vigentes y pruebas de exactitud. Reasignar acceso explícitamente; no
  reactivar permisos históricos por restaurar membresías antiguas.
- Conservar evidencia de RPO/RTO observado, faltantes y responsable antes del cambio
  de tráfico. No afirmar que el procedimiento escrito equivale a un ensayo.

En esta entrega solo se ejercitan recuperaciones sintéticas en emuladores y
regresiones de navegador. Reversión de release, restauración completa y validación
de cinco coordinaciones reales en nube permanecen pendientes.

### Catálogo, decisiones y acumulación aprobados

Consultar [el procedimiento actualizado](integracion-decisiones-aprobadas.md) para
importar el paquete privado en emuladores, revisar incidencias, registrar una
corrección, publicar su fuente y volver a validar reportes. No mezclar el paquete
completo con la anexión del suplemento ya integrado. Ninguna etiqueta de responsable
crea una cuenta o permiso. El calendario de Virtual y dos observaciones nuevas de
fecha permanecen pendientes; el paquete real no está autorizado para publicación.
