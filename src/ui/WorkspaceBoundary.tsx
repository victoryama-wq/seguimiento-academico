import { Component, type ReactNode } from "react";

export class WorkspaceBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div role="alert">
          <p>
            No se pudo cargar el espacio de trabajo. Recarga para reintentar;
            los trabajos aceptados se conservan en el servidor.
          </p>
          <button onClick={() => window.location.reload()}>
            Recargar espacio de trabajo
          </button>
        </div>
      );
    return this.props.children;
  }
}
