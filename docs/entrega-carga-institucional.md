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
La evidencia de despliegue y CI se añadirá tras verificar el SHA publicado.
