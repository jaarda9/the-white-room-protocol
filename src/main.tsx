// Application entry point - force cache refresh
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";
import { installAuthFetch } from "./lib/session-token";

// Before anything renders or fetches: every /api/ call carries this device's session.
installAuthFetch();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

