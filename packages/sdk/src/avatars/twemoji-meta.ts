// id/label only, mechanically extracted from twemoji.ts so the picker/catalog never
// pulls the heavy per-icon art data into the eager bundle.
export type TwemojiMeta = { id: string; label: string };

export const TWEMOJI_META: TwemojiMeta[] = [
  { id: "tw:alien", label: "alien" },
  { id: "tw:alien_monster", label: "alien monster" },
  { id: "tw:bear", label: "bear" },
  { id: "tw:clown", label: "clown" },
  { id: "tw:cow_face", label: "cow face" },
  { id: "tw:crab", label: "crab" },
  { id: "tw:dragon_face", label: "dragon face" },
  { id: "tw:fox", label: "fox" },
  { id: "tw:frog", label: "frog" },
  { id: "tw:ghost", label: "ghost" },
  { id: "tw:goblin", label: "goblin" },
  { id: "tw:hedgehog", label: "hedgehog" },
  { id: "tw:lion", label: "lion" },
  { id: "tw:monkey_face", label: "monkey face" },
  { id: "tw:octopus", label: "octopus" },
  { id: "tw:ogre", label: "ogre" },
  { id: "tw:robot", label: "robot" },
  { id: "tw:skull", label: "skull" },
  { id: "tw:t-rex", label: "t rex" },
  { id: "tw:unicorn", label: "unicorn" },
];
