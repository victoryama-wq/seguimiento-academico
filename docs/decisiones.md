# Registro de decisiones

Este registro se amplía en cada PR. Distinguir reglas académicas confirmadas, propuestas técnicas y asuntos pendientes; no convertir una suposición en requisito aprobado.

| Fecha | Decisión | Estado y motivo |
| --- | --- | --- |
| 2026-10-01 | Implementación por Codex y revisión por etapas mediante PR. | Solicitado por el usuario; reduce el alcance de cada entrega. |
| 2026-10-01 | CI significa integración continua en este paquete. | Interpretación declarada; también se incluye AGENTS.md para instrucciones permanentes. |
| 2026-10-01 | React/TypeScript y Firebase como base de los prompts. | Base tecnológica de trabajo; comprobar compatibilidad e infraestructura en etapa 01. |
| 2026-10-01 | Pruebas automáticas con datos sintéticos y emuladores. | Permite validar sin publicar expedientes ni requerir un proyecto real. |
| 2026-10-01 | Repositorio, proyecto de destino y despliegue. | Pendientes de identificar; este paquete no crea infraestructura. |

Para cada nueva decisión registrar fecha, contexto, alternativas pertinentes, decisión, impacto sobre datos/permisos/historial y vínculo al PR. Las reglas académicas del usuario se conservan en docs/requisitos.md.

## Etapa 01 · 2026-10-01 · decisiones técnicas

- **Base local nueva:** la inspección encontró solo el paquete de instrucciones,
  sin aplicación ni repositorio Git. Se conserva íntegro el paquete y se prepara
  una rama local de etapa 01. Remoto y PR pendientes de destino.
- **Workspace:** web en raíz, Functions como workspace npm, un solo lockfile.
  Dominio e infraestructura separados de UI; no se instala un parser todavía.
  Alternativa descartada: dividir cada carpeta en un paquete sin consumidores.
- **Node 22 y Java 21:** base común con CI. Dependencias directas exactas y árbol
  resuelto en lockfile; no se modifica la instalación global del equipo.
- **Contrato inicial:** Zod estricto en entidades iniciales y respuesta de API;
  las matrículas nunca se coaccionan a número y las fechas académicas son texto
  civil. Esquema no equivale a validación de relaciones o publicación transaccional.
- **Acceso cerrado:** Firestore/Storage deniegan todas las operaciones cliente.
  Solo se permite diagnóstico técnico sin datos en Functions y únicamente bajo
  emuladores demo completos. La etapa 01 admite esta base restrictiva; permisos
  útiles por coordinación requieren implementación y casos permitidos/denegados
  posteriores. No se presenta este cierre como autorización operativa terminada.
- **Entorno explícito:** configuración compartida de puertos desde `firebase.json`,
  conexiones explícitas de cada SDK, ejecutores que rechazan proyectos reales y
  puertos ocupados. Perfil temporal de CLI y ruta ADC deshabilitada evitan heredar
  credenciales locales. Sin fallback a nube ni dependencia de un `.firebaserc` privado.
- **Interfaz vacía:** no activar automáticamente el ciclo de ejemplo ni usar 230
  como denominador. Navegación a estados explicativos, sin cargas o roles ficticios.
- **Modelo futuro:** versiones inmutables, personas/inscripciones separadas,
  proyecciones por coordinación y publicación mediante control de versión. Índices
  compuestos propuestos se implementarán junto a consultas reales y sus pruebas.

## Reglas académicas y configuración pendientes

Sin nuevas reglas académicas. Se conserva `docs/requisitos.md` sin modificaciones.
Continúan pendientes calendario concreto, actividades por corte, catálogo completo,
fuentes privadas, excepciones auditadas, fechas de baja cuando existan, escalas y
umbrales. Ningún vacío se resolvió inventando datos. No se implementó etapa 02.

Evidencia y vínculo de entrega: `docs/entrega-etapa-01.md`; PR pendiente de remoto.

## Etapa 02 · 2026-10-02 · decisiones técnicas

- Rama exclusiva desde `origin/main` en `518f09a515d197ef051eb627137fc0ca1a1f252a`.
  La etapa 01 ya está en GitHub con CI aprobado y main protegida. Los comentarios
  anteriores sobre remoto pendiente describen el estado histórico de etapa 01.
- Parser Node SheetJS CE 0.20.3 del CDN oficial, fijado en lockfile; alternativa
  ExcelJS descartada por falta de ODS. Licencia, mantenimiento, avisos y límites
  documentados en `dependencias-y-bundle.md`. No se añade al bundle del navegador.
- Lectura acotada previa a interpretar hojas: 8 MiB, 32 MiB expandidos, 256 entradas
  ZIP, 10 000 filas, 256 columnas, 200 000 celdas. Son límites técnicos iniciales,
  no estimaciones del tamaño real ni capacidad del piloto.
- Dominio puro separado de adaptadores. Los originales permanecen junto a los
  valores normalizados y las incidencias. No hay persistencia ni publicación en
  esta etapa; la autorización de una aprobación corresponde al futuro backend.
- Los IDs de actividad son explícitos y versionados en mapeos aprobados. Textos
  desconocidos requieren revisión. Los encabezados duplicados ligan el mapeo al
  hash de fuente para no reutilizar posiciones en otra importación.
- Duplicados de reporte, incluso idénticos, quedan retenidos hasta una resolución
  auditada. Alternativa de conservar la primera fila descartada: oculta conflictos.
- Suplementos apuntan a inscripción específica y conservan historial. No se
  deduplican personas eliminando sus inscripciones. Varias bases pueden resolverse
  por decisión administrativa explícita, válida solo para el corte indicado.
- Fechas civiles sin zona local: ISO, DD/MM/AAAA y seriales enteros 1900/1904.
  CSV UTF-8 con delimitador explícito; coma decimal queda como incidencia hasta
  aprobar un mapeo regional. Fórmulas se conservan pero no se toman como nota.
- El README separa parsers/normalización/clasificación/resolución (etapa 02) de
  indicadores y panel académico (etapa 04). No se implementa etapa 03.

### Reglas académicas y conciliación pendientes

No se alteró `requisitos.md`. Calendarios reales, catálogo completo, selección de
actividades, bajas privadas (incluidas las tres informadas), excepciones auditadas,
escalas y umbrales siguen pendientes de fuentes/decisiones autorizadas. Ningún
fixture sustituye una conciliación de los libros piloto. Bajas sin fecha no se
aplican retrospectivamente: solo al corte confirmado explícitamente en la entrada.

Entrega y vínculo de revisión: `entrega-etapa-02.md` y PR de esta rama.
