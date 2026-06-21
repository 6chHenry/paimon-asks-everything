import type {
  SnezhnayaGraphData,
  SnezhnayaTextClue,
} from "@/lib/snezhnaya-graph";

const wiki = "https://genshin-impact.fandom.com/wiki";

function wikiClue({
  id,
  title,
  slug,
  zh,
  en,
}: {
  id: string;
  title: string;
  slug: string;
  zh: string;
  en: string;
}): SnezhnayaTextClue {
  return {
    id,
    title,
    sourceType: "wiki_text_index",
    tier: "official_text_index",
    url: `${wiki}/${slug}`,
    excerpt: { "zh-CN": zh, en },
  };
}

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
          "多国主线通过神之心收集行动与执行官任务，持续勾勒她对至冬与愚人众的影响。",
          "她的最终目标仍需结合后续官方剧情判断。",
        ],
        en: [
          "Archon Quests across several nations outline her influence through the Gnosis campaign and Harbinger missions.",
          "Her final objective still depends on future official story revelations.",
        ],
      },
      clues: [
        wikiClue({
          id: "tsaritsa-gnosis-clue",
          title: "Tsaritsa",
          slug: "Tsaritsa",
          zh: "页面汇总冰之女皇在角色语音、任务台词与至冬相关文本中的称谓和行动线索。",
          en: "The page indexes references to the Tsaritsa across voice-overs, quests, and Snezhnaya-related text.",
        }),
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
        wikiClue({
          id: "fatui-harbingers-clue",
          title: "Eleven Fatui Harbingers",
          slug: "Eleven_Fatui_Harbingers",
          zh: "页面索引执行官的代号、席位、登场任务与相关角色文本。",
          en: "The page indexes Harbinger codenames, ranks, quest appearances, and character text.",
        }),
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
      imageUrl: "/snezhnaya/avatars/pierro.webp",
      clues: [
        wikiClue({
          id: "pierro-wiki-clue",
          title: "Pierro",
          slug: "Pierro",
          zh: "页面索引丑角的执行官身份、坎瑞亚背景和相关官方登场文本。",
          en: "The page indexes Pierro's Harbinger identity, Khaenri'ahn background, and official appearances.",
        }),
      ],
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
      imageUrl: "/snezhnaya/avatars/dottore.webp",
      clues: [
        wikiClue({
          id: "dottore-wiki-clue",
          title: "Dottore",
          slug: "Dottore",
          zh: "页面汇总博士在须弥主线、角色故事与实验相关文本中的记录。",
          en: "The page collects Dottore's Sumeru quest appearances, character-story references, and experiment-related text.",
        }),
      ],
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
      tier: "official_explicit",
      summary: {
        "zh-CN": "愚人众执行官之一，官方已明确她的身份，但其经历与能力仍保留许多谜团。",
        en: "A confirmed Fatui Harbinger whose history and abilities still contain many unknowns.",
      },
      detail: {
        "zh-CN": ["她以「少女」之名出现在执行官相关官方内容中，现有文本可确认其组织身份。"],
        en: ["Official Harbinger material identifies her by the codename Damselette and confirms her place in the organization."],
      },
      imageUrl: "/snezhnaya/avatars/columbina.webp",
      clues: [
        wikiClue({
          id: "columbina-wiki-clue",
          title: "Columbina",
          slug: "Columbina",
          zh: "页面索引少女的执行官称号、官方形象与相关角色台词。",
          en: "The page indexes Columbina's Harbinger title, published appearance, and related character dialogue.",
        }),
      ],
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
        "zh-CN": ["她的角色故事、传说任务与枫丹主线提供了较完整的官方经历。"],
        en: ["Her character stories, Story Quest, and Fontaine appearances provide a substantial official account."],
      },
      imageUrl: "/snezhnaya/avatars/arlecchino.webp",
      clues: [
        wikiClue({
          id: "arlecchino-wiki-clue",
          title: "Arlecchino",
          slug: "Arlecchino",
          zh: "页面索引仆人的角色故事、传说任务、枫丹主线与壁炉之家资料。",
          en: "The page indexes Arlecchino's character stories, Story Quest, Fontaine appearances, and House of the Hearth material.",
        }),
      ],
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
        "zh-CN": ["他在纳塔相关剧情中的行动，把战争、荣誉与至冬立场联系起来。"],
        en: ["His actions in Natlan connect themes of war and honor with Snezhnaya's position."],
      },
      imageUrl: "/snezhnaya/avatars/capitano.webp",
      clues: [
        wikiClue({
          id: "capitano-wiki-clue",
          title: "Capitano",
          slug: "Capitano",
          zh: "页面索引队长的执行官身份、纳塔剧情登场与相关官方台词。",
          en: "The page indexes Capitano's Harbinger identity, Natlan appearances, and official dialogue.",
        }),
      ],
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
      imageUrl: "/snezhnaya/avatars/tartaglia.webp",
      clues: [
        wikiClue({
          id: "tartaglia-wiki-clue",
          title: "Tartaglia",
          slug: "Tartaglia",
          zh: "页面索引公子的角色故事、璃月主线、深渊经历与师承资料。",
          en: "The page indexes Tartaglia's character stories, Liyue appearances, Abyss experience, and training.",
        }),
      ],
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
        "zh-CN": ["须弥主线揭示了愚人众如何利用他、雷神之心与人造神计划。"],
        en: ["The Sumeru Archon Quest reveals how the Fatui used him, the Electro Gnosis, and the artificial god project."],
      },
      imageUrl: "/snezhnaya/avatars/scaramouche.webp",
      clues: [
        wikiClue({
          id: "scaramouche-wiki-clue",
          title: "Wanderer",
          slug: "Wanderer",
          zh: "页面索引散兵成为流浪者前后的角色故事、任务经历与神之心相关文本。",
          en: "The page indexes his stories before and after becoming the Wanderer, including quest and Gnosis-related text.",
        }),
      ],
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
      imageUrl: "/snezhnaya/avatars/signora.webp",
      clues: [
        wikiClue({
          id: "signora-wiki-clue",
          title: "La Signora",
          slug: "La_Signora",
          zh: "页面索引女士在蒙德、璃月与稻妻主线中的行动，以及其过往文本。",
          en: "The page indexes Signora's actions in Mondstadt, Liyue, and Inazuma, together with her backstory text.",
        }),
      ],
      relatedNodeIds: ["fatui", "gnosis", "arlecchino"],
      suggestedQuestions: {
        "zh-CN": ["女士为什么死在稻妻？"],
        en: ["Why did Signora die in Inazuma?"],
      },
    },
    {
      id: "sandrone",
      label: { "zh-CN": "木偶", en: "Marionette" },
      aliases: ["Sandrone", "Marionette", "桑多涅", "木偶"],
      kind: "character",
      tier: "official_text_index",
      summary: {
        "zh-CN": "愚人众执行官之一，称号为「木偶」，其形象与机械和人偶主题紧密相连。",
        en: "A Fatui Harbinger known as the Marionette, strongly associated with machinery and puppet imagery.",
      },
      detail: {
        "zh-CN": ["枫丹相关文本与社区讨论常把她和阿兰、玛丽安及水仙十字线索放在一起考察，但具体关系仍需区分官方文本与推测。"],
        en: ["Fontaine text and community discussion often examine her alongside Alain, Mary-Ann, and Narzissenkreuz clues, while the exact relationship still requires separating text from theory."],
      },
      imageUrl: "/snezhnaya/avatars/sandrone.webp",
      clues: [
        wikiClue({
          id: "sandrone-wiki-clue",
          title: "Sandrone",
          slug: "Sandrone",
          zh: "页面索引木偶的执行官称号、官方形象与机械主题相关资料。",
          en: "The page indexes the Marionette's Harbinger title, published appearance, and machinery-related material.",
        }),
      ],
      relatedNodeIds: ["fatui", "dottore", "project-stuzha"],
      suggestedQuestions: {
        "zh-CN": ["木偶和阿兰是什么关系？"],
        en: ["What is the relationship between the Marionette and Alain?"],
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
        "zh-CN": ["相关剧情把第三降临者与神之心的来源联系起来，也牵涉降临者与世界秩序的问题。"],
        en: ["Story revelations connect the Third Descender to the origin of Gnoses and to larger questions about Descenders and the world's order."],
      },
      clues: [
        wikiClue({
          id: "third-descender-wiki-clue",
          title: "Third Descender",
          slug: "Third_Descender",
          zh: "页面索引第三降临者身份与神之心来源相关的主线文本。",
          en: "The page indexes Archon Quest text connecting the Third Descender's identity with the origin of Gnoses.",
        }),
      ],
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
      clues: [
        wikiClue({
          id: "gnosis-wiki-clue",
          title: "Gnosis",
          slug: "Gnosis",
          zh: "页面索引七枚神之心在各国主线中的流转、用途与来源信息。",
          en: "The page indexes the seven Gnoses across Archon Quests, including their transfers, uses, and origin.",
        }),
      ],
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
      id: "heavenly-principles",
      label: { "zh-CN": "天理", en: "Heavenly Principles" },
      aliases: ["天理", "Heavenly Principles", "天理的维系者"],
      kind: "concept",
      tier: "official_text_index",
      summary: {
        "zh-CN": "提瓦特世界秩序中的核心概念，与降临者、坎瑞亚灾变和七神体系密切相关。",
        en: "A central concept in Teyvat's world order, closely tied to Descenders, the Khaenri'ahn cataclysm, and the Seven.",
      },
      detail: {
        "zh-CN": ["至冬的神之心收集行动常被放在天理与世界秩序的长期冲突中理解，但女皇的完整计划仍需官方剧情揭示。"],
        en: ["Snezhnaya's Gnosis campaign is often considered within the long conflict around the Heavenly Principles and the world's order, while the Tsaritsa's complete plan remains unrevealed."],
      },
      clues: [
        wikiClue({
          id: "heavenly-principles-wiki-clue",
          title: "Heavenly Principles",
          slug: "Heavenly_Principles",
          zh: "页面索引天理在主线、角色台词与世界观文本中的称谓和相关事件。",
          en: "The page indexes references to the Heavenly Principles across Archon Quests, dialogue, and world-lore text.",
        }),
      ],
      relatedNodeIds: ["gnosis", "third-descender", "khaenriah-abyss"],
      suggestedQuestions: {
        "zh-CN": ["天理和冰之女皇的计划有什么关系？"],
        en: ["How might the Heavenly Principles relate to the Tsaritsa's plan?"],
      },
    },
    {
      id: "project-stuzha",
      label: { "zh-CN": "严冬计划", en: "Project Stuzha" },
      aliases: ["严冬计划", "Project Stuzha", "Stuzha"],
      kind: "event",
      tier: "official_text_implication",
      summary: {
        "zh-CN": "与至冬行动有关的计划名，现有信息需要区分明确文本、叙事暗示与推测。",
        en: "A project name tied to Snezhnayan activity, with confirmed text, narrative implications, and theories requiring clear separation.",
      },
      detail: {
        "zh-CN": ["现有文本尚不足以说明计划的全部目标、参与者和执行方式。"],
        en: ["Available text does not yet establish the project's complete goals, participants, or methods."],
      },
      clues: [
        wikiClue({
          id: "project-stuzha-wiki-clue",
          title: "Project Stuzha",
          slug: "Project_Stuzha",
          zh: "页面汇总严冬计划在任务与角色文本中的已知提及。",
          en: "The page collects known references to Project Stuzha from quests and character text.",
        }),
      ],
      relatedNodeIds: ["tsaritsa", "fatui", "sandrone"],
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
        "zh-CN": ["坎瑞亚灾变与深渊经历共同影响了丑角、公子和降临者相关叙事。"],
        en: ["The Khaenri'ahn cataclysm and Abyss experiences shape the stories surrounding Pierro, Tartaglia, and the Descenders."],
      },
      clues: [
        wikiClue({
          id: "khaenriah-wiki-clue",
          title: "Khaenri'ah",
          slug: "Khaenri%27ah",
          zh: "页面索引坎瑞亚历史、灾变、遗民与深渊相关主线文本。",
          en: "The page indexes Khaenri'ah's history, the cataclysm, its survivors, and Abyss-related Archon Quest text.",
        }),
      ],
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
      id: "gnosis-heavenly-principles",
      from: "gnosis",
      to: "heavenly-principles",
      tier: "official_text_index",
      label: { "zh-CN": "世界秩序关联", en: "world-order connection" },
    },
  ],
};
