import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ThemeProvider } from "next-themes";
import { BrowserRouter } from "react-router-dom";  
import "./styles/global.css";
import "leaflet/dist/leaflet.css";


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>   {/* ✅ FIX */}
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
