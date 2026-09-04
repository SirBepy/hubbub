// Platform-internal styleguide (lobby/join/config screens), not a game's design system
// - see hubbub-game-template/CLAUDE.md's "Design rules" section. Kept live for existing
// consumers (tap-race, music-guesser, tictactoe, uttt); a new game owns its own look.
export { PLAYER_COLORS, colorHex, colorName, shadePair, hexToRgba, rgbToHsl, hexToHsl, hslToHex } from "./palette";
export type { PlayerColor } from "./palette";

export { TVStage } from "./TVStage";
export { InputLegendTray } from "./InputLegendTray";
export { TVMeasure } from "./TVMeasure";

export { Avatar, NEUTRAL_RING } from "./Avatar";
export type { AvatarProps } from "./Avatar";

// Avatar art itself lives in @hubbub/sdk/avatars - it is framework-owned player identity, not
// styleguide. Only the catalogue names are re-exported, for this repo's own controller screens;
// anything that DRAWS an avatar imports from @hubbub/sdk/avatars directly, games included.
export {
  AVATAR_SETS,
  ALL_AVATAR_IDS,
  isAvatarCharacterId,
  randomAvatarId,
} from "@hubbub/sdk/avatars";
export type { AvatarSet, AvatarSetId, AvatarCharacter } from "@hubbub/sdk/avatars";

export { PlayerPill } from "./PlayerPill";
export type { PlayerPillProps } from "./PlayerPill";

export { IdentityCard } from "./IdentityCard";
export type { IdentityCardProps } from "./IdentityCard";

export { MiniIdentity } from "./MiniIdentity";
export type { MiniIdentityProps } from "./MiniIdentity";

export { GlowButton, NeutralButton } from "./GlowButton";
export type { GlowButtonProps, NeutralButtonProps } from "./GlowButton";

export { GameTopBar } from "./GameTopBar";
export type { GameTopBarProps, GameTopBarPlayer } from "./GameTopBar";

export { EndOfRoundScreen } from "./EndOfRoundScreen";
export type {
  EndOfRoundScreenProps,
  EndOfRoundWinner,
  EndOfRoundBreakdownRow,
  EndOfRoundStandingRow,
} from "./EndOfRoundScreen";

export { KeyArt, gameKeyArtHexes } from "./KeyArt";
export type { KeyArtProps } from "./KeyArt";

export { GameLoadingScreen } from "./GameLoadingScreen";
export type { GameLoadingScreenProps } from "./GameLoadingScreen";

export { useLoadingGate, LOADER_SHOW_AFTER_MS, LOADER_MIN_VISIBLE_MS } from "./useLoadingGate";
export type { LoadingGate } from "./useLoadingGate";

export { ConnectionBadge } from "./ConnectionBadge";
export type { ConnectionBadgeProps } from "./ConnectionBadge";

export { hostLabelFontScale } from "./host-label-scale";
