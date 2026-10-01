# Entrega de etapa 01

Fecha civil: 2026-10-01, America/Cancun. Alcance: `prompts/01-inicio.txt` únicamente.

## Cambio revisable

La carpeta de instrucciones ahora contiene una base ejecutable: React/TypeScript,
navegación en español, estados vacíos/carga/error, contratos iniciales Zod, Functions
compilables y configuración exclusiva de emuladores. Se conservan las reglas
académicas del paquete. No se procesaron expedientes reales ni se implementó etapa 02.

El modelo de datos distingue personas e inscripciones, versiones de fuentes, cursos,
cortes/publicaciones, incidencias, membresías y bitácora. Es diseño para persistencia
posterior; no se declara transaccionalidad o autorización operativa implementada.

## Comprobaciones locales

Entorno utilizado: Windows, Node 22.22.0, Java Temurin 21.0.12.1, Chromium de
Playwright 1.63.0. Node y Java portátiles fuera del repositorio, sin reemplazar la
instalación global. Dependencias exactas en lockfile raíz, workspace Functions.

| Comando | Resultado observado |
| --- | --- |
| `npm ci` desde clon limpio | Aprobado con npm 10.9.4; 944 paquetes instalados, sin cambios al lockfile. |
| `npm run lint` | Aprobado, sin advertencias. |
| `npm run typecheck` | Aprobado, web/dominio/tests y Functions. También ejecutado dentro de build. |
| `npm run test:unit` | 21 pruebas aprobadas en 2 archivos. |
| `npm run build` | Web y Functions compiladas. Advertencia de bundle web >500 kB, sin ocultarla. |
| `npm run test:emulators` | 11 pruebas aprobadas: Auth, Firestore, Storage y Functions reales emulados. |
| `npm run test:e2e` | 8 pruebas aprobadas: cuatro escenarios en escritorio y móvil Chromium. |
| Inspección de capturas | Panel vacío legible en escritorio/móvil, sin desbordamiento horizontal. |

Capturas sin expedientes: [escritorio](capturas/panel-escritorio.png) y
[móvil](capturas/panel-movil.png).

Verificación de clon limpio completada sobre `d6d679d915765ad6748a9852222dd332f795f86b`:
`npm ci`, `lint`, `typecheck`, `test:unit`, `build`, `test:emulators` y `test:e2e`,
todos con salida 0. Las suites de emuladores se ejecutaron secuencialmente y
terminaron sus procesos. `git status --short` del clon quedó vacío. El código,
configuración y lockfile verificados no se modificaron al añadir esta evidencia y
las capturas al commit final. Es verificación local en Windows; CI Linux pendiente.

El log íntegro local se conserva en `verification-etapa01.log` (ignorado en Git).
`npm ci` emitió un aviso no bloqueante de limpieza EPERM de una dependencia
transitiva en Windows; la instalación y todas las comprobaciones terminaron con
salida 0. No se omitieron suites ni se admitió cero pruebas.

Las primeras ejecuciones detectaron dos errores corregidos antes de esta entrega:
tipado Promise de UploadTask en la prueba de Storage y una declaración CSS inválida.
El arranque inicial detectó ADC local y una dependencia Admin no declarada: el
ejecutor ahora aísla la configuración y Functions declara el SDK requerido por el
emulador. La función no usa Admin ni ofrece acceso a expedientes.

Los casos de permisos de etapa 01 prueban denegación anónima y autenticada (incluido
un claim administrativo). El caso permitido es el diagnóstico técnico sin datos.
Esto no reemplaza los casos permitidos/denegados por coordinación de etapas futuras.

## Dependencias y limitaciones

- `npm audit` reportó 14 alertas transitivas: 10 altas y 4 moderadas, tras actualizar
  dependencias compatibles. Cadenas: gRPC/Firestore, OpenTelemetry/PubSub,
  basic-ftp/proxy-agent y uuid/gaxios. No se aplicó `audit fix --force`, que propone
  degradaciones mayores de Firebase. La revisión/remediación sigue pendiente.
- El bundle inicial incluye los SDK Firebase y supera la recomendación de 500 kB;
  no se ha medido rendimiento en dispositivos reales ni con 45/230 cursos.
- Datos exclusivamente sintéticos; no se reconciliaron archivos privados.
- No hay UI de login, roles operativos, parsers, importación, indicadores, gestión
  de cortes, publicación, historial, bitácora ni exportación. Las secciones explican
  su estado pendiente. No se implementaron migraciones ni se modificaron datos.
- Firebase nube, recuperación, retención, costos y smoke del propietario pendientes.
- CI está incorporado pero no ejecutado remotamente. No hay repositorio remoto,
  PR, protección de ramas ni proyecto Firebase de destino configurado.

## Git y preparación de PR

Rama local: `etapa-01-inicio`. No existía historial Git previo. El commit de entrega
se obtiene con `git rev-parse HEAD`; esta referencia evita un SHA autorreferente.
PR: pendiente de que el usuario elija/conecte el repositorio remoto. No se creó un
remoto arbitrario, no hubo push, merge ni despliegue.

Título sugerido: **Etapa 01: base local de seguimiento académico y CI con emuladores**.
Este documento sirve de resumen para el PR; contrastar con código y ejecución del
check `ci` en el último commit una vez conectado GitHub. Configurar protección de
rama solo después del primer CI remoto exitoso, conforme a `docs/ci-y-revision.md`.
