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
  `Informe generado: ${new Date().toISOString()}. Resultado del audit suministrado; rutas del lockfile actual.`,
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
  "La presencia en el árbol no prueba explotabilidad. `fixAvailable` informa disponibilidad según npm, no garantiza compatibilidad ni suficiencia. No se ejecuta audit fix desde este generador. SheetJS proviene del tarball 0.20.3 fijado y no queda cubierto plenamente por avisos del registro npm. La valoración de exposición y cambios comprobados está separada en [validación de fase 2](validacion-nube-fase-2.md). No se declara producción segura por obtener CI verde.",
  "",
);
writeFileSync("docs/dependencias-etapa-06.md", lines.join("\n"));
console.log(JSON.stringify(audit.metadata.vulnerabilities));
