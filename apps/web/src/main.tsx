import "@hubbub/ui/styles.css";
import "./bootstrap-config";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
