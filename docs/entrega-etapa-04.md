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

## Corrección de revisión del PR #3

- Las exclusiones del reporte se examinan antes de descartar un curso sin filas
  medibles. El padrón usa el catálogo autorizado del alcance, sin depender de que
  la matrícula tenga observaciones. `000BAJA` conserva su baja y las procedencias
  del reporte y padrón; D=0, cobertura=null y cero estudiantes medidos.
- Una condición común por persona, calculada con inscripciones autorizadas, se
  aplica a detalles, exclusiones del reporte y padrón. `con_especial` conserva
  únicamente personas con inscripción clasificada especial; `solo_base` elimina
  a esas personas, también de sus otras inscripciones. Una identidad sin
  inscripciones autorizadas no se presenta como base por defecto al usar el filtro.
- Los filtros de grupo/modalidad/turno usan la base confirmada o la información de
  la inscripción excluida, sin inventar afiliación. Las fuentes se conservan.
- La ruta privada del CSV incorpora su contenido, además de manifiesto/filtros/
  vista. La corrección puede producir un archivo nuevo sin sobrescribir el anterior;
  reintentar el contenido idéntico reutiliza la misma ruta.
- Regresiones en `metrics-exclusions.test.ts`: administración y ambos coordinadores,
  filtros combinados, accesos cruzados, procedencia, preservación de exportación
  previa y concordancia de exclusionesCount/páginas/CSV (52 filas, 25+25+2).
  La inscripción de inglés del fixture se verifica con un curso esperado sintético
  adicional; así se comprueba el filtro por persona sobre sus otras inscripciones.
  El cálculo general sigue N=4, D=7 y dos personas. E2E amplía la navegación de
  coordinación para comprobar baja y ambos filtros especiales en escritorio/móvil.

Verificación local final de la corrección (2026-10-03): `lint`, `typecheck` y `build`
pasan; `test:unit` 179/179; `test:emulators` 43/43 en cinco archivos (76,78 s);
`test:e2e` 24/24 en escritorio y móvil. Se mantienen las advertencias documentadas,
sin cambios de dependencias, umbrales o workflow. El CI automático y SHA final se
consignan en el PR. Los resultados del apartado anterior corresponden a la entrega
inicial `5ef5b391`.

Capturas nuevas de la baja con dos procedencias, D=0 y ausencia de porcentajes:
[escritorio](evidencias/etapa-04/revision-pr3/baja-escritorio.png) y
[móvil](evidencias/etapa-04/revision-pr3/baja-movil.png), solo datos sintéticos.

## Límites y pendientes conservados, sin cambios

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
