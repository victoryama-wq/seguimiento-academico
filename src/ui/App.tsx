import { useEffect, useState } from "react";
import { checkEnvironment } from "../infrastructure/firebase";

const sections = [
  "Panel",
  "Ciclos y cortes",
  "Fuentes",
  "Configuración",
] as const;
type Section = (typeof sections)[number];
type Connection = "loading" | "ready" | "error";

export function App() {
  const [section, setSection] = useState<Section>("Panel");
  const [connection, setConnection] = useState<Connection>("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    checkEnvironment().then(
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
          Desarrollo local<p>Etapa 01 · Base de la aplicación</p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Gestión académica <span className="separator">/</span> {section}
          </span>
          <span className="environment">ENTORNO EMULADO</span>
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
                Comprobando conexión con los emuladores…
              </p>
            )}
            {connection === "ready" && (
              <p role="status">
                <span className="status-dot" />
                Conexión local verificada · Sin sesión iniciada
              </p>
            )}
            {connection === "error" && (
              <div role="alert">
                <p>
                  No se pudo verificar la conexión local. Revisa la
                  configuración e inicia los emuladores.
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
          {section === "Panel" ? (
            <>
              <section className="empty-card" aria-labelledby="empty-title">
                <div className="empty-illustration" aria-hidden="true">
                  <div />
                  <div />
                  <div />
                  <span>—</span>
                </div>
                <p className="eyebrow">EL PUNTO DE PARTIDA</p>
                <h2 id="empty-title">Aún no hay un corte disponible</h2>
                <p>
                  El panel mostrará resultados cuando se configure un ciclo y se
                  publique un corte con fuentes validadas.
                </p>
                <button
                  className="primary-button"
                  onClick={() => setSection("Ciclos y cortes")}
                >
                  Ver preparación del ciclo <span aria-hidden="true">→</span>
                </button>
                <small>No hay datos académicos cargados.</small>
              </section>
              <section
                className="preparation"
                aria-labelledby="preparation-title"
              >
                <div className="section-heading">
                  <h2 id="preparation-title">Antes del primer corte</h2>
                  <span>Por configurar</span>
                </div>
                <div className="preparation-grid">
                  <article>
                    <span className="step">01</span>
                    <h3>Ciclo y calendario</h3>
                    <p>
                      Definir el periodo académico y las fechas de los cortes.
                    </p>
                  </article>
                  <article>
                    <span className="step">02</span>
                    <h3>Fuentes y actividades</h3>
                    <p>
                      Validar padrón, catálogo y actividades incluidas por
                      curso.
                    </p>
                  </article>
                  <article>
                    <span className="step">03</span>
                    <h3>Acceso autorizado</h3>
                    <p>
                      Asignar responsables y permisos para cada coordinación.
                    </p>
                  </article>
                </div>
              </section>
            </>
          ) : (
            <section
              className="empty-card details"
              aria-labelledby="section-title"
            >
              <p className="eyebrow">POR CONFIGURAR</p>
              <h2 id="section-title">
                {section === "Ciclos y cortes"
                  ? "El calendario se definirá con el primer ciclo"
                  : section === "Fuentes"
                    ? "Todavía no se han incorporado fuentes"
                    : "Los accesos están pendientes de configuración"}
              </h2>
              <p>
                {section === "Ciclos y cortes"
                  ? "Las fechas y selecciones de actividades requieren confirmación académica. La gestión de ciclos se incorporará en una etapa posterior."
                  : section === "Fuentes"
                    ? "La carga de archivos y la revisión de incidencias se incorporarán en etapas posteriores. No se han procesado archivos privados."
                    : "La autenticación y las membresías se incorporarán en una etapa posterior. En esta base, el acceso a Firestore y Storage está bloqueado."}
              </p>
              <button
                className="secondary-button"
                onClick={() => setSection("Panel")}
              >
                Volver al panel
              </button>
            </section>
          )}
          <footer>
            Seguimiento académico{" "}
            <span>Base local · Sin conexión a producción</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
