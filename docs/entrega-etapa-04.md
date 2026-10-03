# Entrega de etapa 04 · panel e indicadores

Base: `f998a2d502fa0fc86101b48bc66d782bd9486f98`, sincronizada con origin/main.
Árbol inicial limpio. Rama exclusiva `etapa-04-panel-e-indicadores`.
El SHA final y el CI automático reconocido se consignan en el PR de esta entrega.
No se fusiona, despliega ni implementa etapa 05.

## Implementación

- Panel real desde versiones publicadas; ninguna cifra se sirve desde mocks.
- Selección persistente por curso/corte y versión de reporte. Solo administración
  puede aprobar el universo compartido y la asignación explícita de docentes.
  Historial inmutable con motivo, actor de sesión y revisión anterior; CAS e
  idempotencia. Nuevo reporte exige nueva selección. Corte cerrado rechaza cambios.
- N/G/V/E/Z/D, porcentajes sobre denominadores sumados y matrículas únicas
  normalizadas sin perder sus originales. Cero sigue dentro de N; D=0 nunca es 0 %.
- Vistas institucional, coordinación, carrera, grupo base, modalidad, turno,
  asignatura, estudiante, docente y actividad. Filtros del mismo alcance,
  detalle contextual, incidencias, especiales y exclusiones con procedencia.
- El estado de registro del estudiante se calcula sobre todos sus cursos en el
  alcance filtrado. Las filas de varios docentes conocidos se superponen y no
  se suman para obtener el total institucional.
- Servidor calcula agregados, consulta filas por carrera en páginas de 200 y
  devuelve páginas de 25. Fotografía privada de punteros y selecciones capturada
  transaccionalmente; un cambio posterior no mezcla versiones entre páginas/CSV.
  El manifiesto está en Storage privado; Firestore conserva solo su índice de
  autorización, evitando un documento gigante de mapeos.
- Exportación privada con filtros, universo, corte, versiones, definiciones,
  denominadores, filas y trazabilidad. Neutralización de fórmulas. Cada petición
  comprueba membresía; fotografía de otra cuenta o de alcance revocado se deniega.
- El cierre fija también el catálogo de cursos esperados, evitando cambios de
  conteos por cursos creados después. Los cierres previos de etapa 03 sin catálogo
  congelado conservan sus datos y se identifican como limitación histórica.

## Evidencia

[Cálculo manual](calculos-etapa-04.md), fixtures `stage04.ts`, regresiones unitarias,
integración `metrics.test.ts` y `metrics-pagination.test.ts`, E2E `metrics.spec.ts`.
Las capturas sintéticas están en [evidencias/etapa-04](evidencias/etapa-04/README.md).
Ningún archivo real es necesario para reproducirlas.

Verificación local, 2026-10-03: Node 22.22.0, Java 21, Windows; emuladores demo.

| Comando ejecutado | Resultado |
| --- | --- |
| `npm run lint` | Pasa, cero advertencias de ESLint. |
| `npm run typecheck` | Pasa, aplicación y Functions con TypeScript estricto. |
| `npm run test:unit` | 179 pruebas, 8 archivos, pasan. |
| `npm run build` | Pasa, web y Functions; advertencia de bundle conservada. |
| `npm run test:emulators` | 35 pruebas, 4 archivos, pasan; suite 60,75 s. |
| `npm run test:e2e` | 24 pruebas pasan: Chromium escritorio y Pixel 7 emulado; suite 2,2 min. |

La integración comprueba cálculo manual, filtros, permisos manipulados, revocación,
selecciones concurrentes/idempotentes, versiones fijas, cierre, exclusiones,
duplicados, paginación 25+1 y exportación completa. E2E usa administrador y dos
coordinadores reales de Auth Emulator, navegación con teclado, selección persistente,
exportación del filtro, ausencia, carga y error recuperable. Solo se retiene una
petición real o se provoca un fallo de red para esos estados, sin inventar datos.

Durante la preparación se corrigieron selectores y sincronización de las pruebas
nuevas. Hubo además una ejecución sin Functions por timeout de descubrimiento del
emulador local; se repitió completa con los mismos límites. La última ejecución
parte de un entorno limpio y pasa íntegra. No se omiten suites ni se relaja el
workflow. Los enlaces y SHA final del CI automático se registran en el PR para
evitar un commit adicional que vuelva obsoleta esa evidencia.

No se versionan node_modules, compilados, logs, traces ni `.env` locales: se
regeneran con el lockfile y comandos del README. No se omite ningún archivo privado
necesario para las pruebas sintéticas.

## Límites y pendientes conservados

- Únicamente emuladores demo. Sin conciliación de archivos privados, piloto ni nube.
- 14 alertas de dependencias previamente documentadas, sin cambiar versiones,
  lockfile, aplicar audit fix o degradaciones. Bundle y aviso del SDK Storage
  siguen en [dependencias y bundle](dependencias-y-bundle.md).
- El servidor agrega al consultar; no hay cubos precalculados. Páginas limitan
  la transferencia al navegador, pero los totales requieren recorrer el universo
  filtrado en servidor. Medición integral de 45/230 cursos, memoria, latencia,
  costo y concurrencia a escala sigue pendiente; no se promete rendimiento real.
- Máximo 500 cursos y 10 000 trabajos por fotografía; excederlos produce error
  explícito, sin totales parciales. Exportación máxima 8 MiB: acotar filtros si
  excede el límite. No se borran fotografías, originales ni selecciones; retención,
  recuperación y presupuesto requieren decisión posterior.
- Con filtros de estudiante/grupo/modalidad/turno se cuentan cursos con filas
  atribuibles. Un curso sin archivo no permite inferir esos atributos. El catálogo
  esperado general se muestra al retirar dichos filtros.
- No se inventa atribución provisional: especiales sin base confirmada permanecen
  identificados fuera de las observaciones. Las asignaciones y excepciones reales
  deben validarse administrativamente.
- Los cortes cerrados antes de esta etapa sin selección aparecen sin actividades;
  no se alteran retrospectivamente. Una corrección requiere revisión de corte.
- No hay promedios normalizados, aprobación, faltas de entrega, retrasos docentes,
  bitácora ni evolución comparativa de etapa 05.
