# Integración continua y revisión

## Contrato de ejecución

El workflow de este paquete se incorpora en el PR de la etapa 01 junto con un proyecto funcional. Sin `package.json`, `package-lock.json` y los scripts siguientes fallará intencionalmente. No es un workflow listo para ejecutar sobre una carpeta que solo contiene documentos.

Usar npm con un lockfile raíz; si se usa monorepo, npm workspaces. Node 22 y Java 21 son la base del workflow. Comprobar compatibilidad con las versiones elegidas; fijar Firebase CLI, Playwright y demás dependencias de desarrollo en el lockfile.

| Script raíz | Contrato |
| --- | --- |
| `lint` | Revisión estática del código de la aplicación y servidor. |
| `typecheck` | TypeScript sin emitir; incluye dominio, UI y Functions. |
| `test:unit` | Pruebas de dominio/parser en modo ejecución única; falla si no hay pruebas. |
| `build` | Compila web y Functions para ejecución en emuladores. |
| `test:emulators` | Inicia emuladores Auth, Firestore, Storage y Functions con `firebase emulators:exec --project demo-seguimiento-ci`; ejecuta reglas y pruebas de integración de servidor; termina emuladores al acabar. |
| `test:e2e` | Inicia un entorno de emuladores limpio con el mismo proyecto demo y ejecuta Playwright Chromium; su configuración inicia el servidor web local y espera readiness, sin sleeps fijos. |

Usar puertos declarados en `firebase.json` y conectar explícitamente todos los SDK a sus emuladores. Los scripts que los inician corren secuencialmente en CI. Sembrar identidades y fixtures sintéticos de manera determinista; limpiar entre pruebas. Nunca hacer fallback a recursos reales cuando falta un emulador. Si el proyecto no empieza con `demo-` o la configuración de emuladores está incompleta, fallar antes de escribir.

En etapa 01 son suficientes pruebas reales del esquema inicial, denegación de acceso no autenticado y renderizado de la pantalla inicial. Las suites se amplían con cada etapa. No crear comandos `echo`, pruebas tautológicas, `--passWithNoTests`, suites omitidas ni `continue-on-error` para aparentar éxito.

CI no utiliza secretos Firebase ni una clave de OpenAI. No despliega ni publica datos. Las acciones de GitHub están fijadas a commits de sus etiquetas v4 verificados al preparar el paquete; actualizarlas posteriormente mediante un PR verificable.

## Configurar GitHub después del primer CI exitoso

1. Configurar la rama principal real; el workflow asume `main` para los pushes, ajustar si difiere.
2. Crear una protección/ruleset para exigir el check `ci`, resolución de conversaciones y revisión según los permisos y plan disponibles en el repositorio. El YAML por sí mismo no bloquea merges.
3. Exigir que las comprobaciones correspondan al último commit y renovar aprobación si cambia código relevante.
4. Mantener despliegue de producción separado de CI. Definir credenciales y ambiente de destino al preparar el piloto.
5. Si se habilita una cola de merge, añadir el evento `merge_group` y comprobarlo con ese flujo; no asumir que el workflow actual ya cubre una cola.

Codex puede hacer una revisión adicional en GitHub con `@codex review` si está configurado. Las instrucciones `Code Review Rules` de `AGENTS.md` orientan esa revisión. Esta capacidad es distinta de las pruebas deterministas de GitHub Actions y de la revisión funcional aquí.

## Procedimiento de revisión aquí

Compartir URL del PR y objetivo de la etapa. Con acceso al repositorio, revisar el diff, contexto de los archivos afectados, resultados del último commit y pruebas relevantes. Si no hay acceso, proporcionar un diff/ZIP del código y logs; informar explícitamente qué no se pudo verificar. No aprobar una implementación solo por el relato del agente.

Salida de revisión:

- Dictamen: requiere cambios / sin hallazgos bloqueantes dentro del alcance revisado.
- Hallazgos priorizados, con archivo, ubicación, escenario reproducible e impacto.
- Estado de criterios de aceptación y CI, indicando commit revisado.
- Pruebas ejecutadas frente a pruebas solo inspeccionadas.
- Prompt concreto para corregir, o siguiente etapa.

No fusionar automáticamente. La ausencia de hallazgos no prueba que todo el sistema esté validado. Si no se probó Firebase real, rendimiento a escala o reconciliación con fuentes privadas, declararlo.

## Riesgos que sí requieren pruebas específicas

| Área | Casos mínimos |
| --- | --- |
| Identidad | Ceros iniciales, espacios, mayúsculas, docente exacto y matrícula parecida que no es docente. |
| Grupos | Todos los códigos, 48 en Arquitectura, corrección COMPUB, C.A con otra fecha, patrón ilegible y bases ambiguas. |
| Afiliaciones | Persona con base y especial; ficha de inglés más base; especial sin base; baja; excepción auditada de otro ciclo. |
| Calificación | `-`, cero, vacío, texto inválido, escala desconocida, totales excluidos, D=0 y actividades futuras sin seleccionar. |
| Importación | ODS/XLSX/CSV, fechas seriales, encabezados distintos, duplicados de fila, archivo corrupto, colisiones de ID y reemplazo de versión. |
| Concurrencia | Doble carga simultánea, reintento tras fallo, cierre durante procesamiento y publicación atómica sin dobles agregados. |
| Historial | Corte cerrado, corrección versionada, cambios de padrón/catalogo que no reescriben el pasado, comparación con bajas. |
| Acceso | Usuario anónimo, coordinador propio/ajeno, rol falsificado, exportación, descarga original, Functions y modificación de roles. |
| Interfaz | Carga parcial, incidencias, filtros, navegación con teclado, estados vacíos/errores y exportación que coincide con la pantalla. |

Los permisos requieren tanto casos permitidos como denegados; una aplicación que deniega todo tampoco cumple. Generar identidades y expedientes ficticios para CI. Los expedientes reales no se adjuntan a screenshots o logs del PR.

## Piloto de etapa 06

Además de las seis verificaciones, `npm run test:pilot` ejecuta 45 y 230 cursos,
dos cortes por escenario, cinco coordinaciones y formatos CSV/XLSX/ODS en
emuladores nuevos. `PILOT_COURSES=45` o `230` permite repetir un caso local;
CI ejecuta ambos sin esa variable. La suite tiene un presupuesto de 20 minutos
por caso de capacidad; no altera los timeouts ni las suites existentes. El job
de integración conserva su límite global de 25 minutos y `ci` exige ambos jobs.
Las mediciones no son umbrales de tiempo para aprobar exactitud ni garantías de nube.

`npm run verify:hosting` revisa inventario público después del build. No despliega.
No ejecutar la conciliación privada en CI: su manifest e informe se guardan
solamente en `private/`, ignorado por Git. El PR incluye evidencia sintética y
resúmenes agregados revisados, nunca fuentes ni registros privados.
