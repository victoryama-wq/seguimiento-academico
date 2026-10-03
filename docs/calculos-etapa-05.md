# Dos cortes sintéticos: cálculo inspeccionable

Fuente reproducible: `tests/fixtures/synthetic/stage05.ts`, sobre el fixture de
etapa 04. Todas las personas, contactos y reportes son ficticios.

| Persona / instancia | 21 septiembre (`metricas`) | 12 octubre (`posterior`) |
| --- | --- | --- |
| 000SINT01 / compartido | A=0; B=-; C=vacío | A2=0; B=7; C=vacío; Futura=- |
| 000SINT01 / solo-a | A=6 | A=9 |
| 000SINT02 / compartido | A=8; B=texto inválido; C=4 | Baja confirmada: notas 10 excluidas |
| 000NUEVO / compartido | No pertenece al universo anterior | A2=1; B=2; C=3; Futura=4 |
| 000BAJA | Baja excluida, con procedencia | Sigue excluida |

El primer corte conserva **D=7, N=4, G=1, V=1, E=1, Z=1** y dos estudiantes
institucionales únicos. Cobertura = 400/7 = **57,142857 %**. El segundo universo
completo tiene D=9, N=7, G=1, V=1, E=0, Z=1 y dos estudiantes únicos; esa cobertura
completa no se resta a la anterior para afirmar recuperación.

Administración aprueba expresamente cuatro correspondencias:

- compartido: A → A2, B → B, C → C.
- solo-a: A → A.

No se propone una equivalencia automática por nombre, orden o semejanza. Las
instancias de curso son las mismas y ambos cortes pertenecen al mismo ciclo.

El universo común contiene solo **000SINT01**, con tres observaciones del curso
compartido y una de solo-a:

| Corte | N | G | V | E | Z (dentro de N) | D | Cobertura |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| metricas | 2 | 1 | 1 | 0 | 1 | 4 | 50 % |
| posterior | 3 | 0 | 1 | 0 | 1 | 4 | 75 % |

Diferencia: **75 − 50 = +25 puntos porcentuales**. La actividad Futura y la
incorporación 000NUEVO no entran en D común. La baja 000SINT02 nunca se presenta
como recuperación. Se muestra también el cambio de grupo base de 000SINT01:
`27-1 LAF 24 01A` → `27-1 LAF 24 02A`, conservando versiones y especiales.

Coordinación A obtiene este universo común. Coordinación B ve la baja y la
incorporación de su carrera, pero **D común=0, cobertura=null, no comparable**.
No recibe la matrícula, notas ni bitácora de A. El curso `sin-archivo` aparece
como pendiente en ambos cortes, dentro del alcance de B.

Consultar 000BAJA conserva exclusiones/procedencia con D=0. `con_especial`
conserva 000SINT01; `solo_base` excluye a esa persona y sus demás inscripciones.
Un filtro por el grupo anterior aplicado a ambos cortes no encuentra universo
común tras el cambio de grupo; muestra no comparable, sin reinterpretarlo como
mejora o desaparición institucional.

El fixture de paginación adicional usa 26 actividades por persona en un curso
compartido: cada coordinación recibe 25+1 observaciones y exporta las 26 de su
alcance. Revisar la correspondencia no cambia una consulta/exportación que fija
el ID de la versión anterior.
