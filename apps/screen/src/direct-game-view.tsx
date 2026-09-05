import { useLoadingGate } from "@hubbub/ui";
import type { Player } from "@hubbub/protocol";
import { loadGameScreen } from "./game";

// S2's sentinel, mirroring direct-authority.ts: this string must not survive into a production
// build, and CI greps the built assets for it.
export const DEV_LOADER_VIEW_SENTINEL = "hubbub-dev-loader-view-c0ffee";

/** The workspace-package render path: the game's Screen component runs in this process, with no
 * iframe. Reached only from the dev loop, and dead-code-eliminated out of production. */
export default function DirectGameView({
  gameId,
  state,
  players,
}: {
  gameId: string;
  state: unknown;
  players: Player[];
}) {
  const { value: loaded } = useLoadingGate(gameId, loadGameScreen);
  if (!loaded) return null;
  const Screen = loaded.Screen;
  return <Screen state={state} players={players} />;
}
