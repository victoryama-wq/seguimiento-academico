# Seguimiento académico · etapa 01

Base local en español con React, TypeScript estricto y Firebase Emulator Suite.
No contiene expedientes ni indicadores calculados. La pantalla inicial presenta
estados reales de conexión y el trabajo académico pendiente de configuración.

## Requisitos y arranque

- Node **22.12 o posterior de la rama 22**, npm incluido con Node y Java **21**.
- Internet durante `npm ci`, instalación de Chromium y primera descarga de los
  emuladores. No se necesita cuenta Firebase, proyecto real ni credenciales.
- Puertos locales disponibles: Auth 9099, Firestore 8080, Storage 9199, Functions
  5001 y hub 4400. Vite usa 5173 en desarrollo y 4173 en E2E.

```sh
npm ci
npm run build
npx --no-install playwright install chromium
npm run emulators
```

En otra terminal, desde esta misma carpeta:

```sh
npm run dev
```

Abrir la dirección que indica Vite. `.env.example` documenta los valores por defecto;
no es necesario copiarla. Con los emuladores apagados se muestra un error recuperable.
Los procesos de desarrollo se detienen con Ctrl+C. No se exportan datos del emulador
y cada ejecución de pruebas inicia un entorno limpio.

## Verificación

```sh
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:emulators
npm run test:e2e
```

Ejecutar los dos últimos comandos **secuencialmente**, con `npm run emulators`
detenido. Cada uno inicia y termina Auth, Firestore, Storage y Functions mediante
`firebase emulators:exec --project demo-seguimiento-ci`. No admite puertos ocupados,
proyectos reales ni configuración parcial. En Linux CI Playwright usa
`npx --no-install playwright install --with-deps chromium`.

El workflow incluido ejecuta instalación limpia, lint, tipos, unidades, build,
permisos/Functions y Chromium; el check agregador `ci` exige ambos jobs. No despliega.
Un workflow presente no equivale a una ejecución remota exitosa; ver evidencia local
y pendientes en `docs/entrega-etapa-01.md`.

## Estructura

| Ruta | Responsabilidad |
| --- | --- |
| `src/domain` | Contratos iniciales en Zod; tipos derivados sin convertir identidades. |
| `src/importing` | Frontera reservada para parsers; todavía no acepta archivos. |
| `src/infrastructure` | Configuración validada y conexión explícita de los cuatro SDK a emuladores. |
| `src/ui` | Panel, navegación, estados vacíos/carga/error y diseño adaptable. |
| `functions/src` | Diagnóstico técnico compilable, sin acceso a datos. |
| `tests/unit` | Esquemas, fechas civiles y rechazo de configuraciones inseguras. |
| `tests/emulators` | Reglas reales, sesión Auth emulada y contrato de Functions. |
| `tests/e2e` | Chromium de escritorio/móvil, conexión, navegación, error y teclado. |
| `tests/fixtures/synthetic` | Datos ficticios y marcados; nunca fuentes privadas. |

## Acceso y entorno

Toda lectura/escritura cliente en Firestore y Storage está denegada, incluso con
sesión o claims. Esto es el cierre inicial de etapa 01, **no una implementación de
roles operativos**. La sesión sintética de integración se crea en Auth emulado y
no desbloquea expedientes. Solo el diagnóstico sin datos permite una llamada anónima.

La aplicación rechaza `VITE_FIREBASE_MODE` diferente de `emulator` y proyectos que
no empiezan por `demo-`. Los ejecutores de pruebas fijan `demo-seguimiento-ci` y
comprueban los puertos/configuración antes de arrancar. Las pruebas de integración
validan las variables de entorno antes de sembrar. No existe fallback a nube.
El ejecutor usa un perfil temporal de Firebase CLI, elimina tokens heredados y
bloquea credenciales ADC locales para que no se reutilice la sesión del equipo.

La futura nube requerirá configuración, identidades, membresías, autorización
servidor y reglas verificadas, proyecto de destino y autorización de publicación.
`firebase.json` describe Hosting únicamente como configuración de base: no contiene
comandos automáticos de despliegue ni credenciales.

Guardar archivos privados fuera del repositorio o en `private/` / `local-data/`
(ignorados). También se ignoran `.env`, credenciales habituales, exportaciones,
libros, logs y artefactos de pruebas. Los fixtures sintéticos están expresamente
permitidos. `.gitignore` no sustituye revisar el diff antes de publicar.

## Alcance pendiente

- Etapa 02: parsers ODS/XLSX/CSV, normalización de identidad/grupos, resolución de
  afiliaciones, cálculo de métricas y pruebas completas de reglas académicas.
- Autenticación de usuarios en interfaz, membresías, administración y autorización
  por coordinación; importación real, persistencia, publicación e idempotencia.
- Gestión de ciclos/cortes, selecciones, historial, filtros, bitácora y exportación.
- Reconciliación con archivos privados, excepciones y bajas autorizadas.
- Prueba de carga 45/230 cursos, costos, retención, recuperación y nube real.
- Remoto GitHub, PR, CI remoto, protección de rama y proyecto Firebase de destino.

Las pantallas de navegación explican lo pendiente; no contienen formularios de
gestión simulados. El esquema y el diseño no prueban por sí solos inmutabilidad,
relaciones ni aislamiento por coordinación: esas operaciones no existen todavía.

Ver `docs/requisitos.md`, `docs/modelo-datos.md` y `docs/decisiones.md` antes de ampliar.

Compatibilidad consultada: [Vite](https://vite.dev/guide/),
[Emulator Suite](https://firebase.google.com/docs/emulator-suite/install_and_configure),
[Functions local](https://firebase.google.com/docs/functions/local-emulator).
Las versiones exactas están en los manifiestos y el lockfile raíz.
