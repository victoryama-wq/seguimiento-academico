# Fuentes sintéticas de parser

Los libros `1 Curso Sintético 27-1.ods` y `.xlsx`, el `.csv` equivalente y
`padron.xlsx` no contienen personas reales. Identidades `SINT` y dominio reservado
`example.invalid`; docente ficticio `TUP-D7`. Incluyen cero, guion, vacío, texto
inválido, dos tareas distintas, actividad futura, categoría, total y metadato de
descarga. El padrón incluye matrícula textual con ceros y fecha serial 46265
(31/08/2026, época 1900).

Generador: `node scripts/generate-parser-fixtures.mjs`. Los binarios se versionan
y CI los lee directamente. Los asserts tienen resultados explícitos, no comparan
solo ida/vuelta del parser. CSV se escribe como texto independiente. Las pruebas
añaden variantes en memoria y un ODS mínimo construido sin SheetJS.

No representan conciliación de archivos piloto reales ni una plantilla única de
actividades. Las fuentes reales y las tres bajas informadas siguen pendientes.
