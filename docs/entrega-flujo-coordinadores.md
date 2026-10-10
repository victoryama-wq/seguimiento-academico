# Entrega: recorrido de coordinaciones

Continuación del PR #5 sobre `acdfcfcb0e7817d66421e7963ac1937faca7c470`.
Guía operativa: [flujo de coordinadores](flujo-coordinadores.md).

## Implementación

- Corte autorizado con nombre, ciclo, estado y avance en lectura; selección por
  usuario en `sessionStorage`, reutilizada al abrir el panel.
- Originales múltiples con lectura/revisión visual reutilizada de Administración.
  Alta inequívoca de curso desde el servidor sin carga administrativa previa.
  Cola administrativa para ambigüedades; ningún rol administrativo en navegador.
- Propuestas con ámbito inmutable y revisión vinculada a versión/permisos. Las
  filas y exclusiones publicadas de otros ámbitos se conservan; la nueva carga
  solo aporta filas atribuibles al ámbito del trabajo. Originales completos privados.
- Trabajos persistentes, recuperación, revalidación, reintentos y rechazo de
  publicaciones obsoletas. Confirmación por propuesta y acceso directo al panel.
- Reutilización de columna de identidad por curso/ciclo/ámbito, encabezado exacto
  y estructura cuando es necesario. Las decisiones institucionales de actividades
  siguen siendo administrativas. No cambian DEC-01–36 ni reglas de calificación.
- Previsualizaciones paginadas de todas las carreras autorizadas sin pedir IDs.
  Tablas desplazables con matrícula y principal legibles; diagnóstico separado.

## Cálculo sintético inspeccionable

Fixture: tres personas activas (Escolarizado, Ejecutivo y Virtual), una exclusión
atribuida a A y una matrícula desconocida retenida para Administración. El reporte
tiene U1, U3, U4 y total del curso. Corte Escolarizado 1; Ejecutivo/Virtual hasta U3.

| Ámbito                      | Observaciones incluidas                               |   N |   G |   V |   E |   Z |   D | Cobertura |
| --------------------------- | ----------------------------------------------------- | --: | --: | --: | --: | --: | --: | --------: |
| A inicial                   | Escolarizado U1=0; Ejecutivo U1=5, U3=6               |   3 |   0 |   0 |   0 |   1 |   3 |     100 % |
| B después de su publicación | Virtual U1=8, U3=9                                    |   2 |   0 |   0 |   0 |   0 |   2 |     100 % |
| A con actualización parcial | Ejecutivo U1 pasa de 5 a 0; demás valores conservados |   3 |   0 |   0 |   0 |   2 |   3 |     100 % |

U4 se guarda para después. Escolarizado no cuenta U3 en corte 1. U2 no existe en
el archivo y no genera celdas ficticias. Total=999 nunca es una actividad. La
publicación parcial de A no modifica ningún valor de B. Las pruebas previas de
guion, vacío, inválido y sus denominadores permanecen; las cargas institucionales
de referencia se ejecutan como Administración para conservar sus cálculos originales.

## Verificación reproducible

Ejecutar `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:unit`,
`npm run test:emulators` y `npm run test:e2e`, con Node 22 y Java 21. Los emuladores
solo utilizan `demo-seguimiento-ci`; no comparten las fuentes del piloto real.

Las regresiones nuevas están en `tests/emulators/coordinator-intake.test.ts` y
`tests/e2e/coordinator-intake.spec.ts`; se mantienen y adaptan los recorridos
existentes de avance, principal y decisiones auditadas al nuevo control visual.
No se reducen comprobaciones académicas, suites, límites ni protecciones.

Después de un build/despliegue limpio por SHA, la prueba cloud se ejecuta con:

```powershell
$env:CONFIRM_STAGING_PROJECT='indicadores-academia'
node scripts/validate-staging-coordinators.mjs
```

Requiere la sesión Firebase autorizada y cuentas sintéticas ya existentes, con
credenciales únicamente en `private/`. El verificador busca un ciclo nuevo libre,
no sustituye fuentes de ningún ciclo y conserva las carreras anteriores de las
cuentas sintéticas. No crea cuentas reales. Compara hashes canónicos de todos los
documentos académicos preexistentes y sus punteros; la evidencia completa queda
en `private/cloud-runs/`. El PR registra resultados realmente ejecutados, SHA,
CI automático y despliegue; la mera existencia del script no acredita ejecución.

## Límites y recuperación

Las cargas coordinadas antiguas sin ámbito deben revalidarse antes de publicar;
sus originales, versiones y cortes cerrados se conservan. Dos coordinadores que
actualizan simultáneamente un curso compartido deben revalidar la propuesta que
quedó obsoleta; no se sobrescriben silenciosamente los datos del otro.

Los casos sin atribución verificable se conservan para revisión administrativa;
no se incorporan mediante una publicación de coordinación. Una revisión del
original completo corresponde a Administración y requiere confirmación explícita.

Una reversión de interfaz puede usar una versión de Hosting conocida. No revertir
el backend a una versión sin control por ámbito con trabajos coordinados activos:
requiere revisar la compatibilidad y suspender las cargas antes de decidir una
corrección. La recuperación habitual revalida originales; nunca elimina fuentes,
reinicia el entorno ni restaura silenciosamente valores sobre publicaciones nuevas.

Permanecen pendientes la aceptación del propietario, identidad/carreras del
coordinador real, validación productiva y los pendientes previos de dependencias,
bundle, conciliación privada y recuperación/capacidad a escala documentados en
las entregas anteriores. Ninguna medición local constituye garantía de nube.

## Resultados locales de esta entrega

Las seis verificaciones terminaron con éxito el 10 de octubre de 2026: lint,
tipos, build, 252 pruebas unitarias, 92 de emuladores y 46 E2E. La regresión móvil
comprobó también el ancho del documento al desplegar un diagnóstico largo;
se reutilizó el contenedor adaptable existente, sin ampliar tiempos de prueba.

Capturas únicamente sintéticas: [resultados A](evidencia/coordinadores/resultados-a-sinteticos.png)
y [revisión B en móvil](evidencia/coordinadores/revision-b-movil-sintetica.png).
