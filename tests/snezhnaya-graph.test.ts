import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  SNEZHNAYA_GRAPH_CANVAS,
  buildRelationshipQuestion,
  cleanRelationshipAnswerForDisplay,
  evidenceTierLabel,
  nodeDetailFacts,
  initialSnezhnayaNodeId,
  updateRelationshipSelection,
  validateSnezhnayaGraph,
  validateSnezhnayaGraphLayout,
  type SnezhnayaGraphData,
} from "@/lib/snezhnaya-graph";
import { snezhnayaGraph } from "@/data/snezhnaya-graph";

const sampleGraph: SnezhnayaGraphData = {
  videos: [
    {
      title: {
        "zh-CN": "至冬生态短片",
        en: "Snezhnaya Ecology Short",
      },
      description: {
        "zh-CN": "跟着派蒙先看至冬的第一眼。",
        en: "A first look at Snezhnaya with Paimon.",
      },
      coverImageUrl: "/snezhnaya-cover.jpg",
      youtubeUrls: {
        "zh-CN": "https://www.youtube.com/watch?v=test",
        en: "https://www.youtube.com/watch?v=test",
      },
      miyousheUrl: "https://www.miyoushe.com/ys/article/test",
    },
  ],
  nodes: [
    {
      id: "tsaritsa",
      label: { "zh-CN": "冰之女皇", en: "Tsaritsa" },
      identity: {
        otherNames: [
          { "zh-CN": "女皇", en: "The Tsaritsa" },
          { "zh-CN": "冰神", en: "Cryo Archon" },
        ],
      },
      kind: "character",
      tier: "official_text_index",
      graphGroup: "sovereign",
      graphPosition: { x: 50, y: 10 },
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
      identity: {
        otherNames: [{ "zh-CN": "神之心", en: "Gnosis" }],
      },
      kind: "concept",
      tier: "official_explicit",
      graphGroup: "lore",
      graphPosition: { x: 50, y: 90 },
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
  it("builds an ordered two-node relationship selection", () => {
    expect(updateRelationshipSelection([], "a")).toEqual(["a"]);
    expect(updateRelationshipSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(updateRelationshipSelection(["a", "b"], "c")).toEqual(["b", "c"]);
  });

  it("removes a node when an already selected node is clicked", () => {
    expect(updateRelationshipSelection(["a", "b"], "a")).toEqual(["b"]);
    expect(updateRelationshipSelection(["a", "b"], "b")).toEqual(["a"]);
  });

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
    expect(snezhnayaGraph.nodes.length).toBeGreaterThanOrEqual(19);
    expect(snezhnayaGraph.nodes.length).toBeLessThanOrEqual(22);
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
        "pulcinella",
        "pantalone",
        "unknown-tenth",
        "third-descender",
        "gnosis",
        "heavenly-principles",
        "project-stuzha",
        "khaenriah-abyss",
      ]),
    );
    expect(ids.has("white-birch")).toBe(false);
  });

  it("models the complete numbered Harbinger seats", () => {
    const harbingers = snezhnayaGraph.nodes.filter(
      (node) => node.graphGroup === "harbinger",
    );
    const ranks = harbingers
      .map((node) => node.harbingerRank)
      .sort((left, right) => (left ?? 0) - (right ?? 0));

    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(new Set(ranks).size).toBe(11);

    const unknownTenth = harbingers.find(
      (node) => node.id === "unknown-tenth",
    );
    expect(unknownTenth).toMatchObject({
      harbingerRank: 10,
      status: "unknown",
      label: {
        "zh-CN": "第十席",
        en: "Tenth Seat",
      },
    });
  });

  it("records status and map position for the authored layout", () => {
    const expectedStatuses = {
      capitano: "dormant",
      dottore: "deceased",
      columbina: "former",
      arlecchino: "active",
      pulcinella: "active",
      scaramouche: "former",
      sandrone: "deceased",
      signora: "deceased",
      pantalone: "active",
      "unknown-tenth": "unknown",
      tartaglia: "active",
    } as const;

    for (const [id, status] of Object.entries(expectedStatuses)) {
      const node = snezhnayaGraph.nodes.find((item) => item.id === id);
      expect(node?.status, id).toBe(status);
      expect(node?.statusLabel?.["zh-CN"], id).not.toBe("");
      expect(node?.statusLabel?.en, id).not.toBe("");
    }

    for (const node of snezhnayaGraph.nodes) {
      expect(node.graphPosition, node.id).toBeDefined();
      expect(node.graphPosition?.x, node.id).toBeGreaterThanOrEqual(0);
      expect(node.graphPosition?.x, node.id).toBeLessThanOrEqual(100);
      expect(node.graphPosition?.y, node.id).toBeGreaterThanOrEqual(0);
      expect(node.graphPosition?.y, node.id).toBeLessThanOrEqual(100);
    }
  });

  it("keeps the visual edge set focused on the main hierarchy", () => {
    expect(snezhnayaGraph.edges.length).toBeLessThanOrEqual(8);
    expect(snezhnayaGraph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "tsaritsa-heavenly-principles",
          direction: "bidirectional",
          tone: "opposition",
        }),
        expect.objectContaining({
          id: "tsaritsa-project-stuzha",
          direction: "forward",
          tone: "plan",
        }),
        expect.objectContaining({
          id: "tsaritsa-fatui",
          direction: "forward",
          tone: "command",
        }),
        expect.objectContaining({
          id: "fatui-pierro",
          direction: "forward",
          tone: "command",
        }),
      ]),
    );
  });

  it("uses a portrait-oriented 900 by 980 conflict-map canvas", () => {
    expect(SNEZHNAYA_GRAPH_CANVAS).toEqual({ width: 900, height: 980 });
  });

  it("validates the conflict-map geometry safety rules", () => {
    expect(validateSnezhnayaGraphLayout(snezhnayaGraph)).toEqual([]);
  });

  it("keeps visible relationship labels as explicit capsules", () => {
    const visibleEdges = snezhnayaGraph.edges.filter((edge) => edge.showLabel);

    expect(visibleEdges.map((edge) => edge.label["zh-CN"])).toEqual([
      "对抗",
      "推动严冬计划",
      "统领",
      "收集神之心",
      "遗骸铸成",
      "坎瑞亚旧事",
    ]);

    for (const edge of visibleEdges) {
      expect(edge.labelPosition, edge.id).toEqual(
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
        }),
      );
      expect(edge.path, edge.id).toMatch(/^M /u);
    }
  });

  it("renders the status legend outside the map canvas and uses SVG label capsules", () => {
    const source = readFileSync(
      path.join(process.cwd(), "components", "snezhnaya-graph.tsx"),
      "utf8",
    );

    expect(source.indexOf("snezhnaya-map-legend")).toBeGreaterThan(-1);
    expect(source.indexOf("snezhnaya-map-legend")).toBeLessThan(
      source.indexOf("snezhnaya-map-viewport"),
    );
    expect(source).toContain("snezhnaya-edge-label-bg");
    expect(source).toContain("onMouseEnter");
    expect(source).toContain("onFocus");
  });

  it("presents clues as Wiki information without evidence badges", () => {
    const source = readFileSync(
      path.join(process.cwd(), "components", "snezhnaya-graph.tsx"),
      "utf8",
    );

    expect(source).toContain('"Wiki 信息", "Wiki information"');
    expect(source).not.toContain('"可信文本线索", "Grounded text clues"');
    expect(source).not.toContain("evidenceTierLabel(selectedNode.tier");
    expect(source).not.toContain("evidenceTierLabel(clue.tier");
  });

  it("uses the agreed labels and evidence tiers for Harbingers", () => {
    const columbina = snezhnayaGraph.nodes.find(
      (node) => node.id === "columbina",
    );
    const marionette = snezhnayaGraph.nodes.find(
      (node) => node.id === "sandrone",
    );
    const projectStuzha = snezhnayaGraph.nodes.find(
      (node) => node.id === "project-stuzha",
    );

    expect(columbina?.tier).toBe("official_explicit");
    expect(marionette?.label).toEqual({
      "zh-CN": "木偶",
      en: "Marionette",
    });
    expect(marionette?.identity).toMatchObject({
      harbingerName: { "zh-CN": "桑多涅", en: "Sandrone" },
      codename: { "zh-CN": "木偶", en: "Marionette" },
    });
    expect(projectStuzha?.tier).not.toBe("official_explicit");
  });

  it("stores Harbinger identities by semantic role instead of generic aliases", () => {
    const identities = Object.fromEntries(
      snezhnayaGraph.nodes.map((node) => [node.id, node.identity]),
    );

    expect(identities.capitano).toMatchObject({
      harbingerName: { "zh-CN": "卡皮塔诺", en: "Il Capitano" },
      codename: { "zh-CN": "队长", en: "The Captain" },
      personalNames: [{ "zh-CN": "瑟雷恩", en: "Thrain" }],
    });
    expect(identities.dottore).toMatchObject({
      harbingerName: { "zh-CN": "多托雷", en: "Il Dottore" },
      codename: { "zh-CN": "博士", en: "The Doctor" },
      personalNames: [{ "zh-CN": "赞迪克", en: "Zandik" }],
    });
    expect(identities.columbina).toMatchObject({
      harbingerName: { "zh-CN": "哥伦比娅", en: "Columbina" },
      codename: { "zh-CN": "少女", en: "Damselette" },
      personalNames: expect.arrayContaining([
        { "zh-CN": "库塔尔", en: "Kuutar" },
        {
          "zh-CN": "哥伦比娅・希珀塞莱尼娅",
          en: "Columbina Hyposelenia",
        },
      ]),
    });
    expect(identities.arlecchino).toMatchObject({
      harbingerName: { "zh-CN": "阿蕾奇诺", en: "Arlecchino" },
      codename: { "zh-CN": "仆人", en: "The Knave" },
      personalNames: [{ "zh-CN": "佩露薇利", en: "Peruere" }],
    });
    expect(identities.tartaglia).toMatchObject({
      harbingerName: { "zh-CN": "达达利亚", en: "Tartaglia" },
      codename: { "zh-CN": "公子", en: "Childe" },
      personalNames: [{ "zh-CN": "阿贾克斯", en: "Ajax" }],
    });
    expect(identities.signora).toMatchObject({
      harbingerName: { "zh-CN": "席诺拉", en: "La Signora" },
      codename: { "zh-CN": "女士", en: "The Fair Lady" },
      personalNames: [
        {
          "zh-CN": "罗莎琳·克鲁兹希卡·洛厄法特",
          en: "Rosalyne-Kruzchka Lohefalter",
        },
      ],
    });
    expect(identities.pantalone).toMatchObject({
      harbingerName: { "zh-CN": "潘塔罗涅", en: "Pantalone" },
      codename: { "zh-CN": "富人", en: "Regrator" },
      personalNames: [
        {
          "zh-CN": "费奥潘・谢尔盖耶维奇・维克塞",
          en: "Feofan Sergeyevich Veksel",
        },
      ],
    });

    for (const node of snezhnayaGraph.nodes) {
      expect(node, node.id).not.toHaveProperty("aliases");
    }
  });

  it("provides video links without requiring an iframe", () => {
    expect(snezhnayaGraph.videos[0].coverImageUrl).toMatch(
      /^(?:https?:\/\/|\/)/u,
    );
    expect(snezhnayaGraph.videos[0].youtubeUrls["zh-CN"]).toContain("youtube");
    expect(snezhnayaGraph.videos[0].miyousheUrl).toContain("miyoushe");
  });

  it("provides a bilingual Fandom text clue for every keyword", () => {
    for (const node of snezhnayaGraph.nodes) {
      expect(node.clues.length, node.id).toBeGreaterThan(0);
      for (const clue of node.clues) {
        expect(clue.sourceType, clue.id).toBe("wiki_text_index");
        expect(clue.url, clue.id).toMatch(
          /^https:\/\/genshin-impact\.fandom\.com\/wiki\//u,
        );
        expect(clue.excerpt["zh-CN"], clue.id).not.toBe("");
        expect(clue.excerpt.en, clue.id).not.toBe("");
      }
    }
  });

  it("stores published character portraits as local WebP assets", () => {
    const portraitNodeIds = [
      "pierro",
      "dottore",
      "columbina",
      "arlecchino",
      "capitano",
      "tartaglia",
      "scaramouche",
      "signora",
      "sandrone",
      "pulcinella",
      "pantalone",
    ];

    for (const id of portraitNodeIds) {
      const node = snezhnayaGraph.nodes.find((item) => item.id === id);
      expect(node?.imageUrl, id).toMatch(
        /^\/snezhnaya\/avatars\/[a-z0-9-]+\.webp$/u,
      );
      expect(
        existsSync(
          path.join(process.cwd(), "public", node?.imageUrl?.slice(1) ?? ""),
        ),
        id,
      ).toBe(true);
    }

    const tsaritsa = snezhnayaGraph.nodes.find(
      (node) => node.id === "tsaritsa",
    );
    expect(tsaritsa?.imageUrl).toBeUndefined();
  });

  it("keeps curated copy player-facing", () => {
    const copy = JSON.stringify(snezhnayaGraph);
    for (const phrase of [
      "第一版",
      "v1",
      "作为入口",
      "entry point",
      "should stay",
      "should not be treated",
      "hard-coding",
      "展示相关文本",
    ]) {
      expect(copy).not.toContain(phrase);
    }
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

  it("builds player-facing identity facts without type or evidence metadata", () => {
    const marionette = snezhnayaGraph.nodes.find(
      (node) => node.id === "sandrone",
    );
    expect(marionette).toBeDefined();

    const facts = nodeDetailFacts(marionette!, "zh-CN");
    expect(facts).toEqual(
      expect.arrayContaining([
        { label: "名称", value: "木偶" },
        { label: "席位", value: "第 7 席" },
        { label: "执行官名", value: "Sandrone / 桑多涅" },
        { label: "面具名 / 代号", value: "Marionette / 木偶" },
        expect.objectContaining({ label: "本名 / 旧名" }),
        expect.objectContaining({ label: "状态" }),
      ]),
    );
    expect(facts.map((fact) => fact.label)).not.toContain("类型");
    expect(facts.map((fact) => fact.label)).not.toContain("可信度");
  });

  it("requires every curated node to have enough detail for an expanded detail page", () => {
    for (const node of snezhnayaGraph.nodes) {
      expect(node.summary["zh-CN"].length, `${node.id}:zh-summary`).toBeGreaterThan(16);
      expect(node.summary.en.length, `${node.id}:en-summary`).toBeGreaterThan(24);
      expect(node.detail["zh-CN"].join("").length, `${node.id}:zh-detail`).toBeGreaterThan(34);
      expect(node.detail.en.join("").length, `${node.id}:en-detail`).toBeGreaterThan(54);
      expect(node.suggestedQuestions["zh-CN"].length, `${node.id}:zh-questions`).toBeGreaterThan(0);
      expect(node.suggestedQuestions.en.length, `${node.id}:en-questions`).toBeGreaterThan(0);
    }
  });

  it("removes prose source parentheticals from relationship answers without dropping citations", () => {
    const cleaned = cleanRelationshipAnswerForDisplay({
      status: "answered",
      answer:
        "木偶和博士存在直接冲突（来自 Dottore 页面）。这不是普通同僚关系（来源：external-2）。",
      answerParagraphs: [
        {
          text: "Sandrone opposed Dottore (from Dottore page). The source remains cited.",
          citationIds: ["external-2"],
        },
      ],
      language: "zh-CN",
      answerMode: "evidence_answer",
      claims: [],
      citations: [
        {
          id: "external-2",
          title: "Dottore",
          url: "https://genshin-impact.fandom.com/wiki/Dottore",
          sourceName: "Genshin Impact Wiki",
          sourceKind: "trusted_wiki",
          credibility: "trusted_wiki",
          factStatus: "trusted_secondary",
          excerpt: "Indexed story text.",
          external: true,
          crossLanguage: false,
        },
      ],
      spoilerAction: "none",
      usedExternalSources: true,
      confidence: "medium",
      eventClassification: {
        questionCategory: "story",
        confusionTopic: "relationship",
      },
      eventRecorded: false,
    });

    expect(cleaned.answer).toBe("木偶和博士存在直接冲突。这不是普通同僚关系。");
    expect(cleaned.answerParagraphs?.[0]).toEqual({
      text: "Sandrone opposed Dottore. The source remains cited.",
      citationIds: ["external-2"],
    });
    expect(cleaned.citations).toHaveLength(1);
  });
});
