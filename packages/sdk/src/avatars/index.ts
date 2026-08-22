// Player identity art, framework-owned - the same category as DisplayPlayer, not a game's look.
// Its own subpath rather than the SDK root: resolve.ts warms three art chunks on import, and the
// server imports @hubbub/sdk. Games draw avatars from here; @hubbub/ui only re-exports it.
export { AVATAR_SETS, ALL_AVATAR_IDS, isAvatarCharacterId, randomAvatarId } from "./catalog.js";
export type { AvatarSet, AvatarSetId, AvatarCharacter } from "./catalog.js";

export type { ResolvedAvatarCharacter } from "./resolve.js";

export { useAvatarCharacter, AvatarArt } from "./art.js";
