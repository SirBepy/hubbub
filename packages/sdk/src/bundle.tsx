import { createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GameInstance } from "./runtime.js";
import { ShellToFrameSchema, type FrameToShell, type GameBundle } from "./bridge.js";
import type { DisplayPlayer, GameLogic } from "./types.js";

export type { GameBundle };

export interface GameBundleParts<State, Action> {
  logic: GameLogic<State, Action>;
  Screen: ComponentType<{ state: State; players: DisplayPlayer[] }>;
  Controller: ComponentType<{
    state: State;
    playerId: string;
    players: DisplayPlayer[];
    send: (action: Action) => void;
  }>;
}

/** Every game's `src/bundle.ts` default-exports this. It ships INSIDE the bundle, so the React
 * and ReactDOM it renders with are the bundle's own copies - a component compiled against one
 * React cannot be rendered by another. Not a security boundary: this is as author-controlled as
 * the game, and the shell revalidates every message coming back over the port. */
export function defineGameBundle<State, Action>(parts: GameBundleParts<State, Action>): GameBundle {
  return {
    logic: parts.logic as GameLogic<any, any>,
    attach({ root, port, role }) {
      const reactRoot: Root = createRoot(root);
      const post = (msg: FrameToShell) => port.postMessage(msg);

      let players: DisplayPlayer[] = [];
      let instance: GameInstance<State, Action> | null = null;
      let state: State | null = null;
      let playerId = "";

      function renderScreen() {
        if (state === null) return;
        reactRoot.render(createElement(parts.Screen, { state, players }));
      }

      function renderController() {
        if (state === null) return;
        reactRoot.render(
          createElement(parts.Controller, {
            state,
            playerId,
            players,
            send: (action: Action) => post({ t: "action", action }),
          }),
        );
      }

      // Reports the whole post-step picture at once. `result` rides along on every step because
      // the shell's end-of-round chrome cannot call result() itself any more - the logic is in here.
      function publish() {
        if (!instance) return;
        state = instance.get();
        post({ t: "state", state });
        post({ t: "deadline", at: instance.nextDeadline() });
        post({ t: "result", result: parts.logic.result?.(state) ?? null });
        renderScreen();
      }

      port.onmessage = (event: MessageEvent) => {
        const parsed = ShellToFrameSchema.safeParse(event.data);
        if (!parsed.success) return;
        const msg = parsed.data;

        if (role === "controller") {
          if (msg.t === "state") {
            state = msg.state as State;
            playerId = msg.playerId;
            renderController();
          } else if (msg.t === "playersChanged" || msg.t === "launch") {
            players = msg.players;
            renderController();
          }
          return;
        }

        if (msg.t === "launch") {
          players = msg.players;
          instance = new GameInstance(parts.logic, players, msg.setupData, msg.now);
          publish();
        } else if (msg.t === "action") {
          if (instance?.applyAction(msg.playerId, msg.action, msg.now)) publish();
        } else if (msg.t === "playersChanged") {
          players = msg.players;
          if (!instance) return;
          instance.playersChanged(players);
          publish();
        } else if (msg.t === "timeout") {
          if (instance?.checkTimeout(msg.now)) publish();
          else if (instance) post({ t: "deadline", at: instance.nextDeadline() });
        }
      };
      port.start();
      post({ t: "ready" });
    },
  };
}
