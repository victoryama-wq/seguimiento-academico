# Fase 2: ejecución real en Firebase de pruebas

Fecha: 2026-10-08 (America/Cancun). PR #5, sin merge ni producción. Actualiza el
estado del [informe de preparación](validacion-nube-fase-2.md). La aceptación del
usuario continúa pendiente.

## Destino e identidad verificados

Proyecto exclusivo `indicadores-academia` (número `31298450248`), Blaze autorizado.
Firestore Standard `(default)`, bucket `indicadores-academia.firebasestorage.app`
y tres Functions en `us-central1`; Auth pertenece al mismo proyecto. Hosting:
<https://indicadores-academia.web.app>. App web:
`1:31298450248:web:e88d6367f6aabb999b797d`.

Primera versión desplegada: `0670d3dbbc00ff5f047fb5edfa9e32bd286029ec`.
Release Hosting `1791502776449000`, versión `fb22de7581417a30`.
Versión vigente desplegada y probada:
`114a60d26321c66f69f1ad118808a6d21867a069`, release Hosting
`1791504151516000`, versión `219b09f09bdd48d6`, publicada
2026-10-09 00:02:31 UTC (8 de octubre local). Las tres Functions informan ese SHA.
El commit posterior del informe no se atribuye a este despliegue.
Disparador `importworker-477668`: Firestore `jobs/{jobId}`, cuenta
`seguimiento-runtime@indicadores-academia.iam.gserviceaccount.com`, destino
Function `importWorker` / servicio Cloud Run `importworker`.

`roles/eventarc.eventReceiver` solo en ese proyecto; `roles/run.invoker` solo en
ese servicio. Políticas existentes preservadas, cero claves de usuario, sin
`allUsers` ni `allAuthenticatedUsers` en el trabajador; llamada anónima HTTP 403.
Hosting HTTP 200 con `nosniff`, `DENY` y `no-referrer` comprobados. Rules e índices
publicados; bucket con prevención de acceso público y base protegida frente a
eliminación. Sin políticas de borrado de fuentes o imágenes.

Antes de crear el disparador, Google devolvía 404 para él y para el servicio.
Se registró la solicitud con su identidad exacta; después se comprobó el recurso
efectivo antes de conceder `run.invoker`. La propagación inicial de IAM produjo
rechazos 403; Eventarc entregó los trabajos mediante reintentos sin habilitar
acceso público. No se cambiaron los roles preexistentes de agentes de Google;
esta comprobación no certifica mínimos privilegios de todo el proyecto.

## Pruebas del primer despliegue

- Smoke completo: 20 comprobaciones aprobadas, administrador/A/B/sin membresía,
  Rules directas, originales privados, curso compartido, principal Virtual C.A.,
  avance sin fecha, U4 diferida, parciales juntos/separados, reintento antiguo,
  revisión vacío/guion, concurrencia, comparación, cierre y exportación.
- Caso manual: inicial N=7, D=7, Z=1, tres personas; A D=5, B D=2. Actualizaciones
  U1/U2/U3 juntas y separadas: N=D=5, diferencia comparable 0 puntos porcentuales.
  Baja excluida. Guion, vacío y cero conservan sus significados.
- Navegador real: escritorio y Pixel 7 aprobados; reapertura tras aceptación de
  carga, revisión de dos pérdidas numéricas, publicación, filtros, CSV, teclado
  y ausencia de desbordamiento horizontal. Evidencia exclusivamente sintética.
- Recuperación: intento 1→2; D=N=1, sin filas parciales ni duplicados; ODS inválido
  rechazado y duplicado bloqueado. Inyección auditada de lease vencido en un job
  nuevo no publicado; no se mató un contenedor ni se restauró un backup.
- Bitácora: reintento idéntico, edición concurrente (un ganador), 26 revisiones,
  páginas 25+1, exportación completa, autor/contacto/registro diferenciados.
  Revocar carrera manteniendo el token niega ID, página y exportación anteriores.
  Revisión atribuible de corte cerrada sin alterar la fotografía original.
- Cierre/publicación/avance simultáneos: ganó avance; las otras propuestas fueron
  rechazadas como obsoletas. Cierre posterior conserva fotografía y referencias
  coherentes; D=N=1 y publicación posterior bloqueada.

Dos errores del verificador se corrigieron sin cambiar el contrato: previsualizar
como coordinador exige `careerId`, y comparar exige cerrar los dos cortes antes
de configurar correspondencias. Los primeros intentos permanecen como fallidos.

## Revalidación de la versión vigente

Se repitieron satisfactoriamente smoke (20 comprobaciones), navegador en escritorio
y móvil, recuperación, bitácora/revocación y cierre concurrente sobre `114a60d`.
En la última carrera ganaron publicación y cambio de avance; el cierre obsoleto
fue rechazado. El cierre posterior conserva ambos cambios y D=N=1, Z=1. Repetir
la publicación ya ganadora devuelve el resultado idempotente, sin alterar el
corte cerrado; una publicación nueva sigue bloqueada.

Dos ajustes adicionales del verificador conservan los controles del producto:
los IDs de petición de bitácora ahora incluyen el corte para no reutilizar una
clave global de una ejecución anterior; la carrera distingue una publicación
nueva de la repetición legítima de la que ganó antes del cierre. Los intentos
anteriores se conservaron como fallidos, sin atribuirles aprobación.

Capturas de esta versión, exclusivamente sintéticas y revisadas visualmente:
[revisión y advertencias en escritorio](evidencias/nube/revision-escritorio-114a60d.png)
y [panel de coordinación en móvil](evidencias/nube/panel-movil-114a60d.png).

## Capacidad: registro inicial y mejora medida

45 cursos, dos cortes, 50 personas únicas, 650 filas por corte, cinco actividades
por reporte, 236.972 bytes/corte, CSV/XLSX/ODS, lotes ≤20, tres cargas concurrentes.
Primer corte completo: D=3.250, N=1.300, G=V=E=Z=650, cobertura 40 %. El segundo
aprobó totales y exportaciones, pero se interrumpió al paginar por `fetch failed`
a los 35 ms. Esa ejecución es **incompleta**, no una aprobación del piloto.

Latencias del cliente, respuestas correctas: recepción p50/p95 378/485 ms (92);
espera de trabajador 1.353/1.474 ms (92); publicación 188/334 ms (90); panel
institucional 3.516/4.649 ms (29), máximo 4.932 ms. La espera incluye cola y
sondeo; no mide exclusivamente CPU del trabajador.

El servidor leía cursos secuencialmente para cada página. Se cambian solo esas
lecturas a lotes ordenados de hasta cuatro cursos. Sin cache global, sin ampliar
alcance ni límites, conservando validación de membresía al responder.

La repetición completa de 45 cursos en `114a60d` terminó satisfactoriamente en
225,719 segundos: dos cortes, todas las páginas, exportaciones de ambos ámbitos,
cierre y comparación. Panel institucional: p50 1.939 ms, p95 2.529 ms, máximo
2.923 ms (54 respuestas correctas). La mediana disminuyó 44,9 % frente a la muestra
inicial; no es un ensayo controlado ni una garantía. La causa del fallo de
transporte inicial no quedó demostrada y no se declara corregida por esta mejora.

El escalón de 230 cursos también terminó **aprobado**, en 2.758,919 segundos
(45 min 58,919 s). Por corte: N=6.440, G=V=E=Z=3.220, D=16.100, cobertura 40 %,
50 estudiantes únicos. Dos cortes, 1.208.712 bytes de reportes por corte,
12 lotes por corte; 129 páginas de detalle por corte, sin pérdidas ni duplicados.
La comparación conservó el universo de 16.100 y diferencia de 0 puntos.

| Operación (cliente, ms) | 45 cursos p50 / p95 | 230 cursos p50 / p95 |
| --- | ---: | ---: |
| Recepción de archivo | 410 / 507 (90) | 387 / 512 (460) |
| Espera hasta revisión, incluye sondeo | 1.384 / 2.539 (90) | 1.356 / 1.543 (460) |
| Publicación | 198 / 272 (90) | 188 / 292 (460) |
| Panel institucional, incluye páginas | 1.939 / 2.529 (54) | 8.486 / 10.578 (260) |

Entre paréntesis, número de respuestas correctas; máximos y demás operaciones
en [evidencia agregada por SHA](evidencias/nube/validacion-114a60d.json). El máximo
institucional de 230 fue 12.072 ms. Con muestras de solo dos exportaciones por rol,
se informa máximo: A/B 2.465/3.546 ms; dos cierres, máximo 2.257 ms. Una comparación
institucional tardó 14.649 ms y su exportación del ámbito A, 4.043 ms. Estos pocos
casos no caracterizan una distribución productiva. Los tiempos totales incluyen
creación de configuración, cargas, esperas, publicaciones y todas las verificaciones.

Los reportes sintéticos pesan entre 520 y 11.359 bytes y contienen cinco actividades.
45 cursos contienen 695 filas (650 estudiantes y 45 docentes); 230 contienen
3.450 filas (3.220 estudiantes y 230 docentes), con 50 personas únicas por escenario.
Cada décimo curso es compartido por las cinco carreras sintéticas. No se están
probando archivos de 8 MiB ni el volumen real completo de la institución.
Tres envíos concurrentes y lotes de 20 respetan los límites existentes.

La paginación institucional reconstruye los datos autorizados en cada solicitud.
La mejora de latencia no elimina ese costo: a 230 cursos se observaron páginas
de aproximadamente 8–10 segundos y un volumen elevado de lecturas. Antes de
preparar producción queda pendiente reducir ese costo mediante resultados
materializados/versionados o una estrategia equivalente, conservando revocación,
alcance y fotografías. No se habilitó cache global ni se relajaron pruebas.

## Consumo observado, no facturación estimada

[Inventario y métricas](evidencias/nube/consumo-114a60d.json), proyecto de pruebas,
ventana solicitada 2026-10-09 00:07:00–01:05:55 UTC. Firestore publicó muestras
hasta 01:03:00: **945.749 lecturas** (29.084 lookup, 2.840 no encontrado,
913.825 query) y **13.499 escrituras** (11.101 create, 2.354 update, 44 noop).
Son contadores observados del proyecto durante smoke, navegador, recuperación,
45/230 y comprobaciones, no atribución exacta a un solo caso ni una factura.
La reconstrucción repetida al paginar explica un riesgo importante de costo;
no se acepta todavía capacidad productiva ni se fija un presupuesto a partir de esto.

Inventario actual del bucket: 1.531 objetos, **30.067.231 bytes**: originales
3.381.924 (700 objetos), derivados 10.017.294 (700), exportaciones 11.377.350 (27),
fotografías de consulta 3.573.873 (85) y cierres 1.716.790 (19). Incluye todos los
intentos conservados, también los previos; no se borraron fuentes. Artifact Registry,
separado del bucket: 143.658.789 bytes y ninguna política de limpieza automática.
La métrica de bytes de Firestore no devolvió series: **no disponible**, no cero.

Memoria Cloud Run: máximo de las medias de muestras, agrupadas por servicio y
sus revisiones dentro de la ventana: API 47,12 %, trabajador 21,74 % y estado
58,63 % del límite asignado. No es el pico instantáneo de RSS ni una medición del
cliente. [Cloud Monitoring](https://docs.cloud.google.com/monitoring/api/metrics_gcp_d_h)
puede publicar con demora; se conservan timestamps, cantidad de muestras y
bandera de truncamiento (false). No se convierten estos valores en importes
monetarios sin conciliarlos con facturación y un escenario operativo aprobado.

## Reproducción

Node 22, árbol limpio, configuración y cuentas en
`private/staging-web.json` y `private/staging-test-accounts.json`, manifest sintético
generado por `npm run prepare:cloud-fixtures`. Nunca usar seed/reset demo en nube.

```powershell
$env:CONFIRM_STAGING_PROJECT='indicadores-academia'
$env:STAGING_RELEASE_SHA='114a60d26321c66f69f1ad118808a6d21867a069'
node scripts/validate-staging.mjs smoke
node scripts/validate-staging-browser.mjs
node scripts/validate-staging-recovery.mjs
node scripts/validate-staging-history.mjs private/cloud-runs/RUN-SMOKE/evidence.json
node scripts/validate-staging-concurrency.mjs
node scripts/validate-staging.mjs 45
node scripts/validate-staging.mjs 230
node scripts/measure-staging.mjs FECHA-INICIAL-UTC
```

Recuperación, comprobación interna de fotografía y métricas usan la sesión Firebase
CLI del operador, sin claves ni tokens persistidos por los scripts. El resto de
operaciones académicas pasa por la API autenticada. Omitidos de Git por privacidad:
configuración web y cuentas; manifest/reportes regenerables desde fixtures
versionados. Cada ejecución conserva su evidencia en `private/`; no elimina fuentes.
Fallos imprevistos detienen el escenario; las denegaciones esperadas se comprueban.

`STAGING_RELEASE_SHA` fija la aplicación realmente desplegada. El verificador
registra por separado su revisión Git y exige que el SHA sea ancestro de HEAD,
que no haya cambios sin commit y que toda diferencia sea exclusivamente de
documentación, pruebas o verificadores cloud enumerados expresamente. Los scripts
de build/despliegue no están permitidos en esa diferencia. Cualquier cambio de aplicación, dependencias,
configuración o Rules bloquea la ejecución contra un backend anterior. Sin esa
variable se exige HEAD exacto. Esto permite publicar el informe después de medir
sin atribuir al despliegue el SHA posterior del informe. El navegador y backend
siguen exigiendo coincidencia exacta de sus versiones.

## Pendientes y reversión

| Aceptación | Evidencia / estado |
| --- | --- |
| Proyecto aislado, identidad Eventarc, trabajador privado | Verificado contra APIs de Google; llamada anónima 403, cero claves de usuario |
| Entrega efectiva de eventos | Trabajos reales en cola → revisión → publicación; reintentos sin duplicados |
| Reglas académicas, avance explícito y cargas parciales | Smoke cloud y regresiones locales aprobados |
| Dos coordinadores, originales y revocación histórica | Accesos permitidos y denegados, incluidas llamadas directas y exportaciones |
| Navegador, recuperación y concurrencia | Aprobados; lease vencido inyectado, sin simular una restauración completa |
| Piloto gradual 45 y 230 cursos | Ambos aprobados en Firebase real, dos cortes por caso; exactitud, aislamiento, paginación, CSV y comparación |
| Capacidad productiva y presupuesto | Pendientes; piloto sintético pequeño por archivo y paginación costosa |
| Restauración completa / reversión | Procedimiento documentado, no ejecutado |
| Decisiones y conciliación privadas | Sin cambios; no se cargaron archivos reales ni se ejecutó piloto privado en nube |
| Aceptación operativa | Pendiente de evaluación del usuario con la guía y las cuentas privadas |

Aceptación del usuario, piloto privado, presupuesto/retención, App Check y revisión
productiva pendientes. Dependencias y bundle conservan el diagnóstico de fase 2;
sin actualizaciones adicionales ni cambios de umbrales.
`npm audit --json` y `npm audit --omit=dev --json` se repitieron al cerrar esta
entrega: 11 paquetes afectados (7 high, 4 moderate); producción, 2 moderate.
Son resultados de la herramienta, no pruebas de explotación de la aplicación.
Se conserva la valoración por dependencia del informe de fase 2; no se ejecutó
`audit fix` ni se modificó el lockfile.

Ante incidente, detener cargas y conservar trabajos, objetos y evidencias.
Restaurar Hosting y Functions juntos a un SHA compatible, recompilado en staging.
No usar el antiguo build demo como rollback. La primera release ofrece una
referencia compatible; reversión y restauración completa están documentadas pero
**no ejecutadas**. No borrar ni reescribir cortes cerrados.

## Verificaciones locales de la mejora

`npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:unit`
(232 sobre la aplicación desplegada; 236 con las regresiones del verificador),
`npm run test:emulators` (74) y `npm run test:e2e` (40) aprobados.
Se conservaron suites, límites y comprobaciones. Persiste el warning de listeners
ya documentado; no se silenció. Escaneo de archivos públicos sin coincidencias
con identificadores, nombres ni responsables del paquete académico privado,
contraseñas sintéticas, configuración privada de acceso ni claves privadas.
