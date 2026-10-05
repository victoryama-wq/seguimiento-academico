# Evidencia sintética de revisión del PR #4

Generada por `npm run test:e2e`, en Chromium de escritorio y Pixel 7 emulado.
Datos de `tests/fixtures/synthetic/stage05.ts`; personas/correos ficticios.

| Captura (prefijos `escritorio-` y `movil-`) | Escenario comprobado |
| --- | --- |
| `revision-actividad-mapeada.png` | Coordinación A: A→A2 en compartido, A→A en solo-a; 2 observaciones, N=D=2, Z=1, cobertura 100 % en ambos cortes. El CSV contiene ambas parejas y no la identidad de B. |
| `revision-ausencia-fijada.png` | Primera sesión conserva D=0 y ausencia de correspondencias después de que administración guarde el mapeo en otra sesión. Página y CSV mantienen el nulo hasta actualización explícita. |
| `historial-coordinacion-b.png` | Variante sin fila Moodle posterior de B. Baja general en padrón con procedencia, sin recuperación ni denominador común, sin identidad de A. |

Las tablas móviles conservan desplazamiento horizontal para leer sus columnas.
Las pruebas comprueban contenido, descarga CSV y estados; las imágenes permiten
inspección visual. SHA y CI automático exactos se enlazan en el informe del PR.
No representan una validación con expedientes reales ni en nube.
