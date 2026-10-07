# Entrega de etapa 06 — piloto y preparación de publicación

Rama: `etapa-06-piloto-y-publicacion`. Base verificada y conservada:
`b5235257b996840f2b5979998148e591745f3ffb`. El SHA final y la ejecución automática
se consignan en el PR para evitar un SHA autorreferente dentro de su commit.
No merge, despliegue, cambio de protecciones, eliminación de fuentes ni mensajes
a responsables. El usuario confirma que aún se creará el proyecto Firebase.

## Alcance

- Piloto reproducible de 45 y 230 cursos mediante API, worker, Auth, Firestore y
  Storage demo, con dos cortes por escenario. Mide fases y comprueba cuentas,
  cinco ámbitos autorizados, paginación, CSV, comparación y cierres.
- Recuperación de intento interrumpido, lotes parciales, duplicados bloqueados,
  sustituciones concurrentes e idempotencia. Se conservan regresiones previas
  académicas, de permisos, historial y navegador.
- Optimización de lectura transaccional de fotografías a partir de medición
  previa, sin cambiar contratos ni arquitectura. No se aumentan límites.
- Inspección privada provisional de cinco fuentes suministradas; solo evidencia
  agregada en Git. Conciliación final condicionada a fuentes/decisiones faltantes.
- Configuración y guía de staging, inventario público verificado, manual operativo,
  propuesta de retención/recuperación y escenarios de costos oficiales.

## Cálculos sintéticos inspeccionables

Cada estudiante tiene cinco actividades: **0, 7, “-”, vacío, “INVALIDO”**.
Por inscripción de curso: N=2, G=1, V=1, E=1, Z=1, D=5; cobertura=40 %.
Una sustitución usa 8 o 9 en la segunda actividad: conserva estos conteos.
Cada archivo también contiene un docente, excluido del denominador.

Hay 50 personas únicas, 10 por cada una de cinco carreras. Un curso de cada diez
es compartido por las cinco; los otros corresponden a una carrera. Las personas
se repiten intencionalmente entre asignaturas para probar unicidad institucional.
El ciclo `27-6` es exclusivamente sintético, con fechas configuradas por fixture;
no cambia el ciclo real ni sus reglas.

| Escenario | Compartidos | Filas estudiantes/corte | Filas docentes/corte | N | G=V=E=Z | D | Personas únicas | Lotes regulares/corte |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 45 cursos | 5 | 650 | 45 | 1.300 | 650 | 3.250 | 50 | 3 (20/20/5) |
| 230 cursos | 23 | 3.220 | 230 | 6.440 | 3.220 | 16.100 | 50 | 12 (11×20/10) |

CSV/XLSX/ODS alternados, cinco actividades y seis columnas por archivo, 10 o 50
estudiantes según alcance; 12 o 52 filas contando encabezado y docente. Los JSON
de evidencia enumeran formato, bytes y filas por archivo. Ninguno excede los
límites de carga existentes. Se agrega un lote de cuatro propuestas en el primer
corte: dos sustituciones del mismo curso, archivo corrupto y duplicado de fila.
Cada lote regular se reenvía y mantiene los mismos IDs, sin multiplicar versiones.

El universo comparable aprobado contiene las mismas actividades por instancia:
3.250 / 16.100 observaciones, 40 % antes y después, diferencia **0 puntos
porcentuales**. El fixture de etapas 04/05 sigue separado y conserva sus cálculos
manuales, bajas, especiales y ausencia explícita de correspondencias.

**Límite de representatividad:** estos escenarios tienen 50 personas únicas, no
los 2.661 identificadores del padrón privado. Prueban número de cursos, solapamiento
y densidad declarados; no acreditan capacidad para toda la población real ni
latencia/SLA de nube. No se extrapolan segundos de emulador a producción.

## Reproducción y mediciones

Node 22, Java 21, dependencias del lockfile. Desde árbol limpio:

```sh
npm ci
npm run build
npm run test:pilot
```

Solo un ejecutor de emuladores a la vez. `PILOT_COURSES=45` o `230` permite repetir
un escenario (sintaxis de variable según shell); sin variable se ejecutan ambos.
La suite no usa archivos privados y se niega a operar fuera de demo. Salida local
ignorada: `test-results/pilot/{45,230}.json`. Para conservar resumen:

```sh
npm run test:pilot > pilot.log 2>&1
node scripts/summarize-pilot.mjs test-results/pilot/45.json pilot.log resumen-45.json
node scripts/summarize-pilot.mjs test-results/pilot/230.json pilot.log resumen-230.json
```

El resumen del log completo contiene muestras Functions de ambos escenarios;
para memoria/worker por escenario, ejecutar cada uno con su log separado. Las
mediciones individuales de API y los inventarios sí corresponden a cada caso.
No confundir sumas de operaciones concurrentes con tiempo total de pared.
`processing:waitReady` mide espera después de recepción, incluyendo polling;
`worker` mide duración de la invocación local. Upload incluye comprobación y
recepción durable; publish mide confirmación transaccional. Rechazos esperados
de permisos/cierre aparecen como `failures` de llamadas, pero son aserciones
positivas de la suite. Un worker que registra un archivo inválido termina sin
excepción; eso no implica publicación válida.

Entorno local medido: Windows 10.0.26300, 16 procesadores lógicos, 16.837.013.504
bytes RAM, Node v22.22.0 y Java 21. Proceso y red localhost; no máquina de benchmark
dedicada. RSS se muestrea, no se garantiza pico continuo ni suma de todos los
procesos. El emulador no impone igual que nube la memoria/concurrencia declaradas.

Base conservada en `docs/evidencias/etapa-06/baseline-45.json` y
`baseline-230.json`; repetición en `final-45.json` y `final-230.json`.
Primera ejecución de 45 falló antes del piloto por descubrimiento
de Functions a los 10 s; repetida sin relajar límites. No se contabiliza como
capacidad ni como resultado satisfactorio.

| Medida cliente (ms) | Base 45 | Final 45 | Base 230 | Final 230 |
|---|---:|---:|---:|---:|
| Total escenario | 101.908 | 87.185 | 423.555 | 302.798 |
| Recepción upload p95 | 382 | 280 | 258 | 218 |
| Espera procesamiento p95 | 981 | 881 | 858 | 752 |
| Confirmación publish p95 | 136 | 133 | 135 | 129 |
| Panel/páginas máximo observado | 3.551 | 2.381 | 19.650 | 11.836 |
| Exportación panel de carrera, máximo | 758 | 526 | 3.858 | 2.156 |
| Cierre máximo | 3.716 | 330 | 17.716 | 591 |
| Comparación institucional | 1.463 | 1.564 | 12.421 | 11.245 |

La repetición final añade cuatro propuestas y recuperación; no es idéntico total
de operaciones a la base. La reducción de cierre es el resultado más directo de
agrupar lecturas. El panel conserva recorrido por filas/artefactos; 11,8 s sigue
siendo una latencia relevante que deberá evaluarse con población y nube reales.
Una medición local antes/después no define un SLO ni un intervalo de confianza.

El log final combina ambos escenarios: worker p95 **208 ms** y máximo RSS muestreado
de un proceso Functions **475.377.664 bytes** (~453,4 MiB), no memoria por escenario
ni suma de workers. Client RSS muestreada: 149.643.264 / 160.145.408 bytes para
45/230; máximo del SO también queda en JSON. No se perfilaron JVM y otros procesos
de emuladores. La cercanía a 512 MiB exige medir concurrencia/cold-start en nube;
esta entrega no certifica suficiencia de memoria productiva.

230 cursos: CSV 77 archivos de 520–2.280 bytes; XLSX 77 de 9.258–11.359;
ODS 76 de 5.280–8.648. Inventario final acumulado de ambos casos y seed:
562 originales (2.916.445 bytes), 564 derivados (1.813.124), 4 cierres (1.126.675),
32 snapshots (3.102.640), 6 exportaciones (3.232.153). Firestore del segundo
escenario: 6.552 documentos de fila de todos los intentos, 2.595.136 bytes JSON.
La propiedad `baselineReportRows` cuenta entradas de reporte, incluidos docentes;
no son escrituras efectivas. Inventario no incluye overhead ni índices.

### Lecturas y escrituras: estimadas, no factura medida

Para la fotografía abierta: C documentos de cursos + J de trabajos + 2C de
punteros/selecciones autorizados, más membresías/corte. Antes había C lecturas
adicionales de trabajos. En 230 cursos totalmente publicados: aproximadamente
920 documentos frente a 1.150, sin contar fuentes, filas, mínimos de consulta,
índices ni reintentos transaccionales. El cambio principal reduce viajes de red:
de 690 lecturas individuales a dos bloques de metadatos y la consulta ya existente.

Un panel sigue leyendo las R filas autorizadas y los artefactos pertinentes para
agregar exactamente. La paginación devuelve 25 filas pero no cobra solo 25 lecturas;
exportar repite el universo. Comparar dos cortes consulta ambos. El cierre captura
dos veces para comprobar coherencia. Escrituras estimadas: una por fila de intento,
transiciones de job, selección/historial, puntero y publicación. Los reintentos
añaden intentos conservados. No se reportan estos cálculos como medición de billing.

Inventario medido: bytes de objetos por prefijo en Storage demo y bytes JSON de
filas derivadas en Firestore, sin overhead/índices. El bucket conserva fuentes
previas sintéticas; cada JSON declara el ámbito acumulado. Número de objetos no
equivale a número de lecturas/escrituras facturadas.

## Verificación y aceptaciones

| Aceptación | Estado / evidencia |
|---|---|
| Base y conservación de trabajo previo | Verificada; main en base indicada, árbol inicial limpio, rama separada |
| Lectura de los cuatro libros y padrón reales sin mutarlos | Verificada provisionalmente; [agregados](conciliacion-piloto-etapa-06.md), detalle privado ignorado |
| Afiliación, excepciones, bajas y selección real final | Pendiente de catálogo autorizado, suplemento, decisiones y corte; no inventados |
| 45/230 cursos y exactitud de cuentas | Base y repetición final verificadas; dos casos aprobados |
| Cinco coordinadores, consultas cruzadas denegadas y CSV autorizado | Verificada en piloto final; 59 regresiones de emuladores aprobadas |
| Fallo/reintento, sustitución concurrente y errores parciales | Verificados en ambos escenarios finales |
| Navegador cerrado/reabierto, teclado y móvil | 32 E2E aprobados en repetición completa; incidencia intermitente inicial descrita abajo |
| Publicaciones/cierres/versiones conservadas | Piloto final y regresiones de concurrencia aprobados |
| Inventario Hosting solo público | Verificado por script y prueba negativa; cinco archivos de build |
| Staging listo para activación en nube | Pendiente de proyecto, región, runtime explícito y smoke; configuración revisable preparada |
| Operación, reversión y restauración | Procedimientos documentados; nube no ensayada |
| Retención y costos | Propuesta, precios verificados; no política destructiva ni gasto activado |
| CI automático sobre SHA final | El PR consigna SHA, evento pull_request, enlace y resultado verificado de sus tres checks |

Comprobaciones ya ejecutadas: `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run test:unit` (**196 pruebas**) y `npm run verify:hosting`, salida 0.
`test:emulators`: **59 pruebas**, salida 0 (193,79 s);
`test:pilot`: **2 escenarios**, salida 0 (391,76 s de suite).
`test:e2e`: **32 pruebas**, salida 0 (5,0 min), en repetición completa sin
cambiar código, aserciones ni tiempos. El primer intento terminó con 31 aprobadas
y una fallida: el panel administrativo seguía en «Calculando…» al vencer la
espera de 5 s. Su traza conserva una consulta pendiente sin respuesta recibida;
no determina la causa. La incidencia intermitente queda pendiente de aislamiento,
no se declara corregida por la repetición exitosa. Traza y contexto se conservan
en `local-data/diagnostico-etapa-06/`, ignorado por Git.

### Capturas sintéticas

Capturadas por la repetición E2E aprobada. Corresponden al fixture pequeño de
regresión, no a una medición visual de los 230 cursos ni a personas reales:

- [Panel administrativo](evidencias/etapa-06/panel-admin.png): D=7, N=4,
  dos personas únicas, cobertura 57,14 %.
- [Coordinación A tras reabrir navegador](evidencias/etapa-06/recuperacion-coordinacion-a.png):
  publicación válida y error parcial conservados; alcance aislado.
- [Panel móvil de coordinación B](evidencias/etapa-06/panel-coordinacion-b-movil.png):
  D=3, N=2, E=1, cobertura 66,67 %, exclusivamente su alcance sintético.

## Dependencias, bundle y límites conservados

[Audit actualizado](dependencias-etapa-06.md): 16 paquetes (12 altos/4 moderados),
sin actualizaciones ni degradaciones. El conteo anterior era 14; nuevas alertas
de `braces`/`chokidar`. No se declara remediación ni explotabilidad por el conteo.

Build: `dist/assets/index-CCggGnaR.js`, **811.984 bytes**, gzip reportado por Vite
242,94 kB; sigue advertencia de chunk mayor de 500 kB. Dashboard 13.442 y History
13.329 bytes, cargados aparte. No se elevó el umbral para ocultar el aviso. Posible
impacto: descarga/parseo inicial en redes o dispositivos lentos; pruebas E2E móviles
no miden hardware móvil real ni garantizan tiempos de carga. Pendiente perfilado
del cliente y revisión acotada del empaquetado.

Se observó `MaxListenersExceededWarning` de streams durante lecturas de Storage
en emuladores. No se silenció ni se cambió el límite de listeners; queda por aislar
su origen/impacto en SDK/emulador y comprobar comportamiento en nube. No prueba
por sí solo fuga persistente; las muestras RSS y la limitación están publicadas.

Detalles operativos en [manual](operacion-etapa-06.md),
[costos/retención](costos-y-retencion-etapa-06.md). Piloto institucional, aceptación
privada completa, destino y validación en nube siguen separados del éxito sintético.

## Actualización de decisiones académicas aprobadas

La implementación posterior en este mismo PR se documenta en
[integración de decisiones aprobadas](integracion-decisiones-aprobadas.md).
Ese informe sustituye los pendientes históricos de catálogo/afiliación ya resueltos:
36 registros de catálogo, seis responsables, 2.873 inscripciones, 2.665 identidades,
2.661 principales y cuatro personas excluidas. La matriz actualizada incorpora
DEC-35/36 y eleva a 75 las revisiones resueltas: sustituye la instrucción anterior
de dejar dos fechas pendientes. Las cuatro clasificaciones base/especial y el
cambio de principal se verificaron conservando todos los originales; cero
pendientes y diferencias contra las afiliaciones aprobadas.
El paquete real sigue sin publicarse. No se incorporan datos privados a esta entrega.

Resultados de la primera ampliación: 211 unitarias, 64 de emuladores, 34 E2E, dos
escenarios de piloto y guardia Hosting aprobados; lint, tipos y build aprobados.
La actualización DEC-35/36 agrega regresiones de clasificación y de revisiones
obsoletas/concurrentes; resultados actuales en el informe de integración.
Bundle actual: `index-AHv9mtQj.js`, 819.132 bytes, gzip 244,71 kB. Las mediciones anteriores se
conservan como antecedentes. Nuevas capturas, cálculos, procedimiento y límites en
[integración de decisiones aprobadas](integracion-decisiones-aprobadas.md).
