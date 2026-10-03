# Cálculo manual reproducible · etapa 04

Todos los datos son sintéticos. Generador: `tests/fixtures/synthetic/stage04.ts`.
Se importa por la API real, se procesa con el worker y se publica antes de medir.
No se inserta un resultado precalculado como origen del panel.

## Universo

Corte `metricas`, ciclo `27-1`, fecha civil `2026-09-21`.
Tres cursos esperados: `compartido`, `solo-a`, `sin-archivo`.
Dos reportes publicados; uno pendiente. En compartido se seleccionan A, B y C;
en solo-a se selecciona A. Futura y Total permanecen fuera del denominador.

| Estudiante | Carrera | Curso | A | B | C | N | G | V | E | Z | D |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 000SINT01 | laf-plan-1 | compartido | 0 | - | vacío | 1 | 1 | 1 | 0 | 1 | 3 |
| 000SINT02 | arq-plan-1 | compartido | 8 | texto | 4 | 2 | 0 | 0 | 1 | 0 | 3 |
| 000SINT01 | laf-plan-1 | solo-a | 6 | no seleccionada | no seleccionada | 1 | 0 | 0 | 0 | 0 | 1 |
| **Total** | | | | | | **4** | **1** | **1** | **1** | **1** | **7** |

- D = 4 + 1 + 1 + 1 = 7. Z=1 está incluido en N=4.
- Cobertura = 4/7 × 100 = 57,142857… %. Guiones = 1/7 × 100 = 14,285714… %.
- Compartido: 3/6 = 50 %. Solo-a: 1/1 = 100 %. Agregado correcto: 4/7;
  el promedio simple 75 % es incorrecto.
- Personas institucionales medidas: **2**, aunque hay **3** filas estudiante/curso.
- Coordinador A: N=2, G=1, V=1, E=0, Z=1, D=4; cobertura 50 %, guiones 25 %;
  una persona. Coordinador B: N=2, G=0, V=0, E=1, Z=0, D=3;
  cobertura 66,666… %, una persona.
- Ambos estudiantes tienen registro parcial en el universo de sus cursos.
  Filtrar «todas numéricas» sobre este universo deja D=0, no solo el curso solo-a.

000SINT01 conserva una inscripción especial y otra de inglés. La atribución es
al grupo base `27-1 LAF 24 01A`; no se infiere el grupo donde se imparte el curso.
La inscripción de inglés no elimina a la persona ni añade una observación.
000BAJA está confirmado de baja en este corte; sus tres notas no entran a D.
La fila `tup-d1@example.invalid` aporta evidencia de docente conocido, no estudiante.
Solo-a no trae docente: se muestra «Sin docente identificado», sin inferencias.

## Ausencia y filtros

Sin selección, D=0 y cobertura/guiones son `null`: la UI muestra «Sin actividades
seleccionadas». Sin archivo publicado, muestra «Sin archivos publicados».
Las celdas inválidas conservan estado `invalida`, texto original e incidencia.
Grupo, carrera, modalidad, turno, coordinación, actividad, docente y estudiante
filtran antes de sumar. «Caso especial» identifica personas con inscripción
especial conservada; no multiplica observaciones por inscripción.

El test de paginación usa 26 personas PAG0…PAG25, un curso y una actividad:
N=D=26, Z=1, G=V=E=0. Páginas de 25+1, cobertura 100 %, 26 personas distintas.
El CSV completo tiene 26 observaciones y usa la misma fotografía que ambas páginas.

## Trazabilidad y exportación

La respuesta publica el ID de fotografía, versiones de reporte, revisión de
selección, actividades, fuentes del corte, inscripciones y procedencia de exclusiones.
La administración ve también actor, motivo y revisión anterior de la selección.
El CSV incluye filtros, vista, fecha civil, definiciones, N/G/V/E/Z/D, porcentajes,
personas únicas, cursos y universo, agrupaciones, observaciones y exclusiones.
Texto susceptible de fórmula recibe apóstrofo; el original exacto permanece
en el dato estructurado y almacenamiento privado.
