import { createServer as createWsServer } from "@hubbub/server";
import { GAME_LOGICS } from "@hubbub/games-manifest";
import type { GameRegistry } from "@hubbub/sdk";
import { getLanIp } from "./lan.js";
import { startStaticServer } from "./static-server.js";

export interface HostOptions {
  screenDir: string;
  controllerDir: string;
  wsPort?: number;
  controllerPort?: number;
  screenPort?: number;
  games?: GameRegistry;
}

export interface RunningHost {
  lanIp: string;
  serverUrl: string;
  controllerUrl: string;
  screenUrl: string;
  wsPort: number;
  close: () => Promise<void>;
}

export async function startHost(opts: HostOptions): Promise<RunningHost> {
  const lanIp = getLanIp();

  const ws = createWsServer(opts.wsPort ?? 7787, opts.games ?? GAME_LOGICS);
  const wsPort = (ws.server.address() as { port: number }).port;

  let controller: Awaited<ReturnType<typeof startStaticServer>> | undefined;
  let screen: Awaited<ReturnType<typeof startStaticServer>> | undefined;
  try {
    controller = await startStaticServer(
      opts.controllerDir,
      opts.controllerPort ?? 7780,
      "0.0.0.0",
    );
    screen = await startStaticServer(
      opts.screenDir,
      opts.screenPort ?? 7781,
      "127.0.0.1",
    );
  } catch (err) {
    await ws.close();
    await controller?.close();
    throw err;
  }

  return {
    lanIp,
    serverUrl: `ws://localhost:${wsPort}`,
    controllerUrl: `http://${lanIp}:${controller!.port}`,
    screenUrl: `http://127.0.0.1:${screen!.port}`,
    wsPort,
    close: async () => {
      await ws.close();
      await controller!.close();
      await screen!.close();
    },
  };
}
