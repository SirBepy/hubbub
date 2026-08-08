// id/label only, mechanically extracted from fluent-emoji.ts so the picker/catalog never
// pulls the heavy per-icon art data into the eager bundle.
export type FluentEmojiMeta = { id: string; label: string };

export const FLUENT_EMOJI_META: FluentEmojiMeta[] = [
  { id: "fe:alien", label: "alien" },
  { id: "fe:alien_monster", label: "alien monster" },
  { id: "fe:bear", label: "bear" },
  { id: "fe:clown_face", label: "clown face" },
  { id: "fe:cow_face", label: "cow face" },
  { id: "fe:fox", label: "fox" },
  { id: "fe:frog", label: "frog" },
  { id: "fe:ghost", label: "ghost" },
  { id: "fe:goblin", label: "goblin" },
  { id: "fe:lion", label: "lion" },
  { id: "fe:monkey_face", label: "monkey face" },
  { id: "fe:ogre", label: "ogre" },
  { id: "fe:person_zombie", label: "person zombie" },
  { id: "fe:pig_face", label: "pig face" },
  { id: "fe:robot", label: "robot" },
  { id: "fe:skull", label: "skull" },
  { id: "fe:t-rex", label: "t rex" },
  { id: "fe:tiger_face", label: "tiger face" },
  { id: "fe:unicorn", label: "unicorn" },
  { id: "fe:owl", label: "owl" },
];
