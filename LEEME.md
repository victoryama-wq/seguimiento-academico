# Paquete de trabajo para Codex · Seguimiento académico

Versión inicial · 1 de octubre de 2026

Este paquete contiene instrucciones de implementación, reglas académicas, prompts por etapa y un workflow de integración continua (CI). No contiene una aplicación implementada ni un despliegue activo. El workflow requiere que Codex cree los scripts y el código indicados en el primer prompt; todavía no se ha ejecutado en GitHub.

## Cómo comenzar

1. Elegir un repositorio para esta aplicación y conectarlo a Codex. Si ya contiene código, Codex debe inspeccionarlo antes de adaptar este paquete.
2. Copiar el contenido de esta carpeta a la raíz del repositorio, incluyendo `.github`. Integrar los archivos existentes, sin sobrescribir sus instrucciones indiscriminadamente. El workflow debe incorporarse junto con la implementación de la etapa 01, para que existan sus comandos.
3. Dar a Codex `prompts/01-inicio.txt`. Pedir una sola etapa por tarea y un PR por entrega; no pegar todos los prompts a la vez.
4. Compartir aquí la URL del PR para revisar código, pruebas y reglas del negocio. Un resumen de Codex o una captura no bastan para confirmar la implementación.
5. Corregir los hallazgos, verificar el último commit y continuar con la siguiente etapa después de integrar la anterior.

## Contenido

| Archivo | Uso |
| --- | --- |
| `AGENTS.md` | Instrucciones permanentes de implementación y revisión para Codex. |
| `docs/requisitos.md` | Reglas, indicadores, permisos y decisiones pendientes. |
| `docs/ci-y-revision.md` | Contrato de CI, revisión de PR y configuración de GitHub. |
| `prompts/01-inicio.txt` a `06-piloto.txt` | Implementación gradual con criterios de aceptación. |
| `prompts/07-corregir.txt` | Corrección de hallazgos de una revisión. |
| `prompts/08-revisar.txt` | Solicitud de revisión independiente de un PR. |
| `.github/workflows/ci.yml` | Verificación automática propuesta, sin despliegue. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Evidencias que debe incluir cada entrega. |

## Responsabilidades

- Usuario: confirma reglas académicas pendientes, elige repositorio y proyecto Firebase y acepta las entregas.
- Codex: implementa cada etapa, ejecuta pruebas y entrega un PR con evidencia.
- Revisión en esta conversación: inspecciona el PR y los resultados de CI, contrasta cálculos y acceso a datos con los requisitos, y devuelve hallazgos y el siguiente prompt.
- GitHub Actions: ejecuta comprobaciones deterministas en cada PR. Su resultado no sustituye la revisión funcional.

No se ha configurado vigilancia automática de PR desde esta conversación. Compartir la URL activa una revisión aquí. Codex permite solicitar una revisión adicional en GitHub con `@codex review` cuando la integración y los permisos estén configurados.

## Datos para pruebas

Los archivos reales de calificaciones, padrón, carreras y suplemento se facilitan a Codex por un canal privado autorizado cuando se prepare la importación. No están incluidos en este paquete y Codex no debe asumir que los archivos de este chat aparecen automáticamente en su entorno.

Las pruebas de CI usarán datos sintéticos. No subir expedientes, matrículas, correos, nombres o credenciales reales al repositorio, al bundle del sitio ni a artefactos de Actions. Las excepciones individuales aprobadas se cargarán como datos administrativos auditados, no como constantes del código.

## Base tecnológica

React + TypeScript para la interfaz; Firebase Authentication, Firestore, Cloud Storage y Functions para acceso y procesamiento compartido; Firebase Hosting para publicación. Usar emuladores durante desarrollo. Confirmar versiones compatibles al iniciar y fijarlas en el lockfile. Sin proyecto Firebase todavía se puede completar y revisar el trabajo local con emuladores.

No se incluyen claves, usuarios de producción, permisos abiertos ni estimaciones de almacenamiento sin mediciones. El despliegue se prepara al final; necesita el proyecto de destino y su configuración. La primera meta es un piloto verificable con los archivos disponibles.

## Referencias oficiales consultadas

- Instrucciones de Codex: https://developers.openai.com/codex/guides/agents-md/
- Revisión en GitHub: https://developers.openai.com/codex/integrations/github/
- CI para Node.js: https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs
- Emuladores Firebase: https://firebase.google.com/docs/emulator-suite/install_and_configure
- Entorno Functions: https://firebase.google.com/docs/functions/manage-functions
