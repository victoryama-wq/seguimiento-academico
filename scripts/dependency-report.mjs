// Reformat audit evidence; never installs, updates or fixes dependencies.
import { readFileSync, writeFileSync } from "node:fs";
const audit = JSON.parse(
  readFileSync(
    process.argv[2] ?? "test-results/audit-stage06.json",
    "utf8",
  ).replace(/^\uFEFF/, ""),
);
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const packages = lock.packages;
const routes = new Map();
const queue = [];
function find(from, name) {
  let dir = from;
  while (true) {
    const key = `${dir ? dir + "/" : ""}node_modules/${name}`;
    if (packages[key]) return key;
    if (!dir) return null;
    const at = dir.lastIndexOf("/node_modules/");
    dir = at >= 0 ? dir.slice(0, at) : "";
  }
}
for (const root of ["", "functions"]) {
  const p = packages[root];
  for (const section of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
  ]) {
    for (const name of Object.keys(p[section] ?? {})) {
      const key = find(root, name);
      if (key)
        queue.push({
          key,
          path: `${root || "aplicacion"} (${section}) → ${name}`,
          usage: section === "devDependencies" ? "desarrollo" : "produccion",
        });
    }
  }
}
for (let i = 0; i < queue.length; i++) {
  const entry = queue[i];
  const routeKey = `${entry.key}:${entry.usage}`;
  if (routes.has(routeKey)) continue;
  routes.set(routeKey, entry.path);
  const p = packages[entry.key];
  for (const name of Object.keys({
    ...p.dependencies,
    ...p.optionalDependencies,
  })) {
    const key = find(entry.key, name);
    if (key)
      queue.push({ key, usage: entry.usage, path: `${entry.path} → ${name}` });
  }
}
const lines = [
  "# Dependencias: etapa 06",
  "",
  `Consulta npm audit: ${new Date().toISOString()}. Lockfile sin actualizaciones.`,
  "",
  "## Resultado de la herramienta",
  "",
  `Conteo por paquetes afectados (incluye propagación a dependientes): ${JSON.stringify(audit.metadata.vulnerabilities)}. No es un conteo de CVE únicos.`,
  "",
  "| Paquete | Severidad npm | Relación | Uso/rutas en lockfile | Corrección que informa npm |",
  "|---|---|---|---|---|",
];
for (const [name, v] of Object.entries(audit.vulnerabilities)) {
  const paths = [];
  for (const key of v.nodes)
    for (const usage of ["produccion", "desarrollo"]) {
      const route = routes.get(`${key}:${usage}`);
      if (route) paths.push(`${usage}: ${route}`);
    }
  lines.push(
    `| ${name} | ${v.severity} | ${v.isDirect ? "directa" : "transitiva"} | ${[...new Set(paths)].join("<br>") || "No resuelta; revisar npm explain"} | ${JSON.stringify(v.fixAvailable)} |`,
  );
}
lines.push("", "### Avisos individuales", "");
const seen = new Set();
for (const v of Object.values(audit.vulnerabilities))
  for (const via of v.via)
    if (typeof via === "object" && !seen.has(via.url)) {
      seen.add(via.url);
      lines.push(
        `- ${via.name}: [${via.title}](${via.url}); severidad ${via.severity}; rango ${via.range}.`,
      );
    }
lines.push(
  "",
  "## Valoración técnica separada",
  "",
  "La presencia en el árbol no prueba explotabilidad. Las rutas de producción requieren priorización y reproducción; las herramientas de desarrollo también procesan archivos y ejecutan CI. `fixAvailable: true` informa disponibilidad según npm, no garantiza que una actualización aislada sea compatible ni suficiente. Los objetos con `isSemVerMajor` requieren revisión explícita; no se ejecutó audit fix, force, downgrade ni actualización masiva. SheetJS proviene del tarball 0.20.3 fijado y no queda cubierto plenamente por avisos del registro npm. Quedan pendientes análisis de alcance y remediaciones acotadas con las seis regresiones. No se declara producción segura por obtener CI verde.",
  "",
);
writeFileSync("docs/dependencias-etapa-06.md", lines.join("\n"));
console.log(JSON.stringify(audit.metadata.vulnerabilities));
