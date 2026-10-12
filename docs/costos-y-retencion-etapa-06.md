# Costos y retención propuestos — sin activar políticas

Consulta de precios oficiales: **5 de octubre de 2026**, USD, región de ejemplo
**us-central1 (Iowa)**. El propietario todavía no ha creado el proyecto ni elegido
región. Son escenarios presupuestarios, no una cotización ni una factura. Impuestos,
tipo de cambio, acuerdos comerciales y consumo de otros proyectos no incluidos.

## Tarifas verificadas

| Servicio / modalidad | Tarifa de referencia USD | Fuente oficial |
|---|---:|---|
| Firestore Standard, lectura / 100.000 documentos | 0,03 | [Firestore](https://cloud.google.com/firestore/pricing) |
| Firestore escritura / 100.000 documentos | 0,09 | [Firestore](https://cloud.google.com/firestore/pricing) |
| Firestore almacenamiento GiB/hora | 0,000205479 | [Firestore](https://cloud.google.com/firestore/pricing) |
| Firestore backup GiB/hora / restauración GiB | 0,000041096 / 0,20 | [Firestore](https://cloud.google.com/firestore/pricing) |
| Storage Standard regional GiB/hora | 0,000027397 | [Cloud Storage](https://cloud.google.com/storage/pricing) |
| Storage clase A / B por 1.000 operaciones, namespace plano | 0,005 / 0,0004 | [Cloud Storage](https://cloud.google.com/storage/pricing) |
| Cloud Run por solicitud: vCPU-segundo activo | 0,000024 | [Cloud Run](https://cloud.google.com/run/pricing) |
| Cloud Run GiB-segundo activo / millón de solicitudes | 0,0000025 / 0,40 | [Cloud Run](https://cloud.google.com/run/pricing) |
| Instancia mínima ociosa: vCPU-segundo / GiB-segundo | 0,0000025 / 0,0000025 | [Cloud Run](https://cloud.google.com/run/pricing) |
| Artifact Registry GiB/hora después de 0,5 GiB por cuenta | 0,000136986 | [Artifact Registry](https://cloud.google.com/artifact-registry/pricing) |
| Hosting clásico almacenamiento después de 10 GB / transferencia después de 360 MB/día | 0,026/GB / 0,15/GB | [Firebase](https://firebase.google.com/pricing) |

Firestore cobra documentos e índices aplicables; las consultas vacías tienen un
mínimo. Incluye 50.000 lecturas y 20.000 escrituras al día para una base elegible,
pero la distribución diaria importa. PITR, backups y restauración no son gratuitos.
El inventario JSON de emuladores no mide índices ni facturación. No se descuentan
franquicias en los subtotales siguientes salvo donde se señala explícitamente.

## Supuestos de almacenamiento

Un ciclo de 15 semanas tiene cinco cortes separados por 21 días. Modelo con **dos
versiones por archivo/corte** (original más una sustitución) y tres ciclos/año.
No se usa el pequeño tamaño del fixture como predicción de documentos reales.

| Escenario | Cursos | Original medio | Originales/ciclo | Originales/año |
|---|---:|---:|---:|---:|
| Piloto | 45 | 1 MiB | 450 MiB = 0,439 GiB | 1,318 GiB |
| Consolidado | 230 | 1 MiB | 2.300 MiB = 2,246 GiB | 6,738 GiB |
| Límite por archivo existente | 230 | 8 MiB | 18.400 MiB = 17,969 GiB | 53,906 GiB |

A estos originales se suman padrón, catálogo, suplementos, auditoría, intentos,
filas derivadas, índices, snapshots, cierres y exportaciones. Para planificación:
reservar **3 veces** los originales para objetos derivados/copias, además de los
originales (factor total 4, hipótesis que debe reemplazarse con inventario real).
Al final del año serían 5,27 / 26,95 / 215,63 GiB en los tres escenarios. A 730 horas
de residencia constante, solo Storage costaría aproximadamente **0,11 / 0,54 / 4,31
USD/mes**. No incluye lecturas, escrituras, transferencia ni Firestore.

Ejemplo operativo mensual explícito para 230 cursos: 5 millones de lecturas,
200.000 escrituras, 5 GiB Firestore, 27 GiB Storage, 10.000 operaciones A y 100.000 B,
10.000 vCPU-segundos activos, 7.500 GiB-segundos y 20.000 llamadas. Sin franquicias:

| Componente | Cálculo | USD/mes aprox. |
|---|---|---:|
| Firestore operaciones | 50 × 0,03 + 2 × 0,09 | 1,68 |
| Firestore almacenamiento | 5 × 730 × 0,000205479 | 0,75 |
| Storage datos y operaciones | 27 × 730 × 0,000027397 + 10 × 0,005 + 100 × 0,0004 | 0,63 |
| Cómputo y llamadas | 10.000 × 0,000024 + 7.500 × 0,0000025 + 0,02 × 0,40 | 0,27 |
| Subtotal parcial | No es total de la factura | **3,33** |

Sensibilidad: diez veces lecturas/escrituras/cómputo aumenta esas partidas diez
veces. No se deducen los segundos de nube de tiempos de emulador. Una página del
panel vuelve a consultar el universo autorizado: más navegación puede aumentar
lecturas aunque devuelva solo 25 filas. Medir Query Explain y billing export en
staging antes de aprobar presupuesto.

Costos persistentes: con minInstances=0 no se reserva una instancia. Si se decide
una instancia mínima de 1 vCPU y 0,5 GiB, el coste ocioso aproximado a 730 h es
**9,86 USD/mes por servicio**, más tiempo activo; no se ha activado. Mantener 2 GiB
de imágenes cuesta aproximadamente **0,15 USD/mes** tras los 0,5 GiB de franquicia
de Artifact Registry. Veinte GiB de backups residentes: ~0,60 USD/mes; restaurarlos
una vez: 4,00 USD. Estos ejemplos no deben sumarse si no se habilitan.

Pendientes para un total: tráfico de salida y destino, Eventarc/PubSub, Cloud
Build, logs, número de revisiones de imágenes, backup/PITR, uso de Auth/Identity
Platform o SMS, dominio y soporte. Consultar sus tarifas oficiales al fijar
destino y consumo ([Firebase y productos asociados](https://firebase.google.com/pricing)).
No asignarles importe cero por carecer de mediciones. El login actual usa correo
y contraseña, no SMS. Los presupuestos no bloquean automáticamente el gasto.

## Retención y recuperación: propuesta pendiente

- Conservar fuentes originales, derivadas publicadas, mapeos y auditorías durante
  toda la vigencia del expediente y hasta que la institución apruebe plazo legal.
- Conservar íntegramente cierres y sus referencias. Una revisión no borra el
  original; antes de cualquier purga futura, verificar el grafo de referencias.
- Proponer copias diarias y ensayo periódico de restauración en **otro proyecto
  aislado**, cifrado y con IAM restringido. Acordar RPO/RTO y responsable antes de
  comprometer tiempos. Versionado y soft-delete de Storage no sustituyen backup
  coherente de Firestore, Auth y objetos.
- Exportaciones e intentos huérfanos pueden tener otra retención, pero solo tras
  aprobación documentada y verificación de referencias; no hay TTL ni lifecycle
  destructivo añadido. No se ha eliminado ninguna fuente privada.
- Recuperación de trabajo interrumpido y conservación de versiones se prueban
  en emuladores. Restauración de backup, IAM, regiones, continuidad y tiempos de
  nube permanecen **documentados, no ensayados en nube**.
