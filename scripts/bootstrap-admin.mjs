import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Herramienta privilegiada local, nunca una operación pública o una selección de rol.
if (
  process.env.GCLOUD_PROJECT !== "demo-seguimiento-ci" ||
  process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099"
) {
  throw new Error(
    "Solo emuladores demo explícitos. No se conectó a producción.",
  );
}
const uid = process.argv[2];
if (!uid || !/^[a-zA-Z0-9_-]{1,100}$/.test(uid))
  throw new Error("Indica el UID de una cuenta Auth existente.");
const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT });
await getAuth(app).getUser(uid);
const db = getFirestore(app);
const assigned = await db.runTransaction(async (tx) => {
  const marker = db.doc("bootstrap/initial-admin");
  // Cerrar la transacción incluso al rechazar una segunda asignación. El SDK
  // revierte errores de callback en segundo plano; salir antes puede dejar locks.
  if ((await tx.get(marker)).exists) return false;
  tx.create(db.doc(`memberships/${uid}`), {
    role: "admin",
    active: true,
    careers: [],
  });
  tx.create(marker, { uid, createdAt: Date.now(), tool: "bootstrap-admin" });
  return true;
});
await db.terminate();
if (!assigned)
  throw new Error(
    "Administrador inicial ya asignado. Usa la gestión autenticada de roles.",
  );
console.log("Administrador inicial asignado en emuladores.");
