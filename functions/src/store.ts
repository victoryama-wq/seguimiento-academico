import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Transaction } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError } from "firebase-functions/v2/https";
import { createHash } from "node:crypto";
import { memberSchema, type Member } from "../../src/domain/import-contract";
import { runtimeEnvironment } from "./environment";

const app =
  getApps()[0] ??
  initializeApp(
    process.env.GCLOUD_PROJECT ? { projectId: process.env.GCLOUD_PROJECT } : {},
  );
export const db = getFirestore(app);
export const auth = getAuth(app);
export const bucket = () => {
  const config = runtimeEnvironment(process.env);
  return getStorage(app).bucket(
    config.mode === "staging"
      ? config.storageBucket
      : `${config.projectId}.appspot.com`,
  );
};
export function requireRuntime() {
  try {
    const config = runtimeEnvironment(process.env);
    if (app.options.projectId !== config.projectId)
      throw new Error("SDK administrativo fuera del proyecto autorizado");
  } catch {
    throw new HttpsError(
      "failed-precondition",
      "Entorno no autorizado; se requiere configuración completa y revisada.",
    );
  }
}
export const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function denied(): never {
  throw new HttpsError(
    "permission-denied",
    "Operación fuera del alcance autorizado.",
  );
}
export async function membership(
  uid: string | undefined,
  tx?: Transaction,
): Promise<Member> {
  if (!uid) throw new HttpsError("unauthenticated", "Inicia sesión.");
  const ref = db.doc(`memberships/${uid}`);
  const snap = tx ? await tx.get(ref) : await ref.get();
  const parsed = memberSchema.safeParse(snap.data());
  if (!parsed.success || !parsed.data.active) return denied();
  return parsed.data;
}
export function admin(member: Member) {
  if (member.role !== "admin") denied();
}
export function career(member: Member, id: string) {
  if (member.role !== "admin" && !member.careers.includes(id)) denied();
}
export function courseAccess(member: Member, course: { careers: string[] }) {
  if (
    member.role !== "admin" &&
    !course.careers.some((id) => member.careers.includes(id))
  )
    denied();
}
export async function saveImmutable(
  path: string,
  bytes: Buffer,
  contentType: string,
) {
  try {
    await bucket()
      .file(path)
      .save(bytes, {
        resumable: false,
        contentType,
        preconditionOpts: { ifGenerationMatch: 0 },
      });
  } catch (error) {
    if (![409, 412].includes(Number((error as { code?: unknown }).code)))
      throw error;
    const [existing] = await bucket().file(path).download();
    if (hash(existing) !== hash(bytes))
      throw new Error("Colisión de objeto inmutable", { cause: error });
  }
}
export async function jsonFile<T>(path: string): Promise<T> {
  return JSON.parse(
    (await bucket().file(path).download())[0].toString("utf8"),
  ) as T;
}
