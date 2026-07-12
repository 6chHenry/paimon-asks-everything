import type { PaimonNote } from "@/lib/traveler-discoveries";

export const paimonNotes: PaimonNote[] = [
  {
    id: "gnosis-ledger",
    title: {
      "zh-CN": "神之心不是一条单线索",
      en: "A Gnosis is never just one clue",
    },
    body: {
      "zh-CN": "已公开剧情中，每一次神之心易手都有不同的动机与代价。",
      en: "In released stories, each Gnosis transfer carries different motives and costs.",
    },
    href: "/preheat?topicId=seven-gnosis-journeys&depth=guided",
  },
  {
    id: "evidence-boundary",
    title: {
      "zh-CN": "线索和答案不是一回事",
      en: "A clue is not the same as an answer",
    },
    body: {
      "zh-CN": "派蒙会把剧情明确说过的事，和还需要继续观察的部分分开记。",
      en: "Paimon keeps what the story has confirmed separate from what still needs observation.",
    },
    href: "/ask",
  },
  {
    id: "relationship-map",
    title: {
      "zh-CN": "关系图要从两个人开始看",
      en: "A relationship map starts with two people",
    },
    body: {
      "zh-CN": "任选两个节点，先看他们之间已经能互相印证的线索。",
      en: "Choose any two nodes and begin with the clues that already connect them.",
    },
    href: "/#snezhnaya-graph",
  },
];
