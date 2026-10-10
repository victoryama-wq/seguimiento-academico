# Seguimiento académico · etapa 06

React, TypeScript estricto y Firebase Emulator Suite, en español. La etapa 02
conserva parsers ODS/XLSX/CSV, normalización, clasificación y resoluciones auditadas.
La etapa 03 añade acceso institucional, fuentes privadas y carga persistente por
lotes. La etapa 04 añade panel autorizado, selección versionada de actividades,
conteos y exportaciones reproducibles. [Entrega](docs/entrega-etapa-04.md) y
[cálculos manuales](docs/calculos-etapa-04.md). La etapa 05 añade calendario, fotografías
de cierre, comparación sobre universo común explícito y bitácora atribuible.
[Operación e interpretación histórica](docs/operacion-etapa-05.md),
[cálculos de dos cortes](docs/calculos-etapa-05.md) y
[entrega de etapa 05](docs/entrega-etapa-05.md).

La etapa 06 añade piloto sintético reproducible de 45/230 cursos, mediciones,
recuperación y preparación revisable de publicación. Consulte la
[entrega y aceptaciones](docs/entrega-etapa-06.md),
[operación y staging](docs/operacion-etapa-06.md),
[costos y retención propuestos](docs/costos-y-retencion-etapa-06.md) y
[diagnóstico actualizado de dependencias](docs/dependencias-etapa-06.md).
El entorno real de pruebas es [indicadores-academia](https://indicadores-academia.web.app),
aislado de producción. [Despliegue por SHA, pruebas y limitaciones](docs/validacion-nube-ejecucion.md).
El modo demo sigue conectado exclusivamente a emuladores. La aceptación operativa
corresponde al usuario: [guía y procedimiento privado de acceso](docs/aceptacion-operativa.md).

Coordinaciones: [seleccionar corte, subir, revisar, confirmar y consultar](docs/flujo-coordinadores.md).
Administración conserva la preparación de fuentes, decisiones y avances. Las
pruebas automáticas no sustituyen ni publican los archivos reales del propietario.

El PR #5 incorpora [avance explícito y revisión acumulativa](docs/avance-explicito.md):
corte Escolarizado y unidad Ejecutivo/Virtual independientes de fechas, actividades
posteriores conservadas y advertencias antes de sustituir notas por vacío/guion.
Se mantienen DEC-01–36, originales privados y cálculos históricos. El informe
enlazado conserva las comprobaciones locales; el informe de ejecución cloud
registra por separado las pruebas reales y sus pendientes.

## Arranque y comprobaciones

Node 22.12 o posterior de la rama 22, npm y Java 21. Internet para instalar el
lockfile, Chromium y los emuladores por primera vez. Sin cuenta Firebase ni secretos.

```sh
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run build
npx --no-install playwright install chromium
npm run test:emulators
npm run test:e2e
npm run test:pilot
npm run verify:hosting
```

Los comandos de emuladores, E2E y piloto son **secuenciales** y arrancan entornos limpios con
`demo-seguimiento-ci`. No reutilizan procesos ni credenciales del equipo. Puertos:
Auth 9099, Firestore 8080, Storage 9199, Functions 5001, hub 4400 y Vite E2E 4173.
En Linux CI se instala Chromium con `--with-deps`. El check `ci` exige calidad e
integración; el workflow no se relajó y no despliega.

Para explorar: `npm run build`, `npm run emulators` y, en otra terminal, `npm run dev`.
`.env.example` documenta los valores; no es necesario copiarla. Los emuladores
apagados producen un error recuperable. No hay fallback a nube.

## Acceso y fuentes

La interfaz inicia sesión con Firebase Auth; no permite seleccionar un rol al
registrarse. `memberships/{uid}` es la autoridad del servidor. Administración
asigna o revoca roles/carreras a cuentas existentes. Un claim o campo enviado por
el navegador no concede privilegios. El procedimiento privilegiado inicial y la
preparación sintética están en [operación de etapa 03](docs/operacion-etapa-03.md).

Administración publica padrón, catálogo, suplemento, bajas y excepciones; configura
calendarios, cursos esperados y cortes. Cada corte fija sus versiones de fuentes.
El coordinador envía hasta 20 reportes por lote y revisa únicamente sus carreras.
Un curso compartido se procesa una vez; su original es privado para administración
y procesador. Confirmar una nueva versión requiere validar y aceptar expresamente
la sustitución. Las versiones anteriores y cortes cerrados se conservan.

Los trabajos aceptados continúan en Functions al cerrar el navegador. La interfaz
muestra estados por archivo, permite recuperar trabajos, paginar y exportar una
carrera de una versión fija. Incidencias ambiguas bloquean publicación hasta una
corrección o mapeo auditado; nunca se adivinan afiliaciones.

## Panel y universo medido

En Panel, elegir ciclo/corte y abrir «Cursos y actividades». Administración marca
las actividades del reporte publicado y registra el motivo; puede identificar
docentes mediante asignación explícita. Los totales y categorías no son opciones.
Guardar conserva revisión y actor; un reporte sustituto requiere revisar de nuevo
su selección. Los cortes cerrados no permiten cambiarla.

Resumen y detalle usan únicamente versiones publicadas y carreras autorizadas.
Cambiar vista, filtrar y abrir detalle conserva la fotografía; «Actualizar
versiones» consulta las publicaciones y selecciones actuales. Exportar entrega todo
el alcance filtrado de esa misma fotografía, aunque la tabla esté paginada.
Sin archivo o sin selección se informa ausencia de datos, sin porcentajes ficticios.
Las fórmulas y el fixture de referencia están en [cálculos](docs/calculos-etapa-04.md).

## Estructura

| Ruta | Responsabilidad |
| --- | --- |
| `src/domain` | Reglas académicas puras y contratos Zod de operaciones. |
| `src/importing` | Parsers Node compartidos con Functions, sin reglas duplicadas en UI. |
| `src/infrastructure` | SDK con modo demo/emuladores o staging verificado, sin fallback, y validación de respuestas. |
| `src/ui` | Acceso, administración, carga, previsualización, panel y exportación. |
| `functions/src` | Autorización, trabajos, staging, transacciones y almacenamiento privado. |
| `scripts/bootstrap-admin.mjs` | Asignación inicial privilegiada, solo en entorno demo. |
| `tests/unit`, `tests/emulators`, `tests/e2e` | Dominio/parser, permisos/transacciones y tres identidades sintéticas. |
| `tests/fixtures/synthetic` | Fuentes ficticias reproducibles; ningún expediente real. |

## Evidencia y límites

- [Entrega y criterios de etapa 04](docs/entrega-etapa-04.md), [modelo implementado](docs/modelo-datos.md)
  y [decisiones](docs/decisiones.md).
- [Dependencias](docs/dependencias-etapa-06.md) y [bundle de esta entrega](docs/avance-explicito.md):
  pendientes conservados, sin actualizaciones automáticas ni aumento del umbral de Vite.
- Conciliación privada y piloto sintético 45/230 documentados en etapa 06. Pendientes:
  aceptación operativa institucional, usuarios reales, costos medidos, políticas de
  recuperación/retención aprobadas y capacidad productiva. La evidencia cloud es
  sintética; no se cargaron los libros privados ni se desplegó producción.
- El mapeo se confirma como JSON por archivo; ZIP de lotes no está implementado.
  Las correspondencias históricas también requieren revisión explícita. No se
  infiere equivalencia entre ciclos ni entre instancias de curso diferentes.
- Guardar fuentes privadas fuera del repositorio. Se ignoran `private/`,
  `local-data/`, `.env`, credenciales, libros, logs y resultados temporales.
  Revisar el diff antes de publicar; `.gitignore` no sustituye esa revisión.

La rama se entrega mediante PR independiente. No se declara lista para producción.
