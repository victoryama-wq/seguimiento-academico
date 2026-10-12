import { build } from "vite";
import { gzipSync } from "node:zlib";

// Misma configuración de producción, sin escribir ni desplegar archivos.
const result = await build({ logLevel: "silent", build: { write: false } });
const output = (Array.isArray(result) ? result : [result]).flatMap(
  (r) => r.output,
);
const chunks = new Map(
  output.filter((f) => f.type === "chunk").map((f) => [f.fileName, f]),
);
const initial = new Set();
function visit(name) {
  if (initial.has(name)) return;
  const chunk = chunks.get(name);
  if (!chunk) throw new Error(`Import desconocido: ${name}`);
  initial.add(name);
  chunk.imports.forEach(visit);
}
for (const chunk of chunks.values()) if (chunk.isEntry) visit(chunk.fileName);
const files = [...chunks.values()].map((f) => ({
  file: f.fileName,
  initial: initial.has(f.fileName),
  bytes: Buffer.byteLength(f.code),
  gzip: gzipSync(f.code).length,
  imports: f.imports,
  dynamicImports: f.dynamicImports,
  firestore: Object.keys(f.modules).some((id) =>
    id.includes("@firebase/firestore"),
  ),
  storage: Object.keys(f.modules).some((id) =>
    id.includes("@firebase/storage"),
  ),
}));
const sum = (items, key) => items.reduce((n, f) => n + f[key], 0);
console.log(
  JSON.stringify(
    {
      note: "Bytes JS del build; gzip por recurso. No mide latencia ni tiempo de nube. Los imports dinámicos pueden solicitarse al montar la UI.",
      initial: {
        bytes: sum(
          files.filter((f) => f.initial),
          "bytes",
        ),
        gzip: sum(
          files.filter((f) => f.initial),
          "gzip",
        ),
      },
      total: { bytes: sum(files, "bytes"), gzip: sum(files, "gzip") },
      files,
    },
    null,
    2,
  ),
);
