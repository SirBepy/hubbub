import { createGameAuthority, type GameLogic } from "@hubbub/sdk";
import { loadGameScreen } from "./game";
import type { AuthorityCallbacks, ScreenAuthority } from "./authority";

// S2's sentinel. This string exists nowhere else in the tree, and the production assets are
// grepped for it: if dead-code elimination ever stops dropping this module, that check fails.
// The failure mode it guards is silent - no test breaks, nothing looks different.
export const DEV_LOADER_SENTINEL = "hubbub-dev-loader-c0ffee";

/** The fast local loop: the game is a workspace package imported straight into this process, with
 * no iframe and no bundle. Never reachable in a production build - see vite.sandbox-mode.ts. */
export function createDirectAuthority(cb: AuthorityCallbacks): ScreenAuthority {
  let logic: GameLogic<unknown, unknown> | null = null;
  let gameId: string | null = null;

  const inner = createGameAuthority((state) => {
    if (!gameId) return;
    cb.onState(gameId, state);
    cb.onResult(logic?.result?.(state) ?? null);
  });

  return {
    launch(id, players, setupData, now) {
      gameId = id;
      logic = null;
      const loading = loadGameScreen(id);
      if (!loading) {
        cb.onFailure(`No such game: ${id}`);
        return;
      }
      loading
        .then((loaded) => {
          logic = loaded.logic as GameLogic<unknown, unknown>;
          inner.launch(logic, players, setupData, now);
        })
        .catch(() => cb.onFailure("This game could not be loaded."));
    },
    action: (playerId, payload, now) => inner.action(playerId, payload, now),
    playersChanged: (players) => inner.playersChanged(players),
    reset: () => {
      inner.reset();
      logic = null;
      gameId = null;
    },
  };
}
