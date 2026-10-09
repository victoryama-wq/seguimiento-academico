# Guía breve de aceptación operativa

Estado: **pendiente de evaluación institucional**. Entorno exclusivo de pruebas:
<https://indicadores-academia.web.app>, proyecto `indicadores-academia`, región
`us-central1`. SHA desplegado y resultados actuales en la
[entrega del recorrido institucional](entrega-carga-institucional.md).
Las mediciones de capacidad anteriores se conservan en [ejecución cloud](validacion-nube-ejecucion.md).
La validación técnica automatizada usa únicamente sintéticos. Para la aceptación
solicitada por el propietario, seguir el [recorrido permanente de carga desde
originales](carga-institucional.md): el propietario selecciona, revisa y confirma
personalmente sus archivos. No subirlos mediante los scripts de piloto ni compartir
su contenido en evidencias públicas.

En este equipo, las cuentas sintéticas y contraseñas únicas están en
`private/staging-test-accounts.json` (ignorado por Git). El propietario puede
consultarlo localmente o recibir acceso por su canal institucional privado.
No pegar su contenido en chats/PR ni capturas. No se envían correos de acceso.

El operador entrega por canal privado cuentas de prueba admin, coordinación A y B
y contraseñas únicas. No se publican credenciales en PR/capturas; no reutilizar la
contraseña de emuladores. Abrir solo la URL verificada: debe mostrar «ENTORNO DE
PRUEBAS», versión esperada y «Entorno y versión de pruebas verificados». Si falta
esa confirmación, detener la prueba y registrar el estado, sin introducir datos.

## Recorrido guiado (10–15 minutos, estimación de agenda)

La preparación sintética corresponde a `tests/fixtures/synthetic/report-tracking.ts`
y `tests/emulators/explicit-progress.test.ts`: un curso 777 compartido, principal
Escolarizado y Ejecutivo en A, principal Virtual C.A. en B, y una baja excluida.
El operador prepara catálogo, paquete y curso por los canales administrativos.
Los IDs `000ESC`, `000EJE`, `000VIR`, `000BAJA` son exclusivamente sintéticos.
Preparar los archivos con `npm run prepare:cloud-fixtures`: paquete e inicial/
actualización están en `private/cloud-synthetic-inputs/small`. El script no carga
datos ni crea cuentas, y rechaza sobrescribir un paquete existente.

1. **Crear corte (admin).** Ciclos y cortes: crear un corte de prueba del ciclo
   sintético 27-1. Escolarizado corte 1; Ejecutivo unidad 3; Virtual unidad 2.
   Dejar fecha vacía. Esperado: creación válida, unidades respectivas 1–2, 1–3,
   1–2; auditoría de servidor. Virtual no se convierte en Ejecutivo.
2. **Cargar (A).** En Fuentes enviar CSV del curso con U1/U2/U3/U4. Valores:
   Escolarizado `1,2,3,4`; Ejecutivo `0,2,3,4`; Virtual `1,2,3,4`; baja `9,9,9,9`.
   Esperado: progreso/trabajo persistente, revisión de A sin registros de B.
   No exigir archivos de otros cursos ni todas las unidades para enviar el lote.
3. **Revisar y publicar (A).** Revisar curso, ciclo, actividades, incidencias y
   procedencia. Confirmar publicación. La baja permanece explicada y excluida.
   U4 se conserva fuera de indicadores. Principal C.A. sigue como tal; grupo de
   impartición permanece no determinado y no exige una elección.
4. **Consultar (admin/A/B).** Esperado admin: D=7, N=7, Z=1, G=V=E=0,
   tres estudiantes medidos, cobertura 100 %. A: D=5; B: D=2. B ve su Virtual
   C.A., nunca el Escolarizado/Ejecutivo de A. CSV debe coincidir con selección,
   versiones, filtros y denominadores. No compartir capturas con datos reales.
5. **Actualizar (A).** Cargar solo Ejecutivo, U1 vacía, U2 `-`, U3 `3`.
   La revisión debe advertir **dos sustituciones numéricas**, mostrando antes y
   después. Confirmar conscientemente. Para Ejecutivo: N=1, G=1, V=1, E=0,
   D=3, cobertura 33,33 %. Los otros alumnos y U4 permanecen; cero previo no se
   confunde con vacío. Guion no prueba falta de entrega ni retraso docente.
6. **Comprobar persistencia.** Reenviar el mismo archivo: sin duplicados ni cambio
   de avance. Cerrar navegador tras aceptar otra carga y reabrir: el trabajo sigue
   consultable. Un error real se informa con ID de trabajo y versión, sin token.
7. **Cerrar (admin).** Revisar pendientes antes del cierre y confirmar fotografía.
   Esperado: reportes, fuentes y avance congelados; futuras cargas/cambios no
   reescriben el corte. Las correcciones generan revisión con motivo y autor.

## Acta a completar por el usuario

Registrar privadamente fecha, evaluador, rol, proyecto, SHA, navegador/dispositivo;
por paso: aprobado / incidencia / no ejecutado, resultado observado y referencia
de evidencia sintética. La valoración final es «aceptado», «aceptado con pendientes»
o «requiere cambios», emitida por el usuario, no por el agente.

Pendientes: consultar la matriz técnica actualizada antes de evaluar. Persisten
once paquetes con avisos documentados (dos moderate en producción, sin ruta
afectada demostrada), restauración completa, presupuesto/retención, piloto privado
y aceptación institucional. Solo se utilizan cuentas/datos sintéticos en pruebas.
