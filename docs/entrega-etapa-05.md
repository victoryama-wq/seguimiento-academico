# Entrega de etapa 05 · historial y seguimiento

Base: merge `d3718516c4cfca64d97469ee249aeb2ba3f3211c`, verificado como ancestro
de main sincronizado. Árbol inicial limpio. Rama exclusiva:
`etapa-05-historial-y-seguimiento`. SHA final y ejecución automática exacta se
registran en el PR de esta entrega, evitando una referencia circular en el commit.

## Alcance y criterios

| Criterio | Implementación y evidencia |
| --- | --- |
| Calendario | Fechas civiles cada 21 días, ajustes atribuibles previos a carga, pendientes autorizados; sin mensajes. |
| Cierre coherente | Manifiesto privado + afiliaciones materializadas; comprobación transaccional antes de activar el cierre. Carrera entre cierre/publicación/selección probada. |
| Pasado y revisiones | Fuentes, reportes, mapeos, selecciones y originales conservados. Revisión padre/motivo/autor/fecha; legado incompleto no recalculado automáticamente. |
| Comparación | Correspondencia explícita uno a uno por instancia/actividad; intersección de personas autorizadas; N/G/V/E/Z/D y diferencia en puntos porcentuales. |
| Cambios de universo | Bajas, incorporaciones, afiliaciones, actividades sin pareja, exclusiones y falta de archivo fuera del cálculo común. |
| Bitácora | Contexto académico inicial fijo, abiertos/cerrados, autor/registro/contacto separados, cadena inmutable, CAS y reintentos sin duplicados. |
| Permisos | Autoridad vigente de membresías, carreras históricas de filas/casos, acceso cruzado denegado, IDs/cursor/exportaciones comprobados. |
| Interfaz | Español, navegación por teclado, carga/vacío/error, administrador y dos coordinadores en escritorio/móvil. |

[Operación y política histórica](operacion-etapa-05.md),
[cálculo manual](calculos-etapa-05.md), [decisiones](decisiones.md) y
[modelo](modelo-datos.md). Archivos nuevos principales: dominio/contrato history,
Functions history, UI History y fixtures/suites de etapa 05.

## Resultados locales

Windows, Node 22.22.0, Java 21, Firebase demo completo; datos sintéticos.

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Aprobado, sin relajar advertencias. |
| `npm run typecheck` | Aprobado, web y Functions. |
| `npm run build` | Aprobado; advertencia de bundle documentada. |
| `npm run test:unit` | 185 aprobadas / 9 archivos. |
| `npm run test:emulators` | 53 aprobadas / 7 archivos, 152,72 s de Vitest. |
| `npm run test:e2e` | 30 aprobadas en escritorio/móvil, repetición final completa tras revisión visual (4,5 min). |

Los primeros intentos detectaron serialización de propiedades opcionales en la
fotografía, un fixture con columna sin mapear y una aserción de CSV que no usaba
la forma normalizada de matrícula. Se corrigieron y se repitieron las suites;
no se omitieron pruebas ni se relajaron workflow o comprobaciones. El historial
de cada intento queda en logs locales ignorados; CI publica sus propios logs.

Ejemplo: primer universo completo D=7, N=4 y dos personas. La comparación conserva
solo cuatro observaciones comunes de una persona: 50 % → 75 %, **+25 puntos**.
La baja del otro estudiante y la actividad nueva no contribuyen a esa diferencia.
Coordinación B recibe “no comparable” y su propia trazabilidad, sin datos de A.

## Evidencia visual y CI

Capturas sintéticas de escritorio y móvil se adjuntan en
`docs/evidencias/etapa-05/`: comparación administrativa, bitácora de coordinación A
y ausencia de universo comparable en coordinación B. El PR enlaza la ejecución
automática `pull_request`, SHA exacto y check `ci` (quality + integration).
Una ejecución manual no sustituye esa evidencia.

## Limitaciones conservadas

- Sin expedientes privados ni conciliación real. Sin piloto 45/230, tiempos/costos
  medidos en nube, usuarios reales, política de retención/recuperación aprobada.
- Guardas de emuladores demo activas: no se declara validación de producción.
- 14 alertas históricas de dependencias pendientes de remediación revisada; sin
  cambios de paquetes/lockfile ni audit fix. Bundle y aviso de SDK Storage siguen
  en [informe de dependencias y bundle](dependencias-y-bundle.md).
- Correspondencias entre ciclos o instancias distintas no se presuponen. Las
  fechas con trabajos aceptados requieren una revisión; las versiones de fuentes
  de cortes planificados quedan fijadas al crearlos y deben revisarse antes de carga.
- Procesamiento/agregación en servidor acotados, sin ensayo de capacidad a escala.
  La creación de un objeto preparado que pierde una carrera de cierre puede dejar
  un objeto privado sin puntero; no se borra sin política de retención.
- Sin merge, despliegue, cambio de protecciones, recordatorios ni etapa 06.
