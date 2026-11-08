import React, { Component, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="fatal">
        <h1>Редактор не смог продолжить работу</h1>
        <p>
          Перезагрузите страницу. Несохранённые изменения могут быть потеряны.
        </p>
        <button onClick={() => location.reload()}>Перезагрузить</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
