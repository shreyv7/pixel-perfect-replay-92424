import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { RasProvider } from "@/lib/ras/store";
import { Toaster } from "@/components/ui/sonner";
import App from "@/routes/index";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <RasProvider>
      <App />
      <Toaster position="top-right" richColors />
    </RasProvider>
  </BrowserRouter>,
);
