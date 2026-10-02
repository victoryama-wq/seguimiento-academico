# Entrega de etapa 03 · acceso e importación

Base integrada y verificada: `3963f46d5513e3918774edfcb219d8d4cf102744`.
Rama: `etapa-03-acceso-e-importacion`. Se sincronizó main y se partió de árbol
limpio. La revisión y SHA final se publican en el PR de esta rama; no se fusiona,
despliega ni implementa etapa 04.

## Implementación y aceptación

| Criterio | Implementación y evidencia reproducible |
| --- | --- |
| Auth y roles del servidor | Firebase Auth real en emulador, membresías y auditoría; bootstrap privilegiado y rechazo de segunda asignación. Roles falsificados y cuenta sin membresía denegados. |
| Aislamiento | Administrador y dos coordinadores, curso compartido; preview, filas Firestore, originales, metadatos Storage, exportación y revocación con el mismo token. Casos permitidos y denegados. |
| Fuentes y procedencia | Cinco tipos de fuente, bytes privados inmutables, hash, nombre, tamaño, parser/época, mapeo, autor, versiones y auditorías. Reutiliza dominio y parsers aprobados. |
| Carga múltiple parcial | Lote válido + corrupto; publica el válido y retiene la incidencia del otro. Progreso por archivo y mapeo explícito. |
| Persistencia y reintentos | Cola Firestore, worker independiente del navegador, lease/token y hasta tres intentos. Recuperación con staging incompleto y fallo de Storage sintético hasta agotamiento. |
| Idempotencia y concurrencia | Doble envío/confirmación no cambia conteos; dos contenidos contra una versión esperada producen una sola sustitución y un conflicto explícito. |
| Publicación atómica | Manifiesto, puntero y estado en una transacción; no se publican filas parciales ni se duplican versiones activas. No hay agregados de etapa 04. |
| Cortes cerrados | Cierre durante procesamiento impide confirmación tardía; cierre repetido no cambia fecha. Nuevas fuentes no alteran snapshot anterior; revisión independiente con padre y motivo. |
| Reglas académicas | Se conservan las 168 regresiones anteriores, incluidos ciclos, épocas 1900/1904, bajas con identidad inválida, CSV acumulado y suplementos encadenados. Nuevas pruebas de bases/duplicados auditados y bajas/docentes por alcance. |
| Paginación | 202 alumnos sintéticos entre dos carreras: páginas 100+1 por carrera, sin duplicados ni identidades ajenas; exportación sobre versión fija. |
| E2E | Administración publica fuente; coordinador A carga lote, cierra navegador, recupera, revisa y exporta; B ve su carrera del mismo curso. Escritorio y móvil. |

Diseño detallado: [modelo](modelo-datos.md), [operación](operacion-etapa-03.md)
y [decisiones](decisiones.md). Las capturas y el audit están en
`docs/evidencias/etapa-03/`; contienen únicamente identidades sintéticas.

## Verificaciones

Entorno local: Windows, Node 22.22.0 y Java 21, proyecto demo con datos sintéticos.
La tabla recoge la repetición completa para las correcciones del PR #2.
La instalación limpia y el audit pertenecen a la entrega inicial; esta revisión
no cambia paquetes ni lockfile y conserva las 14 alertas documentadas.

| Comando ejecutado | Resultado local |
| --- | --- |
| `npm run lint` | Éxito, sin avisos de lint. |
| `npm run typecheck` | Éxito en aplicación y Functions. |
| `npm run test:unit` | 171 pruebas aprobadas, 7 archivos. |
| `npm run build` | Web y Functions compiladas; advertencia de bundle conservada. |
| `npm run test:emulators` | 28 pruebas aprobadas, 2 archivos; incluye las 11 de acceso anteriores. |
| `npm run test:e2e` | 18 pruebas aprobadas de Chromium, escritorio y móvil. |

Los enlaces del CI automático se consignan en el PR,
asociados a su último commit. `ci` debe exigir ambos jobs; una ejecución manual
no sustituye el evento `pull_request`. No se cambian workflow ni protecciones.

Las iteraciones detectaron y corrigieron: bucket incorrecto en una prueba, enlace
ESM de fixtures Admin bajo Playwright, y salida de bootstrap durante rollback
asíncrono. Se repiten las suites completas, sin omitir pruebas, cambiar dependencias
ni reducir las comprobaciones para obtener éxito.

## Correcciones verificadas del PR #2

| Conversación | Corrección y regresión |
| --- | --- |
| [Calificaciones inválidas](https://github.com/victoryama-wq/seguimiento-academico/pull/2#discussion_r4169189783) | Solo la incidencia de calificación permite publicación; las demás bloquean por defecto. Integración del archivo al worker, publicación, resultados y CSV para dos carreras: número, cero, guion, vacío y texto inválido conservados. Se comprueba aislamiento y rechazo de identidad vacía/estructura desigual. |
| [Confirmación independiente](https://github.com/victoryama-wq/seguimiento-academico/pull/2#discussion_r4169189791) | Casilla vinculada a trabajo y versión anterior; cambio de revisión la limpia. E2E en escritorio/móvil, para reportes y padrón, con dos sustituciones y respuestas reales retenidas/liberadas fuera de orden. Ninguna versión se publica accidentalmente. |
| [Resolución del nombre](https://github.com/victoryama-wq/seguimiento-academico/pull/2#discussion_r4169189800) | Contrato, API, worker y formulario administrativo usan el resolver aprobado. Pruebas de rechazo inicial, decisión autorizada, ID/ciclo incompatibles, suplantación de actor/versión, publicación y reenvío idempotente. Original, hash, motivo, actor real y versión auditados; se conserva el trabajo inválido. E2E de resolución y publicación desde la interfaz. |

La primera ejecución ampliada de emuladores detectó una omisión en la prueba:
la consulta del coordinador no seleccionaba carrera. Se corrigió la llamada,
manteniendo el rechazo del servidor, y se repitió íntegramente la suite.
El E2E móvil detectó que el texto largo de auditoría interceptaba el botón de
publicación. Se corrigió su ajuste de líneas en la interfaz y se repitió E2E
sin forzar clics, omitir pruebas ni aumentar tiempos para ocultar el problema.
Las evidencias nuevas son pruebas sintéticas reproducibles; las capturas adjuntas
de la entrega inicial no se presentan como capturas de estas correcciones.

## Límites y pendientes

- Únicamente emuladores con datos ficticios. Sin credenciales reales, conciliación
  privada, piloto Firebase o afirmación de preparación para producción.
- [14 alertas de dependencias](dependencias-y-bundle.md): 10 altas y 4 moderadas;
  no se ejecuta `audit fix`, ni degradaciones u overrides. El SDK Admin ahora tiene
  uso real en emuladores; requiere revisión específica antes de nube.
- Bundle web de aproximadamente 806 kB minificado, advertencia de Vite visible;
  carga diferida y medición en dispositivos pendientes.
- Aviso `MaxListenersExceededWarning` de la ruta Storage/teeny-request observado
  en emuladores; traza y valoración separadas en el informe de dependencias.
- Lote máximo 20/40 MiB, archivo 8 MiB, fila persistida 128 KiB y límites anteriores
  del parser. Sin ZIP de lotes o transferencia reanudable por bloques. Un envío
  no aceptado aún por servidor requiere volver a seleccionar el archivo.
- Mapeos y resoluciones avanzadas como JSON validado. Preview de exclusiones
  limitado a 100; originales/artefactos completos privados conservados.
- Una propuesta concurrente obsoleta no puede forzarse; requiere una propuesta
  revisada de contenido/mapeo. Calendario y fuentes se fijan al crear el corte.
- Prueba de carga 45/230 cursos, capacidad/costos, retención, respaldo/recuperación,
  IAM y proyecto/usuarios reales pendientes. No se borra historial automáticamente.
- No hay cálculo de indicadores, panel analítico, bitácora ni comparaciones.

No se necesitan archivos privados para reproducir las pruebas. Los artefactos de
compilación, node_modules, logs, traces y `.env` locales no se versionan; se generan
con el lockfile y comandos del README. La evidencia no es conciliación de expedientes.
