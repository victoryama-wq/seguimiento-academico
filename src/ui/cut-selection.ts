import type { Overview } from "../domain/import-contract";
import { firebaseServices } from "../infrastructure/firebase";

const key = () =>
  `academic-cut:${firebaseServices().auth.currentUser?.uid ?? "anonymous"}`;
export function rememberCut(id: string) {
  sessionStorage.setItem(key(), id);
}
export function selectedCut(overview: Overview) {
  const saved = sessionStorage.getItem(key());
  return (
    overview.cuts.find((c) => c.id === saved)?.id ??
    overview.cuts.find((c) => c.status === "open")?.id ??
    overview.cuts[0]?.id ??
    ""
  );
}
export function cutLabel(cut: Overview["cuts"][number]) {
  return `${cut.label ?? `Corte del ${cut.date}`} · Ciclo ${cut.cycleId} · ${cut.status === "closed" ? "Cerrado" : "Abierto"}`;
}
