import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { startHost, type RunningHost } from "./host.js";

let host: RunningHost | undefined;

async function createWindow() {
  const base = app.isPackaged ? process.resourcesPath : join(__dirname, "..");

  host = await startHost({
    screenDir: join(base, "static", "screen"),
    controllerDir: join(base, "static", "controller"),
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#111111",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // This window IS the TV: nobody clicks it before the game's sound effects need to play.
      autoplayPolicy: "no-user-gesture-required",
      additionalArguments: [
        `--hubbub-config=${JSON.stringify({
          serverUrl: host.serverUrl,
          controllerUrl: host.controllerUrl,
        })}`,
      ],
    },
  });

  await win.loadURL(host.screenUrl + "/");
}

app.whenReady().then(createWindow).catch((err) => {
  console.error("Failed to start Hubbub host:", err);
  app.quit();
});

app.on("window-all-closed", async () => {
  await host?.close();
  host = undefined;
  if (process.platform !== "darwin") app.quit();
});
