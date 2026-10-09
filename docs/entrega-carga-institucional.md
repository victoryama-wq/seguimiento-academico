# Recorrido institucional desde originales — 2026-10-09

Implementación permanente en el PR #5, sobre `903172f0eafeffe96638740f74ac4295a1be08f3`.
No cambia DEC-01–36, las reglas de calificaciones ni los permisos de coordinadores.
Guía del propietario: [pasos de carga](carga-institucional.md).

## Alcance

- Padrón CSV/XLSX/ODS y catálogo original: reconocimiento de encabezados, selección
  visual de hoja/columnas, muestras paginadas, catálogo/responsables, principales,
  exclusiones e incidencias. Propuestas recuperables y confirmación explícita.
- Matriz aprobada opcional en la primera incorporación, con comprobación de fuentes.
  Las siguientes cargas reutilizan decisiones del ciclo; originales cambiados,
  conflictos con una matriz antigua y excepciones requieren revisión con motivo.
  Correspondencias generales y excepciones individuales permanecen separadas.
- Corte con avance explícito por modalidad, guardado una vez. Identificación y
  registro automático de cursos inequívocos; reportes parciales y lotes con errores
  conservan los archivos válidos. Previsualización de cruces y cambios de notas.
- Originales privados, propuestas y publicaciones versionadas, protección contra
  revisiones obsoletas, reintentos idempotentes y conservación de cortes cerrados.

## Verificación local realmente ejecutada

| Comando | Resultado |
| --- | --- |
| `npm run lint` | aprobado |
| `npm run typecheck` | aprobado |
| `npm run build` | aprobado |
| `npm run test:unit` | 245 aprobadas |
| `npm run test:emulators` | 78 aprobadas |
| `npm run test:e2e` | 44 aprobadas, escritorio y móvil |

Se añadieron nueve pruebas unitarias, cuatro de emuladores y cuatro ejecuciones E2E.
Incluyen ambigüedad visual, matriz antigua, continuidad de decisiones, principal C.A.,
permisos, publicación concurrente, sustitución de un número por vacío y cortes cerrados.
Los controles anteriores se conservan en diagnóstico; sus pruebas abren ese apartado.
No se omitieron suites ni se ampliaron tiempos para ocultar fallos.

La comprobación privada, exclusivamente local y sin subir originales, conserva
2.873 inscripciones, 2.661 afiliaciones principales, cuatro personas excluidas,
75 revisiones resueltas y cero discrepancias de principales. No sustituye la
confirmación personal de los archivos en la interfaz.

## Rendimiento y pendientes

La carga inicial sigue en 224.676 bytes JavaScript; el asistente administrativo se
carga bajo demanda. No cambia el lockfile ni se actualizan dependencias: permanece
el diagnóstico previo de 11 paquetes alertados, dos moderados en producción.
Se mantienen los pilotos de 45/230 cursos, las mediciones anteriores de nube y su
limitación de latencia institucional; esta entrega no promete capacidad productiva.

La aceptación del propietario y la publicación productiva permanecen pendientes.
El verificador `scripts/validate-staging-intake.mjs` usa exclusivamente fuentes y
cuentas sintéticas, API pública y navegador; no carga archivos académicos privados.
## Validación en Firebase de pruebas

Aplicación desplegada: **`ddbcadb2e6cdb76a967cb155e3599eafcae684d8`**.
URL: <https://indicadores-academia.web.app>. Solo proyecto `indicadores-academia`,
región `us-central1`, Hosting, Authentication, Firestore, Storage y Functions.
Las tres Functions están ACTIVE con ese SHA. Hosting publicó la versión
`2999e23b7a02aba6` el 2026-10-09 a las 17:06:24 UTC. El trabajador continúa privado:
llamada anónima 403, sin claves de usuario ni cambios IAM en esta entrega.

El verificador ejecutó **12 comprobaciones aprobadas**, del 17:06:41 al 17:07:54 UTC,
en escritorio y móvil. [Resultado íntegro sintético](evidencias/carga-institucional/nube.json).
No son tiempos de capacidad productiva. Se verificaron:

- CSV de cuatro inscripciones, catálogo XLSX de dos carreras y reporte Moodle ODS
  desde la interfaz; reutilización de fuentes/columnas confirmadas en el ciclo.
- Un archivo inválido en el lote no impide revisar/publicar el válido. La indicación
  para volver a exportar es visible; el mensaje del parser queda en Diagnóstico.
- Eventarc procesa efectivamente el reporte. Tres estudiantes medidos, principal
  C.A. incluido y una baja fuera del denominador. Curso compartido: Escolarizado
  U1–2, Ejecutivo U1–3 y Virtual U1–2; U4 conservada y fuera de los conteos.
- Resultado manual inicial **D=4, N=3, G=1, V=0, E=0, Z=1**, cobertura 75 %.
  Sustituir el cero de U1 por vacío da **D=4, N=2, G=1, V=1, E=0, Z=0**, cobertura
  50 %. Las columnas y personas ausentes se conservan; la revisión advierte una
  sustitución numérica antes de publicar.
- Coordinadores A/B: D=3 y D=1 respectivamente; consultas y CSV ajenos denegados;
  fuentes administrativas privadas denegadas. No se conceden permisos a partir
  del nombre de la coordinadora en un archivo.
- Recuperación de trabajos al recargar navegador, reenvío sin duplicados y una
  publicación antigua que no revierte notas; cierre conserva indicadores y rechaza
  nuevas cargas. Esta prueba no simula caída de contenedor ni restaura un respaldo.

Capturas exclusivamente sintéticas: [escritorio](evidencias/carga-institucional/escritorio-sintetico.png)
y [móvil](evidencias/carga-institucional/movil-sintetico.png).

Reproducción, con Node 22 y las cuentas sintéticas locales ya autorizadas:

```powershell
$env:CONFIRM_STAGING_PROJECT='indicadores-academia'
$env:STAGING_RELEASE_SHA='ddbcadb2e6cdb76a967cb155e3599eafcae684d8'
node scripts/validate-staging-intake.mjs
```

Requiere árbol limpio, credenciales en los archivos privados documentados y backend
con el SHA exacto. No ejecutar con archivos reales ni reutilizar ciclos privados.
Los ciclos 99-91/99-92 y las cuentas sintéticas están reservados a este verificador;
conserva versiones y no elimina las fuentes anteriores.

El [primer CI de esta implementación](https://github.com/victoryama-wq/seguimiento-academico/actions/runs/37962086215)
aprobó calidad, integración, 44 E2E y ambos pilotos de 45/230 cursos en emuladores.
El CI automático del último commit de entrega se comprueba en los
[checks del PR #5](https://github.com/victoryama-wq/seguimiento-academico/pull/5/checks).
La evidencia posterior al despliegue tiene un SHA Git distinto: no se atribuye ese
commit documental al código desplegado. No hubo merge ni despliegue productivo.

Para revertir en pruebas, detener nuevas publicaciones y reconstruir/desplegar
Hosting y Functions juntos desde la versión anterior compatible `3f2b2c9a1dcc157cb60685909394230aad79be6c`,
con destino explícito `indicadores-academia`. Conservar originales, trabajos y cortes;
no restaurar fuentes por sobrescritura. Procedimiento documentado, **no ejecutado**.
