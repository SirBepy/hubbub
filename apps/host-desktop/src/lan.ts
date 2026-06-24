import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

/** Returns the first non-internal IPv4 address on this machine, or 127.0.0.1 if none. */
export function getLanIp(
  ifaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): string {
  for (const list of Object.values(ifaces)) {
    for (const info of list ?? []) {
      if (info.family === "IPv4" && !info.internal) return info.address;
    }
  }
  return "127.0.0.1";
}
