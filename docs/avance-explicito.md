# Avance explícito y revisión acumulativa — PR #5

Continuación de la integración de reportes sobre la referencia revisada
`96f6526f9fb75e57747e4877223e9052e9d572e2`. No modifica DEC-01–36,
clasificaciones, exclusiones ni originales. Sin merge ni despliegue.

## Decisión y operación

Cada corte nuevo de la interfaz exige tres elecciones explícitas:

| Modalidad principal | Selección | Unidades incluidas |
| --- | --- | --- |
| Escolarizado | Corte 1, 2 o 3 | 1–2, 1–5 o 1–7 |
| Ejecutivo | Unidad 1 a 7 | 1 hasta la elegida |
| Virtual | Unidad 1 a 7, independiente | 1 hasta la elegida |

La API valida los rangos. No deduce el avance de archivos, actividades encontradas,
fechas o cantidad de cargas. No requiere primera semana vencida. La carga parcial
no exige todas las unidades, alumnos o archivos. La principal conciliada, incluida
C.A., determina la modalidad. La impartición sigue expresamente no determinada.
Las actividades adicionales se incluyen solo con calificación numérica, incluido cero.
Totales/subtotales no son actividades. Guion no demuestra falta de entrega.

Administración crea el corte en **Ciclos y cortes**. La fecha operativa es opcional;
si se omite, el servidor registra la fecha civil actual de America/Cancun. El avance
queda en `cut.progress`, política `explicit-progress-v1`, con versión, autor real,
fecha/hora automática, motivo y referencia anterior; cada revisión queda en
`progressHistory`. Se puede editar explícitamente desde **Historial y seguimiento**.
El planificador crea fechas operativas cada 21 días y utiliza las tres selecciones
indicadas, sin incrementarlas automáticamente. Cada corte abierto puede versionarlas.

Solo administración modifica el avance. La operación compara la versión revisada;
no sobrescribe una modificación simultánea ni permite cambiar un corte cerrado.
Cada trabajo conserva la versión de avance aceptada. Si cambia antes de publicar,
se exige volver a validar y revisar el original. Las cargas nunca modifican el avance.

`academicDate` conserva la fecha de referencia de las fuentes al crear el corte;
editar después su fecha operativa no cambia afiliaciones o exclusiones por fecha.
La auditoría usa el reloj del servidor, no el navegador ni la fecha escrita por el usuario.
Esta separación no cambia fechas de inscripción ni decisiones del padrón.

## Compatibilidad, historial y concurrencia

Los cortes anteriores sin `progress` continúan calculándose con su política original,
incluido `principal-modality-v1` cuando corresponda. No se migran silenciosamente.
Las llamadas históricas que crean cortes con fecha siguen disponibles; la interfaz
crea cortes explícitos. Para trabajar con la política nueva se crea un corte nuevo
o una revisión atribuible de un cerrado, siguiendo el procedimiento ya existente.
No se recalculan fotografías antiguas con la nueva política.

La selección, fuentes, trabajos y avance integran la fotografía transaccional del
cierre. Consultas paginadas y CSV conservan la versión de avance de su snapshot;
para ver cambios posteriores hay que actualizar versiones. Los permisos vigentes
se comprueban en servidor, también al consultar versiones anteriores.

Una observación vigente se identifica por matrícula normalizada, instancia, ciclo y
actividad dentro del corte. Se conservan alumnos y columnas ausentes. Una celda
presente actualiza el valor, aunque esté vacía o contenga guion. Los originales,
publicaciones anteriores y versiones por celda conservan la procedencia.
La revisión muestra los valores anterior/nuevo y sus versiones (que identifican
el archivo original privado), y resume valores nuevos, modificados, sin cambios,
ausentes conservados y actividades nuevas dentro del alcance autorizado.
Los numéricos sustituidos por vacío/guion tienen una advertencia destacada.
La información ausente no se contabiliza como un vacío nuevo.

Los totales del resumen se calculan sobre todo el alcance; el detalle se pagina.
Los detalles de cambios pertenecen a esa propuesta y no se arrastran como cambios
nuevos en una carga posterior. Cada versión conserva su revisión inmutable.
La confirmación de sustitución sigue ligada al trabajo y su predecesor. El servidor
compara también la publicación vigente; otra publicación posterior a la previsualización
invalida la propuesta. Reenviar/publicar/reintentar un trabajo ya publicado es
idempotente y no devuelve el puntero a una versión antigua. Revalidar un publicado
ya sustituido se rechaza; las propuestas no publicadas obsoletas requieren revisión
explícita de una nueva validación antes de poder publicarse.

## Cálculos sintéticos inspeccionables

Fixture: tres personas, una Escolarizado, una Ejecutivo y una Virtual con principal
C.A.; una baja adicional queda excluida. Las cuatro unidades se almacenan para cada
persona. Escolarizado corte 1, Ejecutivo U3, Virtual U2:

| Persona sintética | U1 | U2 | U3 | U4 | Incluidas | N | D | Z |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 000ESC | 1 | 2 | 3 | 4 | 1–2 | 2 | 2 | 0 |
| 000EJE | 0 | 2 | 3 | 4 | 1–3 | 3 | 3 | 1 |
| 000VIR | 1 | 2 | 3 | 4 | 1–2 | 2 | 2 | 0 |

Total N=7, D=7, Z=1; G=V=E=0; tres personas; cobertura 100 %. Coordinación A
ve N=D=5, B ve N=D=2. U4 no contribuye al numerador ni al denominador.
Cambiar la fecha operativa a 2025-01-01 conserva exactamente estos resultados.

Actualización: sustituir U1 por vacío y U2 por guion para 000EJE y 000VIR deja
N=3, G=2, V=2, E=0, Z=0, D=7, cobertura 3/7 = 42,857142… %.
La revisión de A muestra dos pérdidas numéricas; no expone las dos de B.
Seleccionar explícitamente Virtual U4 incorpora sus dos valores conservados:
N=5, G=2, V=2, E=0, Z=0, D=9; cobertura 5/9 = 55,555555… %.
Una consulta anterior permanece en D=7 al paginar/exportar su snapshot.

Segundo caso: 000EJE U1=1/U2=2 y 000VIR U1=5/U2=6. Actualizar solo
000EJE a U1=7/U2=8 y agregar U3=0, en un archivo o tres, produce el mismo
estado: N=D=5, Z=1, cobertura 100 %. Se conservan ambas notas de 000VIR.
Reenviar los archivos iniciales no devuelve notas ni elimina U3.

Pruebas públicas: `tests/unit/explicit-progress.test.ts`,
`tests/emulators/explicit-progress.test.ts`, `tests/e2e/explicit-progress.spec.ts`;
se conservan todas las regresiones anteriores de fechas, bajas, decisiones,
aislamiento, acumulación y cierres.

## Verificación ejecutada

Windows, Node 22.22.0 y Java 21; emuladores aislados de `demo-seguimiento-ci`.

| Comando | Resultado local final |
| --- | --- |
| `npm run lint` | Aprobado |
| `npm run typecheck` | Aprobado, cliente y Functions |
| `npm run build` | Aprobado, advertencia de bundle conservada |
| `npm run test:unit` | 221 aprobadas, 15 archivos |
| `npm run test:emulators` | 74 aprobadas, 11 archivos |
| `npm run test:e2e` | 38 aprobadas, escritorio y móvil |
| `npm run verify:hosting` | Cinco archivos públicos del build |
| `npm run test:pilot` | Dos casos aprobados: 45 y 230 cursos |

Piloto completo: 287,98 segundos de suite local, con las aserciones existentes
de exactitud, aislamiento, reintentos, exportación, comparación y cierre. Se
conservan advertencias `MaxListenersExceededWarning` del entorno SDK/emulador;
no se aumentaron sus límites ni se desactivaron comprobaciones. Son mediciones
locales, no garantías de capacidad ni tiempos en nube.

Las primeras regresiones nuevas localizaban la matrícula comparándola con el
campo original, que conserva el correo completo. Se corrigieron para emplear el
normalizador del dominio; no se alteraron los originales. Un primer intento unitario
agotó el tiempo de una prueba existente que inicia un proceso auxiliar; las dos
repeticiones completas posteriores pasaron con el mismo límite. E2E detectó un
desbordamiento móvil del identificador de avance y un clic interceptado en la revisión
larga: se corrigió el ajuste de texto y se acotó la tabla mediante desplazamiento
horizontal. La suite completa pasó sin forzar clics ni ampliar tiempos.

Revalidación privada realmente repetida con el adaptador actual: 2.873 inscripciones,
2.665 personas, **2.661 principales, cuatro excluidas, 75 revisiones y cero pendientes
o discrepancias**. Comparación estructural contra el paquete aprobado: originales
y decisiones conservados. Las fuentes y el detalle permanecen en `private/`.
El escaneo de 145 archivos públicos de texto no encontró coincidencias con valores
privados ni patrones de credenciales. Ninguna suite pública necesita esos archivos.

Capturas E2E sintéticas revisadas: revisión de cambios en
[escritorio](evidencias/etapa-06/revision-acumulativa-escritorio-sintetica.png) y
[móvil](evidencias/etapa-06/revision-acumulativa-movil-sintetica.png); panel con U4
conservada fuera del cálculo en
[escritorio](evidencias/etapa-06/avance-explicito-escritorio-sintetico.png) y
[móvil](evidencias/etapa-06/avance-explicito-movil-sintetico.png).
Este E2E usa un segundo fixture: en el alcance A, una persona Ejecutivo queda con
N=1/G=1/V=1/E=0/Z=0/D=3, cobertura 33,33 %. El alcance Virtual no aparece.

SHA final y CI automático reconocido se registran en el informe del PR para no
crear una referencia circular dentro del propio commit.

## Pendientes separados

Continúan dependencias, tamaño del bundle, conciliación/piloto institucional y
validación de permisos, recuperación y capacidad en Firebase real. No se modifican
dependencias, límites, workflow ni protecciones. Los emuladores no acreditan tiempos
productivos. Los manifests y datos privados no son necesarios para las suites públicas.

Bundle actual: `dist/assets/index-BZunIsxt.js`, **826.031 bytes** minificados,
**246,83 kB gzip** según Vite. Supera el aviso de 500 kB; puede aumentar descarga,
parseo y ejecución inicial en dispositivos o redes lentos. Se conserva el umbral.
Diagnóstico previo de dependencias: 16 paquetes afectados (12 altos y cuatro
moderados); no se cambiaron dependencias ni se presenta un audit nuevo en esta entrega.
