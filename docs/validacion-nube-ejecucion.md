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

## Capacidad: registro inicial y repetición pendiente

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
alcance ni límites, conservando validación de membresía al responder. Repetición
45 y escalón 230: **pendientes de registrar sobre la versión corregida**.

## Reproducción

Node 22, árbol limpio del commit desplegado, configuración y cuentas en
`private/staging-web.json` y `private/staging-test-accounts.json`, manifest sintético
generado por `npm run prepare:cloud-fixtures`. Nunca usar seed/reset demo en nube.

```powershell
$env:CONFIRM_STAGING_PROJECT='indicadores-academia'
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

## Pendientes y reversión

Aceptación del usuario, piloto privado, presupuesto/retención, App Check y revisión
productiva pendientes. Dependencias y bundle conservan el diagnóstico de fase 2;
sin actualizaciones adicionales ni cambios de umbrales.

Ante incidente, detener cargas y conservar trabajos, objetos y evidencias.
Restaurar Hosting y Functions juntos a un SHA compatible, recompilado en staging.
No usar el antiguo build demo como rollback. La primera release ofrece una
referencia compatible; reversión y restauración completa están documentadas pero
**no ejecutadas**. No borrar ni reescribir cortes cerrados.

## Verificaciones locales de la mejora

`npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:unit`
(232), `npm run test:emulators` (74) y `npm run test:e2e` (40) aprobados.
Se conservaron suites, límites y comprobaciones. Persiste el warning de listeners
ya documentado; no se silenció. Escaneo de 165 archivos públicos sin coincidencias
con identificadores, nombres ni responsables del paquete académico privado.
