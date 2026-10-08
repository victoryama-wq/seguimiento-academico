# Dependencias: etapa 06

Informe generado: 2026-10-08T18:18:50.615Z. Resultado del audit suministrado; rutas del lockfile actual.

## Resultado de la herramienta

Conteo por paquetes afectados (incluye propagación a dependientes): {"info":0,"low":0,"moderate":4,"high":7,"critical":0,"total":11}. No es un conteo de CVE únicos.

| Paquete | Severidad npm | Relación | Uso/rutas en lockfile | Corrección que informa npm |
|---|---|---|---|---|
| @google-cloud/pubsub | moderate | transitiva | desarrollo: aplicacion (devDependencies) → firebase-tools → @google-cloud/pubsub | {"name":"firebase-tools","version":"14.23.0","isSemVerMajor":true} |
| @opentelemetry/core | moderate | transitiva | desarrollo: aplicacion (devDependencies) → firebase-tools → @google-cloud/pubsub → @opentelemetry/core | {"name":"firebase-tools","version":"14.23.0","isSemVerMajor":true} |
| basic-ftp | high | transitiva | desarrollo: aplicacion (devDependencies) → firebase-tools → proxy-agent → pac-proxy-agent → get-uri → basic-ftp | {"name":"firebase-tools","version":"14.23.0","isSemVerMajor":true} |
| braces | high | transitiva | desarrollo: aplicacion (devDependencies) → firebase-tools → chokidar → braces | {"name":"firebase-tools","version":"14.23.0","isSemVerMajor":true} |
| chokidar | high | transitiva | desarrollo: aplicacion (devDependencies) → firebase-tools → chokidar | {"name":"firebase-tools","version":"14.23.0","isSemVerMajor":true} |
| firebase-tools | high | directa | desarrollo: aplicacion (devDependencies) → firebase-tools | {"name":"firebase-tools","version":"14.23.0","isSemVerMajor":true} |
| gaxios | moderate | transitiva | produccion: functions (dependencies) → firebase-admin → @google-cloud/storage → gaxios<br>desarrollo: aplicacion (devDependencies) → firebase-tools → gaxios | {"name":"firebase-tools","version":"14.23.0","isSemVerMajor":true} |
| get-uri | high | transitiva | desarrollo: aplicacion (devDependencies) → firebase-tools → proxy-agent → pac-proxy-agent → get-uri | {"name":"firebase-tools","version":"14.23.0","isSemVerMajor":true} |
| pac-proxy-agent | high | transitiva | desarrollo: aplicacion (devDependencies) → firebase-tools → proxy-agent → pac-proxy-agent | {"name":"firebase-tools","version":"14.23.0","isSemVerMajor":true} |
| proxy-agent | high | transitiva | desarrollo: aplicacion (devDependencies) → firebase-tools → proxy-agent | {"name":"firebase-tools","version":"14.23.0","isSemVerMajor":true} |
| uuid | moderate | transitiva | produccion: functions (dependencies) → firebase-admin → @google-cloud/storage → gaxios → uuid<br>desarrollo: aplicacion (devDependencies) → firebase-tools → gaxios → uuid | {"name":"firebase-tools","version":"14.23.0","isSemVerMajor":true} |

### Avisos individuales

- @opentelemetry/core: [OpenTelemetry Core: Unbounded memory allocation in W3C Baggage propagation](https://github.com/advisories/GHSA-8988-4f7v-96qf); severidad moderate; rango <2.8.0.
- basic-ftp: [basic-ftp: Quadratic-time CPU denial of service in Client.list() Unix directory-listing parser (RE_LINE backtracking)](https://github.com/advisories/GHSA-c475-qrg2-pj4r); severidad high; rango <=6.2.0.
- braces: [braces vulnerable to stack-exhaustion denial of service through deeply nested patterns](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm); severidad high; rango <=3.0.3.
- uuid: [uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided](https://github.com/advisories/GHSA-w5hq-g745-h8pq); severidad moderate; rango <11.1.1.

## Valoración técnica separada

La presencia en el árbol no prueba explotabilidad. `fixAvailable` informa disponibilidad según npm, no garantiza compatibilidad ni suficiencia. No se ejecuta audit fix desde este generador. SheetJS proviene del tarball 0.20.3 fijado y no queda cubierto plenamente por avisos del registro npm. La valoración de exposición y cambios comprobados está separada en [validación de fase 2](validacion-nube-fase-2.md). No se declara producción segura por obtener CI verde.
