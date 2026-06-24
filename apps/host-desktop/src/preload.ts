import { contextBridge } from "electron";

const PREFIX = "--hubbub-config=";
const arg = process.argv.find((a) => a.startsWith(PREFIX));
let config = {};
if (arg) {
  try {
    config = JSON.parse(arg.slice(PREFIX.length));
  } catch (err) {
    console.error("Invalid --hubbub-config argument:", err);
  }
}

contextBridge.exposeInMainWorld("__HUBBUB__", config);
