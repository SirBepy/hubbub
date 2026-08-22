// id/label only, mechanically extracted from game-icons.ts so the picker/catalog never
// pulls the heavy per-icon art data into the eager bundle.
export type GameIconMeta = { id: string; label: string };

export const GAME_ICONS_META: GameIconMeta[] = [
  { id: "gi:bear-head", label: "bear head" },
  { id: "gi:camel-head", label: "camel head" },
  { id: "gi:cow", label: "cow" },
  { id: "gi:elephant-head", label: "elephant head" },
  { id: "gi:gorilla", label: "gorilla" },
  { id: "gi:horse-head", label: "horse head" },
  { id: "gi:panda", label: "panda" },
  { id: "gi:penguin", label: "penguin" },
  { id: "gi:shark-fin", label: "shark fin" },
  { id: "gi:squirrel", label: "squirrel" },
  { id: "gi:tiger-head", label: "tiger head" },
  { id: "gi:crab", label: "crab" },
  { id: "gi:fox-head", label: "fox head" },
  { id: "gi:frog", label: "frog" },
  { id: "gi:lion", label: "lion" },
  { id: "gi:octopus", label: "octopus" },
  { id: "gi:owl", label: "owl" },
  { id: "gi:turtle", label: "turtle" },
];
