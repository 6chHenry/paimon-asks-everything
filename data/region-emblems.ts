import type { Progress } from "@/lib/domain";

export type NamedRegion = Exclude<Progress, "unknown">;

export const selectableRegions: NamedRegion[] = [
  "mondstadt",
  "liyue",
  "inazuma",
  "sumeru",
  "fontaine",
  "natlan",
  "nodkrai",
  "snezhnaya",
];

export const regionEmblemSources: Record<NamedRegion, string> = {
  mondstadt: "https://static.wikia.nocookie.net/gensin-impact/images/9/99/Emblem_Mondstadt_White.png/revision/latest?cb=20220301033214",
  liyue: "https://static.wikia.nocookie.net/gensin-impact/images/4/49/Emblem_Liyue_White.png/revision/latest?cb=20220301033230",
  inazuma: "https://static.wikia.nocookie.net/gensin-impact/images/5/51/Emblem_Inazuma_White.png/revision/latest?cb=20220301030931",
  sumeru: "https://static.wikia.nocookie.net/gensin-impact/images/6/6a/Emblem_Sumeru_White.png/revision/latest?cb=20220718184158",
  fontaine: "https://static.wikia.nocookie.net/gensin-impact/images/7/7b/Emblem_Fontaine_White.png/revision/latest?cb=20230807032406",
  natlan: "https://static.wikia.nocookie.net/gensin-impact/images/1/10/Emblem_Natlan_White.png/revision/latest?cb=20240828024938",
  nodkrai: "https://static.wikia.nocookie.net/gensin-impact/images/6/62/Emblem_Nod-Krai_White.png/revision/latest?cb=20250912003225",
  snezhnaya: "https://static.wikia.nocookie.net/gensin-impact/images/5/5a/Emblem_Snezhnaya.png/revision/latest?cb=20260429032726",
};

export function isNamedRegion(progress: Progress): progress is NamedRegion {
  return progress !== "unknown";
}
