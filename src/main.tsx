// Application entry point - force cache refresh
// MUST stay the first import: installs the session-token fetch wrapper before any module
// (storage.ts syncs at import time) can call the API. See boot.ts.
import "./lib/boot";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";


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

