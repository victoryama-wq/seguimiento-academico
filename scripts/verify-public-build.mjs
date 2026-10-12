import { readdirSync, lstatSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

const dir = resolve(process.argv[2] ?? "dist");
const config = JSON.parse(readFileSync("firebase.staging.json", "utf8"));
if (config.hosting.public !== "dist")
  throw new Error("Hosting solo puede apuntar a dist");
const manifest = [];
function visit(relative = "") {
  for (const name of readdirSync(join(dir, relative))) {
    const path = join(dir, relative, name);
    const key = [...relative.split("/"), name].filter(Boolean).join("/");
    const stat = lstatSync(path);
    if (stat.isSymbolicLink())
      throw new Error("Enlace no permitido en build público");
    if (stat.isDirectory()) {
      if (key !== "assets")
        throw new Error("Directorio ajeno al build público");
      visit(key);
      continue;
    }
    if (
      key !== "index.html" &&
      !/^assets\/[\w-]+-[\w-]+\.(js|css|woff2?|svg|png)$/.test(key)
    )
      throw new Error("Archivo ajeno al build público");
    const bytes = readFileSync(path);
    if (
      /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|"type"\s*:\s*"service_account"/.test(
        bytes.toString("utf8"),
      )
    )
      throw new Error("Credencial detectada en build");
    manifest.push({
      file: key,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
}
visit();
if (
  !manifest.some((f) => f.file === "index.html") ||
  !manifest.some((f) => f.file.endsWith(".js"))
)
  throw new Error("Build público incompleto");
console.log(
  JSON.stringify(
    {
      public: "dist",
      files: manifest,
      note: "Inventario técnico; no sustituye revisión de contenido ni habilita despliegue.",
    },
    null,
    2,
  ),
);
