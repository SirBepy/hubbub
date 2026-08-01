// Optional per-game pre-game settings SCHEMA. The TV renders the panel (apps/screen's
// config-panel), the host's phone is a remote (apps/controller's config-remote). Games without
// a schema (ttt, uttt, tap-race) skip configuring entirely and start immediately on lobbyConfirm
// - no sync test needed here since this map is intentionally partial.
import type { SettingsSchema } from "@hubbub/sdk";
import { MUSIC_GUESSER_SETTINGS_SCHEMA } from "@hubbub/game-music-guesser/settings";

export const GAME_SETTINGS_SCHEMAS: Partial<Record<string, SettingsSchema>> = {
  "music-guesser": MUSIC_GUESSER_SETTINGS_SCHEMA,
};

export function getSettingsSchema(gameId: string | null): SettingsSchema | null {
  return gameId ? GAME_SETTINGS_SCHEMAS[gameId] ?? null : null;
}

export type { SettingsSchema, SettingsField, SettingsFieldOption } from "@hubbub/sdk";
