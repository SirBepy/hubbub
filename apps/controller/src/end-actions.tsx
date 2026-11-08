import { useRegisterInputActions } from "@hubbub/sdk/input";

/** Binds `rematch` and `back` to the host's gamepad while a result is showing. It lives in the
 * controller app, not in a game's own end buttons, because the input registry only exists here:
 * a sandboxed game runs in an iframe with no provider, so a hook called from its view would
 * register nowhere. The relay ignores a repeated rematch, so a mashed pad button is harmless. */
export function EndActions({ onRematch, onBack }: { onRematch: () => void; onBack: () => void }) {
  useRegisterInputActions([
    { id: "rematch", label: "Rematch", run: onRematch },
    { id: "back", label: "Back to lobby", run: onBack },
  ]);
  return null;
}
