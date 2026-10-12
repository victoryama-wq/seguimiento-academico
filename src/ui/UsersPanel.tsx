import { useEffect, useState } from "react";
import { z } from "zod";
import {
  directorySchema,
  newUserResultSchema,
} from "../domain/access-contract";
import { callAcademic } from "../infrastructure/academic-api";
import type { Overview } from "../domain/import-contract";
import AccessAssignment from "./AccessAssignment";

export default function UsersPanel({ overview }: { overview: Overview }) {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(),
    [page, setPage] = useState<z.infer<typeof directorySchema> | null>(null);
  const [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [editor, setEditor] = useState({ email: "", newUser: false, key: 0 });
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    void callAcademic(
      "listAccessUsers",
      { search: query, ...(cursor ? { pageToken: cursor } : {}) },
      directorySchema,
    )
      .then((v) => {
        if (live) setPage(v);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [query, cursor, version]);
  function open(email: string, newUser = false) {
    setEditor((v) => ({ email, newUser, key: v.key + 1 }));
  }
  async function recover(selectedId?: string) {
    const id = selectedId ?? localStorage.getItem("pending-user-creation");
    if (!id) {
      setNotice(
        "No hay un alta pendiente guardada en este navegador. Busca la cuenta para revisar sus permisos.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      let v = await callAcademic(
        "confirmNewUser",
        { reviewId: id },
        newUserResultSchema,
      );
      if (v.permissionsAssigned || v.accountCreated)
        v = await callAcademic(
          "activateAccessUser",
          { reviewId: id, attemptId: crypto.randomUUID() },
          newUserResultSchema,
        );
      setNotice(
        v.existing
          ? "La cuenta ya existía; abre sus permisos sin sustituir su identidad."
          : `Cuenta ${v.accountCreated ? "creada" : "pendiente"}. Permisos ${v.permissionsAssigned ? "asignados" : "pendientes: busca la cuenta y revisa nuevamente"}. Activación ${v.activation === "accepted" ? "aceptada por Firebase; entrega no comprobada" : v.activation === "synthetic_not_sent" ? "sin envío externo a cuenta sintética" : "pendiente; puedes reintentar"}.`,
      );
      if (
        v.permissionsAssigned &&
        ["accepted", "synthetic_not_sent"].includes(v.activation)
      )
        localStorage.removeItem("pending-user-creation");
      open(v.email);
      setVersion((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Usuarios y accesos" className="guided-intake">
      <h2>Usuarios y accesos</h2>
      <button onClick={() => open("", true)}>Nuevo usuario</button>{" "}
      <button disabled={busy} onClick={() => void recover()}>
        Recuperar alta pendiente
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setCursor(undefined);
          setPage(null);
          setQuery(search);
          setVersion((n) => n + 1);
        }}
      >
        <label>
          Buscar usuarios por nombre o correo
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <button>Buscar usuarios</button>
      </form>
      {!page ? (
        <p role="status">Consultando cuentas…</p>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Rol y estado</th>
                  <th>Carreras</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {page.users.map((u, i) => (
                  <tr key={`${u.email}-${i}`}>
                    <td>
                      {u.name}
                      <br />
                      {u.email || "Sin correo registrado"}
                    </td>
                    <td>
                      {u.member?.role === "admin"
                        ? "Administrador · alcance institucional"
                        : u.member
                          ? "Coordinador"
                          : "Sin permisos académicos"}
                      <br />
                      {u.disabled
                        ? "Cuenta deshabilitada"
                        : "Cuenta habilitada"}
                      <br />
                      {u.member
                        ? u.member.active
                          ? "Acceso activo"
                          : "Acceso inactivo"
                        : "Acceso sin asignar"}
                    </td>
                    <td>{u.careerNames.join("; ") || "Sin asignaciones"}</td>
                    <td>
                      <button disabled={!u.email} onClick={() => open(u.email)}>
                        Gestionar {u.email || u.name}
                      </button>
                      {u.pendingCreation && (
                        <button
                          disabled={busy}
                          onClick={() => void recover(u.pendingCreation!)}
                        >
                          Recuperar alta de {u.name}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!page.users.length && (
            <p>
              No hay coincidencias en esta página. Continúa si hay más cuentas.
            </p>
          )}
          <button
            disabled={!cursor}
            onClick={() => {
              setCursor(undefined);
              setPage(null);
            }}
          >
            Primera página
          </button>{" "}
          <button
            disabled={!page.nextPageToken}
            onClick={() => {
              setCursor(page.nextPageToken!);
              setPage(null);
            }}
          >
            Siguiente página
          </button>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <AccessAssignment
        key={editor.key}
        overview={overview}
        initialEmail={editor.email}
        newUser={editor.newUser}
        onExisting={(email) => {
          setNotice(
            "El correo ya existe. Gestiona la cuenta existente; no se creó otra ni se sustituyó su identidad.",
          );
          open(email);
        }}
        onSaved={() => setVersion((n) => n + 1)}
      />
    </section>
  );
}
