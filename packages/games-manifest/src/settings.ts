// Optional per-game pre-game settings panel (host-only, phone-side - the only input surface).
// Games without one (ttt, uttt, tap-race) start immediately on lobbyConfirm; no sync test needed
// here since this map is intentionally partial.
import type { ComponentType } from "react";
import { MusicGuesserSettings } from "@hubbub/game-music-guesser/settings";

export type SettingsComponent = ComponentType<{
  onConfirm: (options: unknown) => void;
  onCancel: () => void;
  /** Surfaced when the server's async setup (e.g. a Deezer fetch) fails after a previous confirm. */
  error?: string;
}>;

export const GAME_SETTINGS: Partial<Record<string, SettingsComponent>> = {
  "music-guesser": MusicGuesserSettings as SettingsComponent,
};

export function getSettings(gameId: string | null): SettingsComponent | null {
  return gameId ? GAME_SETTINGS[gameId] ?? null : null;
}
