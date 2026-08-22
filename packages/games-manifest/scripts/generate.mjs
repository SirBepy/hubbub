#!/usr/bin/env node
// Regenerates src/logics.ts, src/lazy.ts and src/settings.ts, omitting any external game whose
// sibling repo isn't checked out on disk. Run via `pnpm --filter @hubbub/games generate`; also
// wired into postinstall and the turbo build/typecheck/dev/test graph.
// Registering a game = one entry below + one optionalDependency in package.json.
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Registry keys only need quoting when the id isn't a bare identifier ("tap-race" is, "ttt" isn't).
const key = (id) => (/^[A-Za-z_$][\w$]*$/.test(id) ? id : JSON.stringify(id));

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(packageDir, "src");

const CORE_GAMES = [
  { id: "ttt", pkg: "@hubbub/game-tictactoe", screen: "TTTScreen", controller: "TTTController", logic: "tttLogic" },
  {
    id: "uttt",
    pkg: "@hubbub/game-ultimate-tictactoe",
    screen: "UTTTScreen",
    controller: "UTTTController",
    logic: "utttLogic",
  },
];

const EXTERNAL_GAMES = [
  {
    id: "tap-race",
    pkg: "@hubbub/game-tap-race",
    dir: "hubbub-game-tap-race",
    screen: "TapRaceScreen",
    controller: "TapRaceController",
    logic: "tapRaceLogic",
    settings: null,
  },
  {
    id: "music-guesser",
    pkg: "@hubbub/game-music-guesser",
    dir: "hubbub-game-music-guesser",
    screen: "MusicGuesserScreen",
    controller: "MusicGuesserController",
    logic: "musicGuesserLogic",
    settings: "MUSIC_GUESSER_SETTINGS_SCHEMA",
  },
  {
    id: "split-opinions",
    pkg: "@hubbub/game-split-opinions",
    dir: "hubbub-game-split-opinions",
    screen: "SplitOpinionsScreen",
    controller: "SplitOpinionsController",
    logic: "splitOpinionsLogic",
    settings: "SPLIT_OPINIONS_SETTINGS_SCHEMA",
  },
];

// Siblings live next to the hubbub checkout: packages/games-manifest/../../.. == the parent
// of hubbub, matching package.json's own "link:../../../hubbub-game-<id>" specifiers.
const siblingsRoot = path.resolve(packageDir, "..", "..", "..");
const present = EXTERNAL_GAMES.filter((g) => existsSync(path.join(siblingsRoot, g.dir, "package.json")));
const games = [...CORE_GAMES, ...present];

function logicsSource() {
  const imports = games.map((g) => `import { ${g.logic} } from "${g.pkg}";`).join("\n");
  const entries = games.map((g) => `  ${key(g.id)}: ${g.logic},`).join("\n");
  return `// GENERATED and untracked: rewritten on install by scripts/generate.mjs.
// Eager registry for the SERVER and host-desktop; browsers use ./lazy.ts instead. A sibling
// game repo absent on disk is omitted here rather than left as an unresolvable import.
import type { GameRegistry } from "@hubbub/sdk";
${imports}

export const GAME_LOGICS: GameRegistry = {
${entries}
};

export const GAME_IDS = Object.keys(GAME_LOGICS);

export function getLogic(gameId: string | null) {
  return gameId ? GAME_LOGICS[gameId] ?? null : null;
}
`;
}

function lazySource() {
  const chunks = games
    .map(
      (g) => `  ${key(g.id)}: {
    screen: () => import("${g.pkg}/screen").then((m) => m.${g.screen} as ScreenComponent),
    controller: () => import("${g.pkg}/controller").then((m) => m.${g.controller} as ControllerComponent),
    logic: () => import("${g.pkg}").then((m) => m.${g.logic}),
  },`,
    )
    .join("\n");
  return `// GENERATED and untracked: rewritten on install by scripts/generate.mjs.
// Browser-side registry. Every entry is a dynamic import() so a game's views and logic leave
// the initial chunk. A sibling game repo absent on disk is omitted, matching ./logics.ts.
import type { ComponentType } from "react";
import type { Player } from "@hubbub/protocol";
import type { GameRegistry } from "@hubbub/sdk";

export type ScreenComponent = ComponentType<{ state: any; players: Player[] }>;
export type ControllerComponent = ComponentType<{
  state: any;
  playerId: string;
  players: Player[];
  send: (a: any) => void;
}>;

type GameLogic = GameRegistry[string];

type GameChunk = {
  screen: () => Promise<ScreenComponent>;
  controller: () => Promise<ControllerComponent>;
  logic: () => Promise<GameLogic>;
};

export const GAME_CHUNKS: Record<string, GameChunk> = {
${chunks}
};

export type LoadedGameScreen = { Screen: ScreenComponent; logic: GameLogic };
export type LoadedGameController = { Controller: ControllerComponent; logic: GameLogic };

/** null for an unknown id, so a caller can tell "no such game" from "still loading". */
export function loadGameScreen(gameId: string | null): Promise<LoadedGameScreen> | null {
  const chunk = gameId ? GAME_CHUNKS[gameId] : undefined;
  if (!chunk) return null;
  return Promise.all([chunk.screen(), chunk.logic()]).then(([Screen, logic]) => ({ Screen, logic }));
}

export function loadGameController(gameId: string | null): Promise<LoadedGameController> | null {
  const chunk = gameId ? GAME_CHUNKS[gameId] : undefined;
  if (!chunk) return null;
  return Promise.all([chunk.controller(), chunk.logic()]).then(([Controller, logic]) => ({ Controller, logic }));
}
`;
}

function settingsSource() {
  const withSettings = games.filter((g) => g.settings);
  const imports = withSettings.map((g) => `import { ${g.settings} } from "${g.pkg}/settings";`).join("\n");
  const entries = withSettings.map((g) => `  ${key(g.id)}: ${g.settings},`).join("\n");
  return `// GENERATED and untracked: rewritten on install by scripts/generate.mjs.
// Optional per-game settings SCHEMA, EAGER on the browser path - keep each game's own
// settings-schema.ts an import leaf (enforced by settings-schema-leaf.test.ts). A game with no
// schema, or whose sibling repo is absent on disk, is skipped; this map is intentionally partial.
import type { SettingsSchema } from "@hubbub/sdk";
${imports}

export const GAME_SETTINGS_SCHEMAS: Partial<Record<string, SettingsSchema>> = {
${entries}
};

export function getSettingsSchema(gameId: string | null): SettingsSchema | null {
  return gameId ? GAME_SETTINGS_SCHEMAS[gameId] ?? null : null;
}

export type { SettingsSchema, SettingsField, SettingsFieldOption } from "@hubbub/sdk";
`;
}

await Promise.all([
  writeFile(path.join(srcDir, "logics.ts"), logicsSource()),
  writeFile(path.join(srcDir, "lazy.ts"), lazySource()),
  writeFile(path.join(srcDir, "settings.ts"), settingsSource()),
]);

const missing = EXTERNAL_GAMES.filter((g) => !present.includes(g)).map((g) => g.id);
console.log(
  `@hubbub/games: generated for [${games.map((g) => g.id).join(", ")}]` +
    (missing.length ? ` - sibling repo absent, skipped: ${missing.join(", ")}` : ""),
);
