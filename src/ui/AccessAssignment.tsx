import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  accessAccountSchema,
  accessCatalogSchema,
  accessReviewSchema,
  newUserReviewSchema,
  newUserResultSchema,
  type memberSchema,
} from "../domain/access-contract";
import { callAcademic, okSchema } from "../infrastructure/academic-api";
import type { Overview } from "../domain/import-contract";
type Member = z.infer<typeof memberSchema>;
const empty: Member = { role: "coordinator", active: true, careers: [] };
export default function AccessAssignment({
  overview,
  initialEmail = "",
  newUser = false,
  onExisting,
  onSaved,
}: {
  overview: Overview;
  initialEmail?: string;
  newUser?: boolean;
  onExisting?: (email: string) => void;
  onSaved?: () => void;
}) {
  const [cycle, setCycle] = useState(overview.cycles[0]?.id ?? ""),
    [catalog, setCatalog] = useState<z.infer<
      typeof accessCatalogSchema
    > | null>(null);
  const [email, setEmail] = useState(initialEmail),
    [account, setAccount] = useState<z.infer<
      typeof accessAccountSchema
    > | null>(null),
    [member, setMember] = useState<Member>(empty);
  const [name, setName] = useState("");
  const [creation, setCreation] = useState<z.infer<
    typeof newUserResultSchema
  > | null>(null);
  const [search, setSearch] = useState(""),
    [responsible, setResponsible] = useState("");
  const [review, setReview] = useState<z.infer<
      typeof accessReviewSchema
    > | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const epoch = useRef(0);
  useEffect(() => {
    if (!initialEmail) return;
    let live = true;
    const current = epoch.current;
    void callAcademic(
      "lookupAccess",
      { email: initialEmail },
      accessAccountSchema,
    )
      .then((v) => {
        if (live && epoch.current === current) {
          setAccount(v);
          setMember(v.member ?? empty);
        }
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [initialEmail]);
  const invalidate = () => {
    epoch.current++;
    setReview(null);
    setConfirmed(false);
    setNotice("");
  };
  useEffect(() => {
    let live = true;
    if (cycle)
      void callAcademic(
        "accessCatalog",
        { cycleId: cycle },
        accessCatalogSchema,
      )
        .then((v) => {
          if (live) setCatalog(v);
        })
        .catch((e: Error) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [cycle]);
  const update = (value: Member) => {
    invalidate();
    setMember(value);
  };
  const known = catalog?.careers ?? [],
    existing = account?.member?.careers ?? [];
  const missing = existing.filter((id) => !known.some((c) => c.id === id));
  const label = (id: string) => {
    const row =
      known.find((c) => c.id === id) ??
      account?.existingCareers.find((c) => c.id === id);
    return row
      ? `${row.name} (${row.abbreviation}) · ${row.plan}`
      : `Permiso existente fuera de este catálogo ${existing.indexOf(id) + 1}`;
  };
  const normal = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  const filtered = known.filter(
    (c) =>
      (!responsible || c.responsible === responsible) &&
      normal(`${c.name} ${c.abbreviation} ${c.responsible} ${c.plan}`).includes(
        normal(search),
      ),
  );
  const toggle = (id: string, on: boolean) =>
    update({
      ...member,
      careers: on
        ? [...new Set([...member.careers, id])]
        : member.careers.filter((c) => c !== id),
    });
  async function lookup() {
    invalidate();
    const current = epoch.current;
    setAccount(null);
    setBusy(true);
    setError("");
    try {
      const v = await callAcademic(
        "lookupAccess",
        { email: email.trim() },
        accessAccountSchema,
      );
      const refreshed = cycle
        ? await callAcademic(
            "accessCatalog",
            { cycleId: cycle },
            accessCatalogSchema,
          )
        : null;
      if (current === epoch.current) {
        setAccount(v);
        setMember(v.member ?? empty);
        setCatalog(refreshed);
      }
    } catch (e) {
      if (current === epoch.current) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function prepare() {
    invalidate();
    const current = epoch.current;
    if ((!account && !newUser) || !catalog?.version) return;
    setBusy(true);
    setError("");
    try {
      if (newUser) {
        const v = await callAcademic(
          "reviewNewUser",
          {
            name,
            email: email.trim(),
            cycleId: cycle,
            catalogVersion: catalog.version,
            member,
          },
          newUserReviewSchema,
        );
        if (current !== epoch.current) return;
        if (v.existing) {
          setNotice(
            "El correo ya existe. Su identidad se conserva; abre la cuenta para gestionar permisos.",
          );
          onExisting?.(v.email);
          return;
        }
        setReview({
          id: v.id!,
          added: member.careers,
          removed: [],
          retained: [],
        });
        return;
      }
      const v = await callAcademic(
        "reviewAccess",
        {
          email: account!.account!.email,
          cycleId: cycle,
          catalogVersion: catalog.version,
          accountVersion: account!.accountVersion,
          memberVersion: account!.memberVersion,
          member,
        },
        accessReviewSchema,
      );
      if (current === epoch.current) setReview(v);
    } catch (e) {
      if (current === epoch.current) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!review || !confirmed) return;
    setBusy(true);
    setError("");
    try {
      if (newUser) {
        localStorage.setItem("pending-user-creation", review.id);
        const v = await callAcademic(
          "confirmNewUser",
          { reviewId: review.id },
          newUserResultSchema,
        );
        setCreation(v);
        if (v.existing) {
          setNotice(
            "El correo ya existe. No se cambió su identidad ni se concedieron permisos.",
          );
          onExisting?.(v.email);
        } else if (v.permissionsAssigned)
          setCreation(
            await callAcademic(
              "activateAccessUser",
              { reviewId: review.id, attemptId: crypto.randomUUID() },
              newUserResultSchema,
            ),
          );
        onSaved?.();
        return;
      }
      await callAcademic("assignMember", { reviewId: review.id }, okSchema);
      const v = await callAcademic(
        "lookupAccess",
        { email: account!.account!.email },
        accessAccountSchema,
      );
      setAccount(v);
      setMember(v.member ?? empty);
      invalidate();
      setNotice(
        "Acceso actualizado. No se creó ninguna cuenta ni se envió invitación.",
      );
      onSaved?.();
    } catch (e) {
      invalidate();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Asignar acceso" className="guided-intake">
      <h3>{newUser ? "Nuevo usuario" : "Asignar acceso"}</h3>
      <p>
        Consulta el catálogo de un ciclo para elegir carreras. Los permisos
        continúan vigentes entre ciclos hasta que Administración los cambie; el
        ciclo consultado no limita su duración.
      </p>
      {newUser && (
        <label>
          Nombre
          <input
            value={name}
            disabled={busy || !!creation}
            onChange={(e) => {
              invalidate();
              setName(e.target.value);
            }}
          />
        </label>
      )}
      <label>
        Correo exacto de la cuenta
        <input
          type="email"
          value={email}
          disabled={busy || !!creation}
          onChange={(e) => {
            invalidate();
            setAccount(null);
            setEmail(e.target.value);
          }}
        />
      </label>
      {!newUser && (
        <button disabled={busy || !email.trim()} onClick={() => void lookup()}>
          Buscar cuenta
        </button>
      )}
      {account && !account.found && (
        <p role="status">
          No existe una cuenta con ese correo. Solicita su alta por el
          procedimiento autorizado; no se creó ninguna cuenta ni se envió
          invitación.
        </p>
      )}
      {account?.account && (
        <p role="status">
          Cuenta encontrada: {account.account.name} · {account.account.email}
          {account.account.disabled
            ? " · Cuenta deshabilitada en Authentication"
            : ""}
        </p>
      )}
      <label>
        Ciclo del catálogo
        <select
          disabled={busy}
          value={cycle}
          onChange={(e) => {
            invalidate();
            setMember({ ...member, careers: existing });
            setCatalog(null);
            setResponsible("");
            setError("");
            setCycle(e.target.value);
          }}
        >
          <option value="">Seleccionar ciclo</option>
          {overview.cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id}
            </option>
          ))}
        </select>
      </label>
      {!cycle && (
        <p>
          Primero prepara el ciclo y confirma su catálogo en Administración →
          Fuentes.
        </p>
      )}
      {cycle && !catalog && <p role="status">Consultando catálogo…</p>}
      {catalog && !catalog.version && (
        <p>
          Sin catálogo confirmado. Carga y confirma padrón y catálogo en
          Administración → Fuentes.
        </p>
      )}
      {(account?.found || newUser) && (
        <fieldset disabled={busy || !!creation}>
          <legend>Acceso propuesto</legend>
          <label>
            Rol
            <select
              value={member.role}
              onChange={(e) =>
                update({ ...member, role: e.target.value as Member["role"] })
              }
            >
              <option value="coordinator">Coordinador</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          {!newUser && (
            <label>
              <input
                type="checkbox"
                role="switch"
                checked={member.active}
                onChange={(e) =>
                  update({ ...member, active: e.target.checked })
                }
              />
              Acceso activo
            </label>
          )}
          {member.role === "admin" && (
            <p>
              Administrador tiene acceso institucional completo. Las carreras
              conservadas no limitan ese rol.
            </p>
          )}
          <p>
            Permisos existentes:{" "}
            {account?.member
              ? `${account.member.role === "admin" ? "Administrador" : "Coordinador"} · ${account.member.active ? "Activo" : "Inactivo"}`
              : "Sin acceso asignado"}
            .
          </p>
          <ul>
            {existing.map((id) => (
              <li key={id}>{label(id)}</li>
            ))}
          </ul>
          <label>
            Buscar carrera o responsable
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label>
            Filtrar por responsable
            <select
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
            >
              <option value="">Todos los responsables</option>
              {[...new Set(known.map((c) => c.responsible))].sort().map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <p>
            La relación con el responsable ayuda a elegir; no concede permisos
            automáticamente.
          </p>
          <button
            type="button"
            disabled={!filtered.length}
            onClick={() =>
              update({
                ...member,
                careers: [
                  ...new Set([...member.careers, ...filtered.map((c) => c.id)]),
                ],
              })
            }
          >
            Seleccionar carreras visibles
          </button>
          <div role="group" aria-label="Carreras del catálogo">
            {filtered.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={member.careers.includes(c.id)}
                  onChange={(e) => toggle(c.id, e.target.checked)}
                />
                {label(c.id)} · Responsable: {c.responsible}
              </label>
            ))}
            {!filtered.length && <p>No hay carreras que coincidan.</p>}
          </div>
          {!!missing.length && (
            <div role="group" aria-label="Permisos fuera del catálogo">
              <p>
                Estos permisos no aparecen en el catálogo consultado. Se
                conservan; desmárcalos únicamente si decides retirarlos tras
                revisión.
              </p>
              {missing.map((id) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={member.careers.includes(id)}
                    onChange={(e) => toggle(id, e.target.checked)}
                  />
                  {label(id)}
                </label>
              ))}
            </div>
          )}
          <p>{member.careers.length} carreras seleccionadas.</p>
          <button
            disabled={
              !catalog?.version || (newUser && (!name.trim() || !email.trim()))
            }
            onClick={() => void prepare()}
          >
            {newUser ? "Revisar alta" : "Revisar cambios de acceso"}
          </button>
        </fieldset>
      )}
      {review && (
        <section aria-label="Resumen de acceso">
          <h4>Revisar antes de confirmar</h4>
          <p>
            {newUser ? name : account?.account?.name} ·{" "}
            {newUser ? email : account?.account?.email}
          </p>
          <p>
            Rol: {member.role === "admin" ? "Administrador" : "Coordinador"}.
            Acceso {member.active ? "activo" : "inactivo"}.
          </p>
          {(
            [
              ["Se conceden", review.added],
              ["Se retiran", review.removed],
              ["Se conservan", review.retained],
            ] as const
          ).map(([title, ids]) => (
            <div key={title}>
              <strong>{title}</strong>
              <ul>
                {ids.length ? (
                  ids.map((id) => <li key={id}>{label(id)}</li>)
                ) : (
                  <li>Ninguna carrera</li>
                )}
              </ul>
            </div>
          ))}
          <label>
            <input
              type="checkbox"
              disabled={busy}
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            He revisado la cuenta, el rol y las carreras que se conceden o
            retiran.
          </label>
          <button
            disabled={busy || !confirmed || !!creation}
            onClick={() => void save()}
          >
            {newUser ? "Confirmar alta" : "Confirmar acceso"}
          </button>
        </section>
      )}
      {creation && (
        <p role="status">
          Cuenta {creation.accountCreated ? "creada" : "existente"}. Permisos{" "}
          {creation.permissionsAssigned
            ? "asignados"
            : "pendientes de revisión"}
          . Activación:{" "}
          {creation.activation === "accepted"
            ? "solicitud aceptada por Firebase; entrega en el buzón no comprobada"
            : creation.activation === "synthetic_not_sent"
              ? "sin envío externo a cuenta sintética"
              : "pendiente; recupera el alta desde Usuarios y accesos"}
          .
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
