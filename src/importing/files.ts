// Adaptador Node: no importar desde React. No extrae archivos al disco ni evalúa fórmulas.
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import * as XLSX from "xlsx";

export const LIMITS = {
  bytes: 8 * 1024 * 1024,
  expanded: 32 * 1024 * 1024,
  entries: 256,
  rows: 10000,
  columns: 256,
  cells: 200000,
} as const;
export type Cell = {
  raw: string | number | boolean | null;
  text: string;
  type: string;
  formula: string | null;
};
export type Table = {
  source: {
    originalName: string;
    sha256: string;
    bytes: number;
    parserVersion: string;
    sheet: string;
    epoch: "1900" | "1904";
  };
  headers: string[];
  rows: { row: number; cells: Cell[] }[];
};

// Una fila de formato no es una inscripción ni una calificación. Fórmulas,
// errores, cero y false siguen siendo contenido y conservan sus validaciones.
export const isEmptyRow = (row: Table["rows"][number]) =>
  row.cells.every(
    (cell) =>
      !cell.formula &&
      cell.type !== "e" &&
      (cell.raw === null ||
        (typeof cell.raw === "string" && cell.raw.trim() === "")),
  );

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Inspección ZIP acotada, antes de que SheetJS materialice XML/hojas.
function inspectZip(bytes: Buffer, format: "xlsx" | "ods") {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (
      bytes.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + bytes.readUInt16LE(i + 20) === bytes.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("ZIP incompleto");
  const count = bytes.readUInt16LE(end + 10);
  const start = bytes.readUInt32LE(end + 16);
  if (
    bytes.readUInt32LE(end + 4) !== 0 ||
    bytes.readUInt16LE(end + 8) !== count ||
    !count ||
    count > LIMITS.entries ||
    start + bytes.readUInt32LE(end + 12) !== end
  )
    throw new Error("ZIP dividido, ZIP64 o estructura fuera de límites");
  let offset = start;
  let expanded = 0;
  const entries = new Map<string, Buffer>();
  const ranges: [number, number][] = [];
  for (let entry = 0; entry < count; entry++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("Directorio ZIP inválido");
    const flags = bytes.readUInt16LE(offset + 8),
      method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20),
      size = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28),
      extraLength = bytes.readUInt16LE(offset + 30),
      commentLength = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    if (offset + 46 + nameLength + extraLength + commentLength > end)
      throw new Error("Entrada ZIP truncada");
    const name = bytes
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");
    if (/vbaProject|(?:^|\/)Scripts\/|(?:^|\/)embeddings\//i.test(name))
      throw new Error("Macros o adjuntos incrustados no admitidos");
    expanded += size;
    if (
      expanded > LIMITS.expanded ||
      flags & 1 ||
      ![0, 8].includes(method) ||
      entries.has(name) ||
      /(^\/|\.\.|\\|\0)/.test(name) ||
      local + 30 > start ||
      bytes.readUInt32LE(local) !== 0x04034b50
    )
      throw new Error("ZIP inseguro o fuera de límites");
    const localName = bytes.readUInt16LE(local + 26),
      localExtra = bytes.readUInt16LE(local + 28);
    const dataStart = local + 30 + localName + localExtra;
    if (
      bytes.readUInt16LE(local + 8) !== method ||
      bytes.readUInt16LE(local + 6) !== flags ||
      bytes.subarray(local + 30, local + 30 + localName).toString("utf8") !==
        name ||
      dataStart + compressed > start ||
      ranges.some(([a, b]) => local < b && dataStart + compressed > a)
    )
      throw new Error("Entrada ZIP inconsistente");
    ranges.push([local, dataStart + compressed]);
    const data = bytes.subarray(dataStart, dataStart + compressed);
    const result =
      method === 0
        ? data
        : inflateRawSync(data, {
            maxOutputLength: Math.max(1, Math.min(size, LIMITS.expanded)),
          });
    if (
      result.length !== size ||
      crc32(result) !== bytes.readUInt32LE(offset + 16)
    )
      throw new Error("Integridad ZIP inválida");
    entries.set(name, result);
    if (/\.(xml|rels)$/.test(name)) {
      const xml = result.toString("utf8");
      if (/<!DOCTYPE|<!ENTITY/i.test(xml))
        throw new Error("XML con entidades no admitido");
      for (const repeated of xml.matchAll(
        /(?:number-(?:rows|columns)-repeated|number-columns-spanned|number-rows-spanned)\s*=\s*["'](\d+)["']/g,
      )) {
        if (Number(repeated[1]) > LIMITS.rows)
          throw new Error("Repetición ODS fuera de límites");
      }
      // Prohíbe dimensiones enormes antes del parser (incluye referencias XLSX).
      for (const ref of xml.matchAll(
        /\b(?:r|ref)=["']([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?["']/g,
      )) {
        const address = XLSX.utils.decode_cell(
          `${ref[3] ?? ref[1]}${ref[4] ?? ref[2]}`,
        );
        if (address.r >= LIMITS.rows || address.c >= LIMITS.columns)
          throw new Error("Dimensiones fuera de límites");
      }
      if (format === "ods" && name === "content.xml") {
        for (const namespace of xml.matchAll(
          /xmlns:([\w-]+)\s*=\s*["']urn:oasis:names:tc:opendocument:xmlns:table:1\.0["']/g,
        )) {
          if (namespace[1] !== "table")
            throw new Error(
              "Namespace ODS alternativo: requiere conversión revisada",
            );
        }
        // ODS puede expandir filas/columnas sin dimensión explícita.
        let rows = 0,
          cells = 0;
        for (const row of xml.matchAll(
          /<table:table-row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-row>)/g,
        )) {
          const repeats = Number(
            /table:number-rows-repeated=["'](\d+)["']/.exec(row[1]!)?.[1] ?? 1,
          );
          let columns = 0;
          for (const cell of (row[2] ?? "").matchAll(
            /<table:(?:table-cell|covered-table-cell)\b([^>]*)/g,
          ))
            columns += Number(
              /table:number-columns-repeated=["'](\d+)["']/.exec(
                cell[1]!,
              )?.[1] ?? 1,
            );
          rows += repeats;
          cells += repeats * columns;
          if (
            rows > LIMITS.rows ||
            columns > LIMITS.columns ||
            cells > LIMITS.cells
          )
            throw new Error("Dimensiones ODS fuera de límites");
        }
      }
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== end) throw new Error("Directorio ZIP inconsistente");
  if (
    format === "xlsx" &&
    (!entries.has("[Content_Types].xml") ||
      !entries.has("xl/workbook.xml") ||
      !entries
        .get("[Content_Types].xml")!
        .toString()
        .includes("spreadsheetml.sheet.main+xml"))
  )
    throw new Error("El contenido no es XLSX");
  if (
    format === "ods" &&
    (entries.get("mimetype")?.toString() !==
      "application/vnd.oasis.opendocument.spreadsheet" ||
      !entries.has("content.xml"))
  )
    throw new Error("El contenido no es ODS");
}

function csvRows(text: string, delimiter: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false,
    cells = 0;
  const pushCell = () => {
    if (++cells > LIMITS.cells) throw new Error("Demasiadas celdas CSV");
    if (row.length >= LIMITS.columns)
      throw new Error("Demasiadas columnas CSV");
    row.push(cell);
    cell = "";
    closed = false;
  };
  const pushRow = () => {
    pushCell();
    if (result.length && row.length !== result[0]!.length)
      throw new Error("CSV con filas desiguales");
    if (result.length >= LIMITS.rows) throw new Error("Demasiadas filas CSV");
    result.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === delimiter) {
      pushCell();
      // El separador confirma otra celda: no leerla si ya excede el ancho.
      if (result.length && row.length >= result[0]!.length)
        throw new Error("CSV con filas desiguales");
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else if (c === '"' && !cell && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new Error("Comillas CSV inválidas");
      cell += c;
    }
  }
  if (quoted) throw new Error("CSV truncado");
  if (cell || row.length || closed) pushRow();
  if (!result.length) throw new Error("CSV con filas desiguales");
  return result;
}

export function readTable(
  bytes: Uint8Array,
  originalName: string,
  options: {
    sheet?: string | undefined;
    delimiter?: "," | ";" | "\t" | undefined;
    headerRow?: number | undefined;
  } = {},
): Table {
  if (!bytes.length || bytes.length > LIMITS.bytes)
    throw new Error("Tamaño de archivo inválido");
  const buffer = Buffer.from(bytes);
  const extension = /\.(xlsx|ods|csv)$/i.exec(originalName)?.[1]?.toLowerCase();
  if (!extension) throw new Error("Formato no admitido");
  const headerRow = options.headerRow ?? 1;
  if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > LIMITS.rows)
    throw new Error("Fila de encabezados inválida");
  let matrix: Cell[][],
    sheetName: string,
    epoch: "1900" | "1904" = "1900";
  if (extension === "csv") {
    const decoded = new TextDecoder("utf-8", { fatal: true })
      .decode(bytes)
      .replace(/^\uFEFF/, "");
    if (
      [...decoded].some(
        (c) => c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0)),
      ) ||
      /^\s*</.test(decoded) ||
      decoded.startsWith("PK")
    )
      throw new Error("El contenido no es CSV UTF-8");
    const separator = options.delimiter ?? ",";
    if (![",", ";", "\t"].includes(separator))
      throw new Error("Separador CSV no admitido");
    matrix = csvRows(decoded, separator).map((row) =>
      row.map((raw) => ({ raw, text: raw, type: "s", formula: null })),
    );
    sheetName = "CSV";
  } else {
    if (extension !== "ods" && extension !== "xlsx")
      throw new Error("Formato no admitido");
    inspectZip(buffer, extension);
    const book = XLSX.read(buffer, {
      type: "buffer",
      raw: true,
      cellFormula: true,
      cellDates: false,
      cellText: true,
      cellNF: true,
      WTF: true,
    });
    if (!options.sheet && book.SheetNames.length !== 1)
      throw new Error("Elegir hoja explícitamente");
    sheetName = options.sheet ?? book.SheetNames[0]!;
    const sheet = book.Sheets[sheetName];
    if (!sheet?.["!ref"]) throw new Error("Hoja vacía o inexistente");
    if (sheet["!merges"]?.length)
      throw new Error("Celdas combinadas: requiere mapeo previo");
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    if (
      range.e.r >= LIMITS.rows ||
      range.e.c >= LIMITS.columns ||
      (range.e.r + 1) * (range.e.c + 1) > LIMITS.cells
    )
      throw new Error("Dimensiones fuera de límites");
    epoch = book.Workbook?.WBProps?.date1904 ? "1904" : "1900";
    matrix = Array.from({ length: range.e.r + 1 }, (_, r) =>
      Array.from({ length: range.e.c + 1 }, (_, c) => {
        const cell: XLSX.CellObject | undefined =
          sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell?.v instanceof Date)
          throw new Error(
            "Fecha convertida inesperadamente: requiere fecha civil",
          );
        return {
          raw: cell?.v ?? null,
          text: cell?.w ?? String(cell?.v ?? ""),
          type: cell?.t ?? "z",
          formula: cell?.f ?? null,
        };
      }),
    );
  }
  const header = matrix[headerRow - 1];
  if (
    !header ||
    header.some((c) => c.formula || c.type !== "s" || !c.text.trim())
  )
    throw new Error("Encabezados vacíos o no textuales");
  return {
    source: {
      originalName,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      parserVersion: `etapa02/1-sheetjs-${XLSX.version}`,
      sheet: sheetName,
      epoch,
    },
    headers: header.map((c) => c.text),
    rows: matrix
      .slice(headerRow)
      .map((cells, i) => ({ row: headerRow + i + 1, cells })),
  };
}

/** Inventario acotado para la selección visual y matrices institucionales.
 * No evalúa fórmulas ni cambia la época. No acepta macros ni adjuntos. */
export function workbookData(
  bytes: Uint8Array,
  name: string,
  strict: boolean | readonly string[] = false,
) {
  const extension = /\.(xlsx|ods)$/i.exec(name)?.[1]?.toLowerCase();
  if (!extension || !bytes.length || bytes.length > LIMITS.bytes)
    throw new Error("Selecciona un libro XLSX u ODS de hasta 8 MiB.");
  inspectZip(Buffer.from(bytes), extension as "xlsx" | "ods");
  const book = XLSX.read(bytes, {
    type: "buffer",
    raw: true,
    cellDates: false,
    cellFormula: true,
  });
  let cells = 0;
  const sheets: Record<string, (string | number | boolean | null)[][]> = {};
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name]!;
    if (!sheet["!ref"]) {
      sheets[name] = [];
      continue;
    }
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    cells += (range.e.r + 1) * (range.e.c + 1);
    if (
      range.e.r >= LIMITS.rows ||
      range.e.c >= LIMITS.columns ||
      cells > LIMITS.cells
    )
      throw new Error(
        "El libro excede los límites de filas o celdas. Divide la fuente.",
      );
    sheets[name] = Array.from({ length: range.e.r + 1 }, (_, r) =>
      Array.from({ length: range.e.c + 1 }, (_, c) => {
        const value = sheet[XLSX.utils.encode_cell({ r, c })] as
          XLSX.CellObject | undefined;
        if (
          (strict === true ||
            (Array.isArray(strict) && strict.includes(name))) &&
          (value?.f || value?.t === "e")
        )
          throw new Error(
            "Hay fórmulas o errores en una hoja de decisiones; selecciona valores aprobados literales.",
          );
        return (value?.v ?? null) as string | number | boolean | null;
      }),
    );
  }
  return {
    sheets,
    epoch: book.Workbook?.WBProps?.date1904
      ? ("1904" as const)
      : ("1900" as const),
  };
}
