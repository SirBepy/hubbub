import { contextBridge } from "electron";

const PREFIX = "--hubbub-config=";
const arg = process.argv.find((a) => a.startsWith(PREFIX));
const config = arg ? JSON.parse(arg.slice(PREFIX.length)) : {};

contextBridge.exposeInMainWorld("__HUBBUB__", config);
