import { lazy, Suspense, useEffect, useState } from "react";
import { WorkspaceBoundary } from "./WorkspaceBoundary";

const AccessWorkspace = lazy(() =>
  import("./AccessWorkspace").then((module) => ({
    default: module.AccessWorkspace,
  })),
);

const sections = [
  "Panel",
  "Ciclos y cortes",
  "Historial y seguimiento",
  "Fuentes",
  "Configuración",
] as const;
type Section = (typeof sections)[number];
type Connection = "loading" | "ready" | "error";
const staging = import.meta.env.VITE_FIREBASE_MODE === "staging";

export function App() {
  const [section, setSection] = useState<Section>("Panel");
  const [connection, setConnection] = useState<Connection>("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    import("../infrastructure/firebase")
      .then((module) => module.checkEnvironment())
      .then(
        () => {
          if (active) setConnection("ready");
        },
        () => {
          if (active) setConnection("error");
        },
      );
    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <a className="brand" href="#main" onClick={() => setSection("Panel")}>
          <span className="brand-icon" aria-hidden="true">
            sa
          </span>
          <span>
            Seguimiento
            <br />
            <strong>académico</strong>
          </span>
        </a>
        <p className="nav-label">ESPACIO DE TRABAJO</p>
        <nav aria-label="Navegación principal">
          {sections.map((item, index) => (
            <button
              key={item}
              aria-current={section === item ? "page" : undefined}
              onClick={() => setSection(item)}
            >
              <span className="nav-number" aria-hidden="true">
                0{index + 1}
              </span>
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" />
          {staging ? "Pruebas en Firebase" : "Desarrollo local"}
          <p>Validación sintética · Aceptación pendiente</p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Gestión académica <span className="separator">/</span> {section}
          </span>
          <span className="environment">
            {staging ? "ENTORNO DE PRUEBAS" : "ENTORNO EMULADO"}
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-title">
            <p className="eyebrow">SEGUIMIENTO INSTITUCIONAL</p>
            <h1>{section === "Panel" ? "Panel académico" : section}</h1>
            <p>
              Un espacio para dar seguimiento a cada corte, con información
              validada.
            </p>
          </div>
          <div className="connection" aria-live="polite">
            {connection === "loading" && (
              <p role="status">
                <span className="spinner" aria-hidden="true" />
                {staging
                  ? "Comprobando entorno de pruebas…"
                  : "Comprobando conexión con los emuladores…"}
              </p>
            )}
            {connection === "ready" && (
              <p role="status">
                <span className="status-dot" />
                {staging
                  ? "Entorno y versión de pruebas verificados"
                  : "Conexión local verificada"}
              </p>
            )}
            {connection === "error" && (
              <div role="alert">
                <p>
                  {staging
                    ? "No se pudo verificar el entorno o la versión de pruebas. Revisa el despliegue antes de continuar."
                    : "No se pudo verificar la conexión local. Revisa la configuración e inicia los emuladores."}
                </p>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setConnection("loading");
                    setAttempt((value) => value + 1);
                  }}
                >
                  Reintentar conexión
                </button>
              </div>
            )}
          </div>
          {connection === "ready" && (
            <WorkspaceBoundary>
              <Suspense fallback={<p>Cargando acceso institucional…</p>}>
                <AccessWorkspace section={section} />
              </Suspense>
            </WorkspaceBoundary>
          )}
          <footer>
            Seguimiento académico{" "}
            <span>
              {staging
                ? `Pruebas sintéticas · Versión ${import.meta.env.VITE_RELEASE_SHA ?? "sin configurar"}`
                : "Base local · Sin conexión a producción"}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
