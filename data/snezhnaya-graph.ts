import type { SnezhnayaGraphData } from "@/lib/snezhnaya-graph";

const wiki = "https://genshin-impact.fandom.com/wiki";

export const snezhnayaGraph: SnezhnayaGraphData = {
  video: {
    title: {
      "zh-CN": "至冬生态短片",
      en: "Snezhnaya Ecology Short",
    },
    description: {
      "zh-CN": "先用一支短片进入至冬氛围，再顺着关键词回忆前置线索。",
      en: "Start with the Snezhnaya mood, then revisit the clues behind the keywords.",
    },
    coverImageUrl:
      "https://img.youtube.com/vi/RGFJa2mwD8E/maxresdefault.jpg",
    youtubeUrl: "https://www.youtube.com/watch?v=RGFJa2mwD8E",
    miyousheUrl: "https://www.miyoushe.com/ys",
  },
  nodes: [
    {
      id: "tsaritsa",
      label: { "zh-CN": "冰之女皇", en: "Tsaritsa" },
      aliases: ["女皇", "冰神", "The Tsaritsa"],
      kind: "character",
      tier: "official_text_index",
      summary: {
        "zh-CN": "至冬的神明，也是理解愚人众行动目的时绕不开的中心。",
        en: "Snezhnaya's god and the center of many questions about the Fatui's purpose.",
      },
      detail: {
        "zh-CN": [
          "她尚未正式登场，但神之心收集行动、愚人众执行官和至冬目标都持续指向她。",
          "第一版把她作为核心节点，但不提前写死她的最终计划。",
        ],
        en: [
          "She has not fully appeared in the story, but the Gnosis campaign, the Harbingers, and Snezhnaya's goals all point back to her.",
          "The first version treats her as a central node without hard-coding her final plan.",
        ],
      },
      clues: [
        {
          id: "tsaritsa-gnosis-clue",
          title: "Gnosis",
          sourceType: "wiki_text_index",
          tier: "official_text_index",
          url: `${wiki}/Gnosis`,
          excerpt: {
            "zh-CN": "神之心页面索引了多国主线中愚人众取得神之心的剧情。",
            en: "The Gnosis page indexes quest text around the Fatui obtaining Gnoses across regions.",
          },
        },
      ],
      relatedNodeIds: ["fatui", "gnosis", "pierro", "project-stuzha"],
      suggestedQuestions: {
        "zh-CN": ["冰之女皇为什么要收集神之心？"],
        en: ["Why does the Tsaritsa collect Gnoses?"],
      },
    },
    {
      id: "fatui",
      label: { "zh-CN": "愚人众", en: "Fatui" },
      aliases: ["Fatui", "愚人眾"],
      kind: "organization",
      tier: "official_explicit",
      summary: {
        "zh-CN": "至冬对外行动的主要组织，也是多国主线冲突的长期推手。",
        en: "Snezhnaya's main external force and a long-running driver of regional conflicts.",
      },
      detail: {
        "zh-CN": [
          "愚人众把外交、情报、武力和执行官系统结合在一起，是至冬线索最密集的组织。",
        ],
        en: [
          "The Fatui combine diplomacy, intelligence, force, and the Harbinger hierarchy, making them the densest Snezhnaya clue cluster.",
        ],
      },
      clues: [
        {
          id: "fatui-harbingers-clue",
          title: "Eleven Fatui Harbingers",
          sourceType: "wiki_text_index",
          tier: "official_text_index",
          url: `${wiki}/Eleven_Fatui_Harbingers`,
          excerpt: {
            "zh-CN": "执行官页面索引了各执行官登场、称号和相关剧情。",
            en: "The Harbingers page indexes titles, appearances, and related story material.",
          },
        },
      ],
      relatedNodeIds: [
        "tsaritsa",
        "pierro",
        "dottore",
        "arlecchino",
        "capitano",
      ],
      suggestedQuestions: {
        "zh-CN": ["愚人众执行官之间是什么关系？"],
        en: ["How are the Fatui Harbingers related?"],
      },
    },
    {
      id: "pierro",
      label: { "zh-CN": "丑角", en: "Pierro" },
      aliases: ["Pierro", "The Jester", "丑角"],
      kind: "character",
      tier: "official_text_index",
      summary: {
        "zh-CN": "愚人众执行官首席，和坎瑞亚背景有强关联。",
        en: "The first Fatui Harbinger, strongly associated with Khaenri'ah background threads.",
      },
      detail: {
        "zh-CN": ["他是连接至冬、愚人众和坎瑞亚旧事的重要人物。"],
        en: ["He connects Snezhnaya, the Fatui, and older Khaenri'ah threads."],
      },
      clues: [],
      relatedNodeIds: ["fatui", "khaenriah-abyss", "tsaritsa"],
      suggestedQuestions: {
        "zh-CN": ["丑角和坎瑞亚有什么关系？"],
        en: ["How is Pierro connected to Khaenri'ah?"],
      },
    },
    {
      id: "dottore",
      label: { "zh-CN": "博士", en: "Il Dottore" },
      aliases: ["Dottore", "博士"],
      kind: "character",
      tier: "official_text_index",
      summary: {
        "zh-CN": "执行官之一，围绕实验、切片和散兵计划留下大量争议线索。",
        en: "A Harbinger tied to experiments, segments, and the Scaramouche plan.",
      },
      detail: {
        "zh-CN": ["他的相关文本经常涉及人体实验、知识边界和愚人众内部目标。"],
        en: ["His related text often involves human experimentation, knowledge boundaries, and Fatui goals."],
      },
      clues: [],
      relatedNodeIds: ["fatui", "scaramouche", "sandrone"],
      suggestedQuestions: {
        "zh-CN": ["博士和散兵计划有什么关系？"],
        en: ["How is Dottore connected to Scaramouche's plan?"],
      },
    },
    {
      id: "columbina",
      label: { "zh-CN": "少女", en: "Columbina" },
      aliases: ["Columbina", "Damselette", "少女"],
      kind: "character",
      tier: "official_text_implication",
      summary: {
        "zh-CN": "信息很少但关注度很高的执行官，适合作为未知风险节点。",
        en: "A highly watched Harbinger with limited confirmed information.",
      },
      detail: {
        "zh-CN": ["她的确定信息有限，节点详情应保持克制，更多用于承接玩家疑问。"],
        en: ["Confirmed information about her is limited, so the node should stay conservative and capture player curiosity."],
      },
      clues: [],
      relatedNodeIds: ["fatui", "capitano", "arlecchino"],
      suggestedQuestions: {
        "zh-CN": ["少女目前有哪些确定信息？"],
        en: ["What is confirmed about Columbina so far?"],
      },
    },
    {
      id: "arlecchino",
      label: { "zh-CN": "仆人", en: "Arlecchino" },
      aliases: ["Arlecchino", "The Knave", "仆人"],
      kind: "character",
      tier: "official_explicit",
      summary: {
        "zh-CN": "已实装执行官，连接壁炉之家、枫丹主线和愚人众内部立场。",
        en: "A playable Harbinger linking the House of the Hearth, Fontaine, and Fatui internal positions.",
      },
      detail: {
        "zh-CN": ["她是少数已有大量官方文本支撑的执行官节点。"],
        en: ["She is one of the Harbingers with substantial official text support."],
      },
      clues: [],
      relatedNodeIds: ["fatui", "signora", "tartaglia"],
      suggestedQuestions: {
        "zh-CN": ["仆人在愚人众里是什么立场？"],
        en: ["What is Arlecchino's position within the Fatui?"],
      },
    },
    {
      id: "capitano",
      label: { "zh-CN": "队长", en: "Capitano" },
      aliases: ["Capitano", "The Captain", "队长"],
      kind: "character",
      tier: "official_text_index",
      summary: {
        "zh-CN": "执行官之一，和纳塔、荣誉、战争叙事联系紧密。",
        en: "A Harbinger tied to Natlan, honor, and war-story framing.",
      },
      detail: {
        "zh-CN": ["他的节点可帮助玩家从纳塔线索过渡到至冬。"],
        en: ["His node helps players move from Natlan clues toward Snezhnaya."],
      },
      clues: [],
      relatedNodeIds: ["fatui", "columbina", "tsaritsa"],
      suggestedQuestions: {
        "zh-CN": ["队长和至冬主线可能有什么关系？"],
        en: ["How might Capitano connect to the Snezhnaya arc?"],
      },
    },
    {
      id: "tartaglia",
      label: { "zh-CN": "公子", en: "Tartaglia" },
      aliases: ["Childe", "Tartaglia", "Ajax", "公子"],
      kind: "character",
      tier: "official_explicit",
      summary: {
        "zh-CN": "最早深度登场的执行官之一，连接深渊经历、师承和愚人众行动。",
        en: "One of the earliest major Harbingers, linking Abyss experience, training, and Fatui operations.",
      },
      detail: {
        "zh-CN": ["他的经历把执行官、深渊和丝柯克等后续线索连接起来。"],
        en: ["His story connects the Harbingers, the Abyss, and later clues such as Skirk."],
      },
      clues: [],
      relatedNodeIds: ["fatui", "khaenriah-abyss", "arlecchino"],
      suggestedQuestions: {
        "zh-CN": ["公子的深渊经历为什么重要？"],
        en: ["Why does Tartaglia's Abyss experience matter?"],
      },
    },
    {
      id: "scaramouche",
      label: { "zh-CN": "散兵", en: "Scaramouche" },
      aliases: [
        "Wanderer",
        "Scaramouche",
        "Balladeer",
        "散兵",
        "流浪者",
      ],
      kind: "character",
      tier: "official_explicit",
      summary: {
        "zh-CN": "曾经的执行官，连接神之心、博士实验和须弥主线。",
        en: "A former Harbinger linked to Gnoses, Dottore's experiments, and the Sumeru Archon Quest.",
      },
      detail: {
        "zh-CN": ["他适合作为理解愚人众如何使用神之心和人造神计划的节点。"],
        en: ["He helps explain how the Fatui approached Gnoses and the artificial god plan."],
      },
      clues: [],
      relatedNodeIds: ["fatui", "dottore", "gnosis"],
      suggestedQuestions: {
        "zh-CN": ["散兵和神之心有什么关系？"],
        en: ["How is Scaramouche related to the Gnosis?"],
      },
    },
    {
      id: "signora",
      label: { "zh-CN": "女士", en: "Signora" },
      aliases: ["La Signora", "Signora", "女士"],
      kind: "character",
      tier: "official_explicit",
      summary: {
        "zh-CN": "执行官之一，蒙德、璃月和稻妻主线都留下了关键节点。",
        en: "A Harbinger with key appearances across Mondstadt, Liyue, and Inazuma.",
      },
      detail: {
        "zh-CN": ["她的死亡和过往文本都常被用于讨论愚人众代价与执行官命运。"],
        en: ["Her death and backstory are often used to discuss Fatui costs and Harbinger fates."],
      },
      clues: [],
      relatedNodeIds: ["fatui", "gnosis", "arlecchino"],
      suggestedQuestions: {
        "zh-CN": ["女士为什么死在稻妻？"],
        en: ["Why did Signora die in Inazuma?"],
      },
    },
    {
      id: "sandrone",
      label: { "zh-CN": "桑多涅", en: "Sandrone" },
      aliases: ["Sandrone", "Marionette", "桑多涅"],
      kind: "character",
      tier: "official_text_index",
      summary: {
        "zh-CN": "执行官之一，和机械、人偶、阿兰及玛丽安线索有强关联。",
        en: "A Harbinger tied to machinery, puppets, Alain, and Mary-Ann clues.",
      },
      detail: {
        "zh-CN": ["她适合作为枫丹水仙十字线索通向至冬的桥。"],
        en: ["She works as a bridge from Fontaine's Narzissenkreuz clues toward Snezhnaya."],
      },
      clues: [],
      relatedNodeIds: ["fatui", "dottore", "white-birch"],
      suggestedQuestions: {
        "zh-CN": ["桑多涅和阿兰是什么关系？"],
        en: ["What is the relationship between Sandrone and Alain?"],
      },
    },
    {
      id: "third-descender",
      label: { "zh-CN": "第三降临者", en: "Third Descender" },
      aliases: ["第三降临者", "Third Descender"],
      kind: "concept",
      tier: "official_text_index",
      summary: {
        "zh-CN": "和神之心本质相关的核心概念，是至冬计划讨论中的高权重线索。",
        en: "A core concept related to the nature of Gnoses and a high-weight Snezhnaya clue.",
      },
      detail: {
        "zh-CN": ["它应和神之心、天理、降临者等问题一起理解。"],
        en: ["It should be understood alongside Gnoses, Celestia, and Descender questions."],
      },
      clues: [],
      relatedNodeIds: ["gnosis", "tsaritsa", "khaenriah-abyss"],
      suggestedQuestions: {
        "zh-CN": ["第三降临者和神之心有什么关系？"],
        en: ["How is the Third Descender related to Gnoses?"],
      },
    },
    {
      id: "gnosis",
      label: { "zh-CN": "神之心", en: "Gnoses" },
      aliases: ["Gnosis", "Gnoses", "神之心"],
      kind: "item",
      tier: "official_explicit",
      summary: {
        "zh-CN": "贯穿各国主线的重要物件，也是愚人众收集行动的核心目标。",
        en: "A key object across Archon Quests and the core target of the Fatui collection campaign.",
      },
      detail: {
        "zh-CN": ["神之心把七神、愚人众、第三降临者和至冬计划连在一起。"],
        en: ["Gnoses connect the Archons, Fatui, Third Descender, and Snezhnaya's plan."],
      },
      clues: [],
      relatedNodeIds: [
        "tsaritsa",
        "third-descender",
        "scaramouche",
        "signora",
      ],
      suggestedQuestions: {
        "zh-CN": ["神之心到底是什么？"],
        en: ["What exactly are Gnoses?"],
      },
    },
    {
      id: "white-birch",
      label: { "zh-CN": "白桦", en: "White Birch" },
      aliases: ["白桦", "white birch"],
      kind: "text_clue",
      tier: "official_text_implication",
      summary: {
        "zh-CN": "可能与至冬意象有关的文本关键词，第一版只作为线索展示。",
        en: "A textual keyword possibly tied to Snezhnaya imagery, shown only as a clue in v1.",
      },
      detail: {
        "zh-CN": ["它不应被写成已确认设定；详情只展示相关文本和可能联想。"],
        en: ["It should not be treated as confirmed setting; the detail view only shows related text and possible associations."],
      },
      clues: [],
      relatedNodeIds: ["tsaritsa", "project-stuzha", "sandrone"],
      suggestedQuestions: {
        "zh-CN": ["白桦在至冬线索里代表什么？"],
        en: ["What does White Birch represent in Snezhnaya clues?"],
      },
    },
    {
      id: "project-stuzha",
      label: { "zh-CN": "严冬计划", en: "Project Stuzha" },
      aliases: ["严冬计划", "Project Stuzha", "Stuzha"],
      kind: "event",
      tier: "official_text_implication",
      summary: {
        "zh-CN": "高关注度计划名，第一版需要明确区分文本信息和推测。",
        en: "A high-interest project name that needs clear separation between text and theory.",
      },
      detail: {
        "zh-CN": ["可以作为玩家提问入口，但默认不替官方给出完整解释。"],
        en: ["It can serve as a question entry point, but should not invent a full official explanation."],
      },
      clues: [],
      relatedNodeIds: ["tsaritsa", "fatui", "white-birch"],
      suggestedQuestions: {
        "zh-CN": ["严冬计划目前有哪些可靠信息？"],
        en: ["What reliable information exists about Project Stuzha?"],
      },
    },
    {
      id: "khaenriah-abyss",
      label: { "zh-CN": "坎瑞亚与深渊", en: "Khaenri'ah and the Abyss" },
      aliases: ["Khaenri'ah", "Abyss", "坎瑞亚", "深渊"],
      kind: "concept",
      tier: "official_text_index",
      summary: {
        "zh-CN": "连接丑角、公子、降临者和世界外侧叙事的重要背景。",
        en: "Background linking Pierro, Tartaglia, Descenders, and beyond-the-world story threads.",
      },
      detail: {
        "zh-CN": ["这个节点帮助玩家把至冬问题放回提瓦特长期主线。"],
        en: ["This node places Snezhnaya questions back into Teyvat's long-running main story."],
      },
      clues: [],
      relatedNodeIds: ["pierro", "tartaglia", "third-descender"],
      suggestedQuestions: {
        "zh-CN": ["坎瑞亚和愚人众有什么关系？"],
        en: ["How is Khaenri'ah connected to the Fatui?"],
      },
    },
  ],
  edges: [
    {
      id: "tsaritsa-fatui",
      from: "tsaritsa",
      to: "fatui",
      tier: "official_text_index",
      label: { "zh-CN": "统领", en: "commands" },
    },
    {
      id: "fatui-pierro",
      from: "fatui",
      to: "pierro",
      tier: "official_text_index",
      label: { "zh-CN": "首席执行官", en: "first Harbinger" },
    },
    {
      id: "tsaritsa-gnosis",
      from: "tsaritsa",
      to: "gnosis",
      tier: "official_text_index",
      label: { "zh-CN": "收集目标", en: "collection target" },
    },
    {
      id: "gnosis-third-descender",
      from: "gnosis",
      to: "third-descender",
      tier: "official_text_index",
      label: { "zh-CN": "本质线索", en: "nature clue" },
    },
    {
      id: "dottore-scaramouche",
      from: "dottore",
      to: "scaramouche",
      tier: "official_explicit",
      label: { "zh-CN": "实验计划", en: "experiment plan" },
    },
    {
      id: "pierro-khaenriah",
      from: "pierro",
      to: "khaenriah-abyss",
      tier: "official_text_index",
      label: { "zh-CN": "旧国背景", en: "old nation background" },
    },
    {
      id: "tartaglia-abyss",
      from: "tartaglia",
      to: "khaenriah-abyss",
      tier: "official_explicit",
      label: { "zh-CN": "深渊经历", en: "Abyss experience" },
    },
    {
      id: "stuzha-white-birch",
      from: "project-stuzha",
      to: "white-birch",
      tier: "official_text_implication",
      label: { "zh-CN": "意象线索", en: "imagery clue" },
    },
  ],
};
