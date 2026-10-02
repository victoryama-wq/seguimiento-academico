import { httpsCallable } from "firebase/functions";
import { z } from "zod";
import {
  type Operation,
  operationSchemas,
  descriptorSchema,
} from "../domain/import-contract";
import { firebaseServices } from "./firebase";

export async function callAcademic<T>(
  op: Operation,
  input: unknown,
  response: z.ZodType<T>,
): Promise<T> {
  const data = operationSchemas[op].parse(input);
  const result = await httpsCallable(
    firebaseServices().functions,
    "academicApi",
    { timeout: 120000 },
  )({ op, input: data });
  return response.parse(result.data);
}
export const okSchema = z.object({ ok: z.literal(true) });
export async function fileDescriptor(file: File, mapping: unknown) {
  if (!descriptorSchema.shape.bytes.safeParse(file.size).success)
    throw new Error("El archivo debe contener datos y no exceder 8 MiB.");
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return descriptorSchema.parse({
    name: file.name,
    bytes: bytes.byteLength,
    sha256: Array.from(new Uint8Array(digest), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join(""),
    mapping,
  });
}
export async function fileBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
export function downloadText(name: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
