# Fase 2: preparación y validación en Firebase de pruebas

**Estado actualizado:** [ejecución real, identidad, pruebas y pendientes](validacion-nube-ejecucion.md).
Los apartados de preparación siguientes conservan el registro histórico previo al despliegue.

Fecha de inspección: 2026-10-08. Base revisada: `3fff0c4a40696c79d49c6cbd06af4326146660df`,
PR #5, rama `etapa-06-piloto-y-publicacion`. La consulta remota y el árbol local
confirmaron esa referencia, sin avances posteriores que reemplazar.

**Actualización 2026-10-08:** el propietario creó `indicadores-academia`, activó
Blaze y confirmó `us-central1`. La sesión Firebase verificó ID y facturación.
Se registró una app web, se crearon Firestore Standard `(default)` y el bucket
`indicadores-academia.firebasestorage.app` en esa región y se habilitó Auth
correo/contraseña. Cuenta de ejecución dedicada sin claves, con roles autorizados
de Firestore/consulta Auth y creación/lectura de objetos en ese bucket; no borrado
de objetos. Se conserva auditoría del bootstrap inicial y cuentas sintéticas con
contraseñas aleatorias en archivos privados. No se modifica el bootstrap demo.
Despliegue y pruebas cloud se registran en el PR por SHA, separados de los
resultados locales siguientes. **Aceptación institucional pendiente.**

## Cambios de preparación

- Runtime de staging explícito, separado del demo. `config/staging-target.json`
  fija el proyecto de pruebas verificado. La regresión del destino `null` permanece
  mediante fixture independiente; no se habilita producción ni fallback al fallar emuladores.
- El destino compartido fija proyecto, región, bucket exacto y sitio Hosting.
  Auth utiliza el proyecto/app web y su dominio Firebase; Firestore usa el
  proyecto de ejecución de Functions. Storage usa el bucket aprobado, sin deducir
  sufijo. El navegador solo utiliza Auth y Functions; datos y originales siguen
  privados bajo las Rules existentes y autorización de servidor.
- Functions exige `TRACKING_RUNTIME=staging`, proyecto de ejecución coincidente,
  ausencia de endpoints de emulador y SHA completo. `environmentStatus` devuelve
  proyecto/SHA, y la UI exige coincidencia con su build antes de habilitar acceso.
  Un diagnóstico correcto no sustituye las pruebas de cada servicio ni concede roles.
- `npm run prepare:staging` requiere destino válido y árbol limpio. Lee únicamente
  `projectId`, `apiKey` y `appId` públicos de `private/staging-web.json`, y genera
  `.env.staging.local` y `functions/.env.PROYECTO`, ignorados por Git. No consume
  secretos ni despliega. `npm run build:staging` compila y comprueba el inventario
  público. La preparación actual falla intencionalmente por destino pendiente.
- El espacio de trabajo se carga después de verificar conexión. Su fallo de
  descarga ofrece recarga sin perder trabajos aceptados. Se eliminan SDK de
  Firestore/Storage no usados en el navegador. Sin cambios a dominio académico,
  DEC-01–36, conciliación, versiones, roles, Rules ni límites de carga.

## Dependencias: resultado y valoración separados

Herramienta, consulta 2026-10-08: `npm audit --json`, 16 paquetes afectados antes
(12 high, 4 moderate); después 11 (7 high, 4 moderate). Son paquetes, incluyendo
propagación a dependientes, no once vulnerabilidades independientes.
`npm audit --omit=dev --json` deja 2 paquetes moderate: `gaxios` y `uuid`.
El informe [de dependencias](dependencias-etapa-06.md) conserva rutas, relación,
severidad y corrección propuesta por npm. Los JSON completos quedan localmente.

Corrección aplicada: override **solo de `@firebase/firestore → @grpc/grpc-js`**,
de 1.9.16 a 1.14.6, con lockfile. Es cambio minor de gRPC 1.x pero excede el rango
`~1.9.0` fijado por Firebase: por eso se valida el SDK Node con las pruebas de
Rules/emuladores además de toda la aplicación. No se actualiza Firebase, CLI,
React ni el resto de dependencias directas. Los dos paquetes añadidos corresponden
al nuevo gRPC/proto-loader; el gRPC de Admin SDK ya estaba en 1.14.5 corregido.
El [aviso del mantenedor de gRPC](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j)
documenta la corrección desde 1.13.6/1.14.5. No ejecutamos servidor gRPC propio ni
autorización basada en `getAuthContext`; además, gRPC no forma parte del bundle web.
La remediación elimina el componente vulnerable aunque no se haya demostrado una
ruta explotable en este producto. Retirar el override cuando Firebase lo resuelva.

Valoración del código instalado (no resultado automático de npm):

| Componente pendiente | Uso y exposición comprobada | Decisión |
| --- | --- | --- |
| `uuid@9.0.1` por `gaxios@6.7.1` | Servidor: Admin → Storage → gaxios; también CLI. gaxios llama a `v4()` sin buffer para separadores multipart. El aviso afecta v3/v5/v6 con buffer; no se encontró ese uso en esta ruta. No va al navegador. | Riesgo específico no demostrado; permanece aviso. Corrección upstream >=11.1.1 requiere cambio major de uuid o actualización compatible del padre. No forzar ni ocultar. |
| `basic-ftp@5.3.1` por get-uri/PAC/proxy-agent | Solo CLI, en resolución de proxies FTP. La app académica no ofrece FTP ni consume este parser. | 6.2.1+ corregido, fuera del rango 5.x del padre. Mantener configuración de proxy confiable; actualización del padre pendiente. |
| `braces@3.0.3` por chokidar | Solo CLI/watch de archivos locales, sin exposición desde la API académica. | npm no informa versión corregida; no aceptar patrones de repositorios/configuraciones ajenos. Pendiente upstream. |
| `@opentelemetry/core@1.30.1` por Pub/Sub | Solo CLI. Telemetría/baggage, no servidor publicado ni navegador. | Corrección >=2.8.0 incompatible con el rango 1.x del padre; pendiente actualización de Pub/Sub/CLI. |

Las degradaciones a Firebase 9, CLI 14 o Rules testing 2 propuestas por audit no
se aplican. Fuentes primarias: [uuid](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq),
[basic-ftp](https://github.com/patrickjuchli/basic-ftp/security/advisories/GHSA-c475-qrg2-pj4r);
resto de avisos enlazados en el informe generado. SheetJS tarball requiere vigilancia
independiente. Esta valoración no declara ausencia de otros riesgos ni aceptación
productiva de los pendientes.

## Medición reproducible del frontend

Node 22.22.0, Windows, Vite 8.3.2, mismo equipo/configuración, modo demo de producción.
`node scripts/measure-bundle.mjs` utiliza Vite sin escribir archivos y mide bytes JS
y gzip por recurso con Node/zlib. No es latencia de red, tiempo de CPU ni medida de
capacidad Firebase. Mediciones de bytes sin comprimir / gzip:

| Descarga JS | Antes | Después |
| --- | ---: | ---: |
| Entry necesario para renderizar shell | 826.031 / 244.363 | 224.676 / 69.795 |
| Hasta conexión y acceso institucional | 826.031 / 244.363 | 448.565 / 135.098 |
| Total de todos los chunks | 853.886 / 253.084 | 476.578 / 143.912 |

Entry final `index-BZ82EWtB.js`, chunk Auth/Functions `firebase-BFcsQ63o.js`
(183.862 bytes), `AccessWorkspace-BMJbpM21.js` (40.027). Reducción sin comprimir:
72,8 % del entry y 45,7 % hasta acceso; 44,2 % de JS total. Todos los chunks
quedan por debajo del umbral original de 500 kB: el build ya no emite ese warning.
El diagnóstico anterior del bundle se conserva como histórico en la entrega;
esta medición lo actualiza. CSS: 8.600 bytes; HTML: 512 bytes, fuera de la tabla JS.

Base: `index-BZunIsxt.js`, 826.031 bytes (244.363 gzip con este medidor); total JS
853.886 bytes / 253.084 gzip. Antes el entry contenía Firestore y Storage.
La UI nueva carga Auth/Functions al comprobar conexión y AccessWorkspace después;
por ello se informa también el total hasta acceso, no solo el entry pequeño.
Historial y Dashboard siguen diferidos. No se cambió `chunkSizeWarningLimit`,
no se silencian warnings y se conserva toda funcionalidad. `npm run verify:hosting`
rechaza archivos ajenos al build, claves, originales y exportaciones.

## Activación tras identificar el destino (no ejecutada)

La carga diferida añade solicitudes HTTP. La mejora de latencia en una conexión
real se medirá al disponer de Hosting; la reducción documentada aquí es de bytes.

1. Recibir únicamente ID del proyecto de pruebas y verificarlo con el propietario.
   Comprobar mediante CLI/consola app web, Auth (proveedor correo/contraseña),
   dominios, Firestore `(default)` y su región, bucket existente y región,
   Functions/Cloud Run/Eventarc, APIs, facturación ya autorizada y permisos.
   No crear servicios con facturación por el nombre de un proyecto. Si falta
   acceso, solicitar concesión al operador por canal institucional, nunca claves.
2. Verificar que ningún recurso pertenece al backend productivo; documentar los
   identificadores públicos del destino y aprobación en `config/staging-target.json`.
   El runtime admite los dominios `.web.app`/`.firebaseapp.com` del sitio exacto,
   no previews arbitrarios. Asegurar que Hosting usa ese sitio (añadir `site`
   explícito a `firebase.staging.json` si no es el sitio por defecto del proyecto).
3. Separar SA de ejecución y operador, revisar mínimos de Firestore/Storage/Auth
   y despliegue Gen2. Comprobar ADC/identidad del operador sin imprimir tokens.
   App Check y límites/costos son decisiones de operación pendientes; las
   membresías verificadas en servidor y las Rules siguen obligatorias.
4. Crear tres cuentas Auth **de prueba** por consola administrada, contraseñas
   únicas por canal seguro. Sin reutilizar contraseñas públicas de fixtures.
   Registrar UID del admin y dos coordinadores privadamente. Bootstrap inicial
   en proyecto vacío requiere operación privilegiada auditada, transacción de
   `bootstrap/initial-admin` y membresía admin, comprobando Auth UID existente;
   revisar/ejecutar esa operación cuando exista destino y operador. **No ejecutar
   `scripts/bootstrap-admin.mjs` ni `seed-demo.mjs` contra nube**: son demo-only.
   Altas posteriores mediante `assignMember`, sin roles del navegador.
5. Commit revisable del destino público, seis verificaciones y CI, árbol limpio.
   Guardar app web pública en `private/staging-web.json` y ejecutar
   `npm run build:staging`. Revisar SHA de ambas configuraciones e inventario.
   La API key de Firebase identifica la app, no autoriza expedientes; nunca guardar
   secretos de cuentas de servicio o contraseñas en campos VITE.
6. Registrar releases anteriores, desplegar explícitamente con Firebase CLI fijada:
   `firebase deploy --project ID_VERIFICADO --config firebase.staging.json --only firestore:rules,firestore:indexes,storage,functions,hosting`.
   El entorno de esta fase está autorizado, **solo después de verificar destino**.
   Esperar índices y triggers listos. Verificar en recursos reales SHA, región,
   bucket, proyecto y dominio; comprobar login y denegaciones antes de sembrar.
7. Importar solo fixtures sintéticos por API/interfaz, en un ciclo/cortes propios
   de la sesión. No reutilizar rutinas demo que limpian colecciones. No registrar
   tokens/contraseñas en logs o capturas. Guardar evidencia agregada con fecha,
   SHA, escenario, parámetros y resultado; publicar solo sintético.

## Plan técnico de nube y capacidad (pendiente, no ejecutado)

Insumos reproducibles: `npm run prepare:cloud-fixtures` genera exclusivamente datos
sintéticos en `private/cloud-synthetic-inputs`, sin SDK Firebase, cuentas ni cargas.
Se ejecutó y se verificaron hashes/tamaños de 288 archivos (1.469.508 bytes en total),
incluyendo fuentes, pequeño caso de aceptación y anomalías. Rechaza sobrescribir
una carpeta existente. Su manifest conserva tamaño/hash por archivo, curso, ámbito,
mapeo y distribución de lotes. Las fuentes/cursos se publican primero por API o UI;
los escenarios 45/230 usan ciclo sintético 27-6, independiente del caso pequeño 27-1.
Los insumos generados no son una ejecución de capacidad ni una validación cloud.

| Escenario | Alumnos únicos | Filas de alumno/corte | Actividades/archivo | Lotes base | Bytes reportes base | Rango por archivo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 45 cursos | 50 | 650 | 5 | 3 | 236.972 | 520–11.359 |
| 230 cursos | 50 | 3.220 | 5 | 12 | 1.208.712 | 520–11.359 |

Se alternan CSV/XLSX/ODS, cada décimo curso es compartido entre cinco carreras;
hay una fila docente por archivo, excluida. Reenviar un archivo base permite probar
reintento idéntico; carpetas separadas contienen sustitución, fila duplicada y ODS
corrupto. Estos archivos pequeños no representan libros de 8 MiB ni garantizan
capacidad productiva. No ampliar conclusiones más allá de la población medida.

| Caso | Evidencia que debe registrarse en el destino |
| --- | --- |
| Admin, A y B, curso compartido | Login real; A sin datos de B, B sin datos de A; ataques por ID/carrera, exportación, originales y modificación denegados; revocación con sesión ya abierta. |
| Progreso explícito | Corte sin fecha; Escolarizado 1, Ejecutivo 3, Virtual 2; principal C.A. de Virtual; editar fecha conserva indicadores; U4 almacenada, fuera de N/D. |
| Parciales | U1/U2 actualizadas + U3 juntas y separadas producen mismos valores; filas/columnas ausentes conservadas; reenvío viejo no revierte; extras numéricos y cero incluidos. |
| Revisión | Numérico→vacío/guion visible, confirmación propia de la propuesta; actualizar por otra sesión invalida publicación/revisión antigua. |
| Historial | Cierre concurrente con publicar/seleccionar; una única operación coherente, foto estable; corrección nueva con motivo; exportación y comparación congeladas. |
| Recuperación | Cerrar navegador tras aceptación; consultar job desde otra sesión. Fallo controlado en entorno de pruebas y retry tras lease: sin duplicados, intentos limitados, sin publicaciones parciales. No editar punteros manualmente. |
| Piloto gradual | Primero 3 cursos, luego 45 y 230; formatos CSV/XLSX/ODS, cursos compartidos, duplicado, sustitución e inválido; lotes de máximo 20, máximo 8 MiB/archivo. Verificar totales y aislamiento en cada escalón antes del siguiente. |

Por escalón: declarar filas/alumnos/actividades y bytes generados por archivo,
concurrencia de cliente y límites de Functions vigentes; registrar recepción,
cola/procesamiento, revisión/publicación, panel/paginación/exportación, cierre y
comparación. Capturar errores/reintentos, p50/p95 cuando haya muestra suficiente,
memoria observable de Cloud Run, tamaño de originales/derivados, métricas de
Firestore/Storage/Functions y ventana temporal. Lecturas/escrituras de Monitoring
son medidas; derivadas de operaciones son estimaciones y se etiquetan. No activar
borrado para reducir costo ni aumentar límites para aprobar. Fallos, cuotas o
costos no aprobados detienen el escalamiento. No hay tiempos ni costos de nube
medidos en esta entrega. El piloto local 45/230 se mantiene como regresión separada.

## Reversión y aceptación

Ante un fallo, suspender nuevas cargas, conservar jobs y versiones; guardar SHA,
releases y diagnóstico. Restaurar Hosting y Functions a un SHA **compatible con
los datos y el destino aprobado** (recompilar con su mismo SHA en ambos extremos).
El baseline demo anterior no es un rollback utilizable en nube. No borrar fuentes,
no reescribir cortes ni restaurar un dump parcial sobre el entorno activo. Si aún
no existe release de nube compatible, mantener el entorno inaccesible para pruebas
y diagnosticar, sin improvisar downgrade. Restauración de Firestore+objetos requiere
otro destino aislado, inventario y validación de referencias/hash/permisos. Los
procedimientos están documentados; **rollback y restauración cloud no probados**.

La [guía de aceptación](aceptacion-operativa.md) es para evaluación del usuario.
Las suites automáticas y el CI no registran aprobación institucional. Persisten
pendientes de proyecto/IAM, aceptación de usuario, piloto cloud 45/230, recuperación
cloud, retención/costos, conciliación/piloto privado y validación productiva.

## Verificaciones ejecutadas en esta continuación

| Comando | Resultado local |
| --- | --- |
| `npm run lint` | Aprobado, cero advertencias de lint |
| `npm run typecheck` | Aprobado, web y Functions |
| `npm run build` | Aprobado; sin warning de chunk grande, umbral original |
| `npm run test:unit` | 232 pruebas, 16 archivos, aprobadas |
| `npm run test:emulators` | 74 pruebas, 11 archivos, aprobadas |
| `npm run test:e2e` | 40 pruebas, escritorio/móvil, aprobadas |
| `npm run test:pilot` | Ambos escenarios aprobados; suite 290,14 s |
| `npm run verify:hosting` | 7 archivos públicos aprobados |
| `npm run prepare:cloud-fixtures` | 288 archivos sintéticos; hashes, tamaños y lotes verificados |
| `npm run prepare:staging` | Rechazo esperado por destino pendiente; no escribe configuración ni despliega |

La primera ejecución unitaria dentro del sandbox se detuvo con EPERM al renombrar
temporales de Vitest; no ejecutó pruebas. Se repitió con el runtime autorizado y
pasaron las 232. Un error de tipado estricto en la configuración opcional del SDK
se corrigió antes de la verificación final. No se omitieron suites ni checks.

Piloto **en emuladores**, Node 22.22.0/Java 21, Windows 10.0.26300, 16 CPU lógicas,
16.837.013.504 bytes RAM: escenario 45, 58.450 ms, RSS cliente muestreada máxima
146.071.552 bytes; escenario 230, 230.872 ms, RSS cliente muestreada máxima
167.723.008 bytes. Son muestras del cliente, no pico de Functions ni garantía de
nube. Inventarios y mediciones por operación quedan en `test-results/pilot/*.json`;
logs en `private/cloud-*.log`. Sigue observable `MaxListenersExceededWarning`
de Storage/teeny-request documentado en [dependencias y bundle](dependencias-y-bundle.md).
No se incrementó el límite de listeners ni se suprimió el aviso; medición sostenida
en nube pendiente. Lecturas/escrituras facturadas no medidas en emuladores.

Revisión de privacidad: 155 archivos públicos inspeccionados, sin coincidencias
con identificadores privados; inventario público sin fuentes/credenciales. El
generador nuevo solo carga módulos sintéticos del repositorio. La conciliación
privada no se ha importado, alterado ni vuelto a ejecutar en esta fase.

El PR registra SHA final, URL del CI automático y resultado exacto de sus checks.
La aprobación de ese CI no cierra las aceptaciones cloud/usuario pendientes.

Primer CI de esta continuación, `4a3e479`, ejecución
[37826480058](https://github.com/victoryama-wq/seguimiento-academico/actions/runs/37826480058):
calidad y reglas aprobadas; E2E 39/40. El caso móvil de avance explícito agotó
120 s esperando «Correo» al cambiar de administrador a coordinador
(`tests/e2e/explicit-progress.spec.ts`, llamada a `login` posterior a cerrar sesión).
La prueba navegaba inmediatamente tras el click de `signOut`, sin esperar que
Auth completara la salida. Se añade la comprobación de formulario de acceso
visible y ausencia del botón de cierre **antes** de navegar. El límite de tiempo,
los asserts académicos, el workflow y sus suites se mantienen intactos. El piloto
remoto de esa ejecución no llegó a iniciarse. La validación del ajuste y su nuevo
CI se registran en el PR; no se considera exitosa la ejecución fallida anterior.
Revalidación local del ajuste: lint y tipos aprobados; suite E2E completa con
40 pruebas aprobadas en 5,1 minutos, incluidos ambos casos de avance explícito.
