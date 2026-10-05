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

## Regresiones de revisión del PR #4

El filtro `activity=A` identifica la actividad **del corte anterior**. Se resuelve
por instancia: compartido A→A2 y solo-a A→A. Para 000SINT01 hay dos observaciones:
0→0 y 6→9. En ambos extremos N=2, G=V=E=0, Z=1, D=2, cobertura=100 %;
diferencia=0 puntos. Filtrar además compartido conserva solo 0→0, D=N=Z=1.
Un ID posterior A2 usado como filtro anterior no tiene pareja: D=0 y cobertura
nula. No se reutiliza la correspondencia de otro curso con el mismo ID.

La variante `omitWithdrawnRow` elimina 000SINT02 del CSV posterior y conserva
su baja en fuentes administrativas. El historial reconoce la baja general del
padrón con su versión/fila; el universo común y el cálculo +25 puntos no cambian.
Consultar esa persona como coordinación B da D=0 en ambos extremos, sin mejora
calculada. A no recibe su identidad. Con `omitWithdrawalEvidence` tampoco existe
evidencia de baja: la misma ausencia se describe como fuera del universo.

En el fixture de 26 actividades, una consulta inicial sin correspondencias tiene
D=0 y 52 cambios de actividades sin pareja (26 por extremo). Si otra sesión crea
el mapeo, la consulta fijada con `mappingId: null` conserva esos cambios al paginar
y exportar. Una actualización explícita obtiene 26 observaciones, paginadas 25+1.
Los IDs no nulos siguen fijando su versión aunque administración la revise.
