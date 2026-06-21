import { describe, expect, it } from "vitest";
import {
  buildRelationshipQuestion,
  evidenceTierLabel,
  initialSnezhnayaNodeId,
  validateSnezhnayaGraph,
  type SnezhnayaGraphData,
} from "@/lib/snezhnaya-graph";
import { snezhnayaGraph } from "@/data/snezhnaya-graph";

const sampleGraph: SnezhnayaGraphData = {
  video: {
    title: {
      "zh-CN": "至冬生态短片",
      en: "Snezhnaya Ecology Short",
    },
    description: {
      "zh-CN": "跟着派蒙先看至冬的第一眼。",
      en: "A first look at Snezhnaya with Paimon.",
    },
    coverImageUrl: "/snezhnaya-cover.jpg",
    youtubeUrl: "https://www.youtube.com/watch?v=test",
    miyousheUrl: "https://www.miyoushe.com/ys/article/test",
  },
  nodes: [
    {
      id: "tsaritsa",
      label: { "zh-CN": "冰之女皇", en: "Tsaritsa" },
      aliases: ["女皇", "冰神"],
      kind: "character",
      tier: "official_text_index",
      summary: {
        "zh-CN": "至冬的神明，也是愚人众行动的最高指向。",
        en: "The god of Snezhnaya and the Fatui's highest direction.",
      },
      detail: {
        "zh-CN": ["她与神之心收集行动密切相关。"],
        en: ["She is closely tied to the Gnosis collection campaign."],
      },
      clues: [
        {
          id: "tsaritsa-gnosis",
          title: "Archon Quest text index",
          sourceType: "quest_text",
          tier: "official_text_index",
          url: "https://genshin-impact.fandom.com/wiki/Gnosis",
          excerpt: {
            "zh-CN": "游戏文本索引收录了愚人众收集神之心的相关剧情。",
            en: "The game text index records Fatui-related Gnosis plot text.",
          },
        },
      ],
      relatedNodeIds: ["gnosis"],
      suggestedQuestions: {
        "zh-CN": ["冰之女皇和神之心有什么关系？"],
        en: ["What is the relationship between the Tsaritsa and Gnoses?"],
      },
    },
    {
      id: "gnosis",
      label: { "zh-CN": "神之心", en: "Gnoses" },
      aliases: ["神之心"],
      kind: "concept",
      tier: "official_explicit",
      summary: {
        "zh-CN": "贯穿多国主线的重要物件。",
        en: "A key object across multiple Archon Quests.",
      },
      detail: {
        "zh-CN": ["神之心是理解至冬计划的重要线索。"],
        en: ["Gnoses are important clues for understanding Snezhnaya's plan."],
      },
      clues: [],
      relatedNodeIds: ["tsaritsa"],
      suggestedQuestions: {
        "zh-CN": ["神之心为什么重要？"],
        en: ["Why are Gnoses important?"],
      },
    },
  ],
  edges: [
    {
      id: "tsaritsa-gnosis",
      from: "tsaritsa",
      to: "gnosis",
      tier: "official_text_index",
      label: {
        "zh-CN": "神之心收集",
        en: "Gnosis collection",
      },
    },
  ],
};

describe("snezhnaya graph helpers", () => {
  it("validates a complete curated graph", () => {
    expect(validateSnezhnayaGraph(sampleGraph)).toEqual([]);
  });

  it("reports broken edge and relation references", () => {
    const broken: SnezhnayaGraphData = {
      ...sampleGraph,
      nodes: [
        {
          ...sampleGraph.nodes[0],
          relatedNodeIds: ["missing-node"],
        },
      ],
      edges: [
        {
          ...sampleGraph.edges[0],
          to: "missing-node",
        },
      ],
    };

    expect(validateSnezhnayaGraph(broken)).toEqual([
      "node:tsaritsa:related:missing-node",
      "edge:tsaritsa-gnosis:to:missing-node",
    ]);
  });

  it("labels official text indexes as factual game-text indexes", () => {
    expect(evidenceTierLabel("official_text_index", "zh-CN")).toBe(
      "官方文本索引",
    );
    expect(evidenceTierLabel("official_text_index", "en")).toBe(
      "Official text index",
    );
  });

  it("builds a Chinese relationship question with evidence boundaries", () => {
    const question = buildRelationshipQuestion({
      language: "zh-CN",
      left: sampleGraph.nodes[0],
      right: sampleGraph.nodes[1],
    });

    expect(question).toContain("冰之女皇");
    expect(question).toContain("神之心");
    expect(question).toContain("官方文本索引");
    expect(question).toContain("已确认关系、文本暗示、社区推测或未证实内容");
    expect(question).toContain("不要把社区推测说成官方事实");
  });

  it("builds an English relationship question without mixed Chinese instructions", () => {
    const question = buildRelationshipQuestion({
      language: "en",
      left: sampleGraph.nodes[0],
      right: sampleGraph.nodes[1],
    });

    expect(question).toContain("Tsaritsa");
    expect(question).toContain("Gnoses");
    expect(question).toContain("official text indexes");
    expect(question).toContain(
      "Do not present community theories as official facts",
    );
    expect(question).not.toContain("请");
  });
});

describe("curated Snezhnaya graph catalog", () => {
  it("contains the first-version node range and validates references", () => {
    expect(snezhnayaGraph.nodes.length).toBeGreaterThanOrEqual(12);
    expect(snezhnayaGraph.nodes.length).toBeLessThanOrEqual(20);
    expect(validateSnezhnayaGraph(snezhnayaGraph)).toEqual([]);
  });

  it("includes the agreed core keywords", () => {
    const ids = new Set(snezhnayaGraph.nodes.map((node) => node.id));

    expect(Array.from(ids)).toEqual(
      expect.arrayContaining([
        "tsaritsa",
        "fatui",
        "pierro",
        "dottore",
        "columbina",
        "arlecchino",
        "capitano",
        "tartaglia",
        "scaramouche",
        "signora",
        "sandrone",
        "third-descender",
        "gnosis",
        "white-birch",
        "project-stuzha",
        "khaenriah-abyss",
      ]),
    );
  });

  it("marks unresolved keywords as implications or theories, not explicit facts", () => {
    const whiteBirch = snezhnayaGraph.nodes.find(
      (node) => node.id === "white-birch",
    );
    const projectStuzha = snezhnayaGraph.nodes.find(
      (node) => node.id === "project-stuzha",
    );

    expect(whiteBirch?.tier).not.toBe("official_explicit");
    expect(projectStuzha?.tier).not.toBe("official_explicit");
  });

  it("provides video links without requiring an iframe", () => {
    expect(snezhnayaGraph.video.coverImageUrl).toMatch(/^https?:\/\//u);
    expect(snezhnayaGraph.video.youtubeUrl).toContain("youtube");
    expect(snezhnayaGraph.video.miyousheUrl).toContain("miyoushe");
  });
});

describe("Snezhnaya graph UI helpers", () => {
  it("selects the first curated node as the initial detail node", () => {
    expect(initialSnezhnayaNodeId(snezhnayaGraph)).toBe(
      snezhnayaGraph.nodes[0].id,
    );
  });

  it("returns an empty initial id for an empty graph", () => {
    expect(
      initialSnezhnayaNodeId({
        ...snezhnayaGraph,
        nodes: [],
      }),
    ).toBe("");
  });
});
