import { resolveWebConfig, injectHubbubConfig } from "./config-resolve";

// Side effect at module-eval time: must run before ScreenApp/ControllerApp's own static
// imports evaluate, since their config.ts files read window.__HUBBUB__ at THEIR top level
// too. Importing this first in main.tsx (ESM evaluates deps depth-first, source order)
// guarantees that ordering without a runtime race.
injectHubbubConfig(resolveWebConfig(import.meta.env as { VITE_SERVER_URL?: string }, location));
