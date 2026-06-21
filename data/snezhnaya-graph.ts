import type {
  LocalizedText,
  SnezhnayaGraphData,
  SnezhnayaGraphGroup,
  SnezhnayaGraphPosition,
  SnezhnayaNodeStatus,
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

const snezhnayaGraphBase: SnezhnayaGraphData = {
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
          "现有文本明确指向她反抗天理、试图建立新世界的方向，但其最终方案仍需后续官方剧情揭示。",
        ],
        en: [
          "Archon Quests across several nations outline her influence through the Gnosis campaign and Harbinger missions.",
          "Current text points to her rebellion against the Heavenly Principles and desire to create a new world, while the complete plan remains unrevealed.",
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
      relatedNodeIds: [
        "fatui",
        "gnosis",
        "pierro",
        "project-stuzha",
        "heavenly-principles",
      ],
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
        "pulcinella",
        "pantalone",
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
      relatedNodeIds: [
        "fatui",
        "khaenriah-abyss",
        "tsaritsa",
        "project-stuzha",
      ],
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
        "zh-CN": "前愚人众第二席，以切片实验和跨越生命边界的研究著称。",
        en: "The former Second Harbinger, known for his Segments and research that crossed the boundaries of life.",
      },
      detail: {
        "zh-CN": [
          "须弥主线中，他以雷神之心为交换条件清除了当时的其他切片。",
          "后续活跃个体与世界树融合，并在世界树被焚毁时一同消亡；现有文本将博士列为已故。",
        ],
        en: [
          "In Sumeru, he erased his other Segments in exchange for the Electro Gnosis.",
          "A later active iteration merged with Irminsul and perished when the tree burned; current text lists Dottore as deceased.",
        ],
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
        "zh-CN": "前愚人众第三席，现已回归月神身份，不再属于执行官体系。",
        en: "The former Third Harbinger, now restored to her identity as a Moon Goddess and no longer part of the Harbingers.",
      },
      detail: {
        "zh-CN": [
          "她曾以「少女」之名担任第三席，加入愚人众与其月神力量有关。",
          "挪德卡莱剧情后，官方资料称她为月神库塔尔，并使用「前愚人众第三席」表述。",
        ],
        en: [
          "She once served as the Third under the codename Damselette, with her Moon Goddess powers central to her recruitment.",
          "After the Nod-Krai story, official material calls her the Moon Goddess Kuutar and a former Third Harbinger.",
        ],
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
        "zh-CN": "愚人众第一席，在纳塔将自身存在与夜神融合，身体现处于沉睡。",
        en: "The First Harbinger, whose existence merged with the Lord of the Night in Natlan while his body remains dormant.",
      },
      detail: {
        "zh-CN": [
          "他以坎瑞亚人的不死诅咒替代玛薇卡承担代价，将生命力转移给夜神以修复纳塔地脉。",
          "融合后，他的身体留在原火王座上沉睡；这并不等同于已确认死亡。",
        ],
        en: [
          "He used the Khaenri'ahn curse of immortality to take Mavuika's place, transferring his life force to the Lord of the Night to sustain Natlan's Ley Lines.",
          "After the fusion, his body remains dormant on the Throne of the Primal Fire; this is not a confirmed death.",
        ],
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
        "zh-CN": "前愚人众第六席；世界树改写了关于散兵的历史记录，但他本人仍以流浪者身份存在。",
        en: "The former Sixth Harbinger; Irminsul rewrote records of Scaramouche, but he continues to exist as the Wanderer.",
      },
      detail: {
        "zh-CN": [
          "他试图从世界树中抹除自己，结果是提瓦特关于其过去身份与行为的记录和记忆被改写。",
          "他本人没有消失，后来取回记忆并选择以流浪者身份继续生活；愚人众则认为第六席长期空缺。",
        ],
        en: [
          "He attempted to erase himself from Irminsul, rewriting Teyvat's records and memories of his former identities and actions.",
          "He did not cease to exist, later recovered his memories, and continues as the Wanderer; the Fatui regard the Sixth Seat as long vacant.",
        ],
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
        "zh-CN": "前愚人众第八席，在稻妻御前决斗败北后被雷电将军处决。",
        en: "The former Eighth Harbinger, executed by the Raiden Shogun after losing a duel before the throne in Inazuma.",
      },
      detail: {
        "zh-CN": [
          "她接受旅行者发起的御前决斗并战败。",
          "依据决斗规则，雷电将军以无想的一刀执行处决，其身体化为灰烬。",
        ],
        en: [
          "She accepted the Traveler's challenge to a duel before the throne and lost.",
          "Under the duel's rules, the Raiden Shogun executed her with the Musou no Hitotachi, reducing her body to ash.",
        ],
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
        "zh-CN": "愚人众第七席，身体在与博士的冲突中被摧毁，核心随后被回收。",
        en: "The Seventh Harbinger, whose body was destroyed in a confrontation with Dottore while her core was later recovered.",
      },
      detail: {
        "zh-CN": [
          "她为阻止博士利用三月力量而设局，随后身体被博士摧毁。",
          "仆人回收了她与普洛尼亚的核心，并准备送往枫丹科学院；能否恢复尚未得到确认。",
        ],
        en: [
          "She set a trap to prevent Dottore from exploiting the power of the Three Moons, after which he destroyed her body.",
          "Arlecchino recovered her core and Pulonia's for delivery to the Fontaine Research Institute; whether she can be restored remains unconfirmed.",
        ],
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
      id: "pulcinella",
      label: { "zh-CN": "公鸡", en: "The Rooster" },
      aliases: ["Pulcinella", "The Rooster", "公鸡", "普契涅拉"],
      kind: "character",
      tier: "official_explicit",
      summary: {
        "zh-CN": "愚人众第五席执行官，也是至冬城的市长与地方权力核心。",
        en: "The Fifth Fatui Harbinger and mayor of Snezhnograd, placing him at the center of local political power.",
      },
      detail: {
        "zh-CN": [
          "他曾将年少的公子招入愚人众，并与富人共同推进严冬计划。",
          "现有剧情仍将他列为在任执行官。",
        ],
        en: [
          "He recruited the young Tartaglia into the Fatui and works with Pantalone on Project Stuzha.",
          "Current story material still lists him as an active Harbinger.",
        ],
      },
      imageUrl: "/snezhnaya/avatars/pulcinella.webp",
      clues: [
        wikiClue({
          id: "pulcinella-wiki-clue",
          title: "Pulcinella",
          slug: "Pulcinella",
          zh: "页面索引公鸡的第五席身份、市长职务、公子相关故事与严冬计划文本。",
          en: "The page indexes Pulcinella's Fifth Seat, mayoral office, Tartaglia connections, and Project Stuzha references.",
        }),
      ],
      relatedNodeIds: ["fatui", "tartaglia", "pantalone", "project-stuzha"],
      suggestedQuestions: {
        "zh-CN": ["公鸡为什么照顾公子的家人？"],
        en: ["Why does Pulcinella look after Tartaglia's family?"],
      },
    },
    {
      id: "pantalone",
      label: { "zh-CN": "富人", en: "Regrator" },
      aliases: ["Pantalone", "Regrator", "富人", "潘塔罗涅"],
      kind: "character",
      tier: "official_explicit",
      summary: {
        "zh-CN": "愚人众第九席执行官，掌握北国银行与至冬的金融力量。",
        en: "The Ninth Fatui Harbinger, associated with the Northland Bank and Snezhnaya's financial power.",
      },
      detail: {
        "zh-CN": [
          "他试图以经济体系挑战神明掌握的权威，并与公鸡共同推进严冬计划。",
          "现有剧情仍将他列为在任执行官。",
        ],
        en: [
          "He seeks to challenge divine authority through economic systems and works with Pulcinella on Project Stuzha.",
          "Current story material still lists him as an active Harbinger.",
        ],
      },
      imageUrl: "/snezhnaya/avatars/pantalone.webp",
      clues: [
        wikiClue({
          id: "pantalone-wiki-clue",
          title: "Pantalone",
          slug: "Pantalone",
          zh: "页面索引富人的第九席身份、北国银行、经济理念与严冬计划文本。",
          en: "The page indexes Pantalone's Ninth Seat, Northland Bank ties, economic ideology, and Project Stuzha references.",
        }),
      ],
      relatedNodeIds: ["fatui", "pulcinella", "project-stuzha"],
      suggestedQuestions: {
        "zh-CN": ["富人为什么想挑战神明的经济权威？"],
        en: ["Why does Pantalone challenge the gods' economic authority?"],
      },
    },
    {
      id: "unknown-tenth",
      label: { "zh-CN": "第十席", en: "Tenth Seat" },
      aliases: ["第十席", "Tenth Harbinger", "Unknown Tenth"],
      kind: "character",
      tier: "official_text_index",
      summary: {
        "zh-CN": "唯一尚未公开具体持有者的执行官席位，也可能目前为空席。",
        en: "The only numbered Harbinger seat without a disclosed holder; it may currently be vacant.",
      },
      detail: {
        "zh-CN": [
          "官方尚未公布第十席的姓名、代号或经历。",
          "丑角是愚人众统括者，不应仅因席位空缺而推定为第十席。",
        ],
        en: [
          "No official name, codename, or history has been disclosed for the Tenth Seat.",
          "Pierro is the Fatui Director and should not be assigned the Tenth Seat merely because it remains unknown.",
        ],
      },
      clues: [
        wikiClue({
          id: "unknown-tenth-wiki-clue",
          title: "Eleven Fatui Harbingers",
          slug: "Eleven_Fatui_Harbingers",
          zh: "执行官页面说明第十席仍没有已公开的持有者，并可能处于空缺状态。",
          en: "The Harbinger index notes that the Tenth Seat has no disclosed holder and may be vacant.",
        }),
      ],
      relatedNodeIds: ["fatui", "pierro"],
      suggestedQuestions: {
        "zh-CN": ["愚人众第十席为什么仍未公开？"],
        en: ["Why is the Tenth Harbinger still undisclosed?"],
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
        "zh-CN": "由冰之女皇监督、愚人众执行官参与推进的至冬计划。",
        en: "A Snezhnayan project overseen by the Tsaritsa and conducted through the Fatui Harbingers.",
      },
      detail: {
        "zh-CN": [
          "已知参与者包括丑角、公鸡、富人、公子与仆人等执行官。",
          "官方尚未说明计划的全部目标和执行方式，因此不能断言由女皇亲自构思了所有细节。",
        ],
        en: [
          "Known participants include Pierro, Pulcinella, Pantalone, Tartaglia, and Arlecchino.",
          "Official text has not revealed every goal or method, so it does not establish that the Tsaritsa personally designed every detail.",
        ],
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
      relatedNodeIds: [
        "tsaritsa",
        "fatui",
        "pierro",
        "pulcinella",
        "pantalone",
        "tartaglia",
        "arlecchino",
      ],
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
      id: "tsaritsa-heavenly-principles",
      from: "tsaritsa",
      to: "heavenly-principles",
      tier: "official_text_index",
      label: { "zh-CN": "反抗世界秩序", en: "rebels against the world order" },
      direction: "bidirectional",
      tone: "opposition",
      showLabel: true,
    },
    {
      id: "tsaritsa-project-stuzha",
      from: "tsaritsa",
      to: "project-stuzha",
      tier: "official_text_index",
      label: { "zh-CN": "监督", en: "oversees" },
      direction: "forward",
      tone: "plan",
      showLabel: true,
    },
    {
      id: "tsaritsa-fatui",
      from: "tsaritsa",
      to: "fatui",
      tier: "official_text_index",
      label: { "zh-CN": "统领", en: "commands" },
      direction: "forward",
      tone: "command",
      showLabel: true,
    },
    {
      id: "fatui-pierro",
      from: "fatui",
      to: "pierro",
      tier: "official_text_index",
      label: { "zh-CN": "统括执行官", en: "directs the Harbingers" },
      direction: "forward",
      tone: "command",
      showLabel: true,
    },
    {
      id: "tsaritsa-gnosis",
      from: "tsaritsa",
      to: "gnosis",
      tier: "official_text_index",
      label: { "zh-CN": "收集神之心", en: "collects Gnoses" },
      direction: "forward",
      tone: "lore",
      showLabel: true,
    },
    {
      id: "gnosis-third-descender",
      from: "gnosis",
      to: "third-descender",
      tier: "official_text_index",
      label: { "zh-CN": "遗骸来源", en: "origin in remains" },
      direction: "forward",
      tone: "lore",
      showLabel: true,
    },
    {
      id: "pierro-khaenriah",
      from: "pierro",
      to: "khaenriah-abyss",
      tier: "official_text_index",
      label: { "zh-CN": "坎瑞亚遗民", en: "Khaenri'ahn survivor" },
      direction: "forward",
      tone: "lore",
      showLabel: true,
    },
  ],
};

type NodeVisual = {
  graphGroup: SnezhnayaGraphGroup;
  graphPosition: SnezhnayaGraphPosition;
  status?: SnezhnayaNodeStatus;
  statusLabel?: LocalizedText;
  harbingerRank?: number;
};

const nodeVisuals: Record<string, NodeVisual> = {
  "heavenly-principles": {
    graphGroup: "sovereign",
    graphPosition: { x: 12, y: 9 },
  },
  tsaritsa: {
    graphGroup: "sovereign",
    graphPosition: { x: 50, y: 9 },
  },
  "project-stuzha": {
    graphGroup: "sovereign",
    graphPosition: { x: 88, y: 9 },
  },
  fatui: {
    graphGroup: "organization",
    graphPosition: { x: 50, y: 22 },
  },
  pierro: {
    graphGroup: "director",
    graphPosition: { x: 50, y: 35 },
  },
  capitano: {
    graphGroup: "harbinger",
    graphPosition: { x: 8, y: 52 },
    harbingerRank: 1,
    status: "dormant",
    statusLabel: {
      "zh-CN": "与夜神融合 · 身体沉睡",
      en: "Merged with the Lord of the Night · body dormant",
    },
  },
  dottore: {
    graphGroup: "harbinger",
    graphPosition: { x: 25, y: 52 },
    harbingerRank: 2,
    status: "deceased",
    statusLabel: {
      "zh-CN": "切片清除 · 后续个体消亡",
      en: "Segments erased · later iteration perished",
    },
  },
  columbina: {
    graphGroup: "harbinger",
    graphPosition: { x: 42, y: 52 },
    harbingerRank: 3,
    status: "former",
    statusLabel: {
      "zh-CN": "前第三席 · 现为月神",
      en: "Former Third · now a Moon Goddess",
    },
  },
  arlecchino: {
    graphGroup: "harbinger",
    graphPosition: { x: 59, y: 52 },
    harbingerRank: 4,
    status: "active",
    statusLabel: { "zh-CN": "现役", en: "Active" },
  },
  pulcinella: {
    graphGroup: "harbinger",
    graphPosition: { x: 76, y: 52 },
    harbingerRank: 5,
    status: "active",
    statusLabel: {
      "zh-CN": "现役 · 至冬城市长",
      en: "Active · Mayor of Snezhnograd",
    },
  },
  scaramouche: {
    graphGroup: "harbinger",
    graphPosition: { x: 93, y: 52 },
    harbingerRank: 6,
    status: "former",
    statusLabel: {
      "zh-CN": "前第六席 · 现为流浪者",
      en: "Former Sixth · now the Wanderer",
    },
  },
  sandrone: {
    graphGroup: "harbinger",
    graphPosition: { x: 16, y: 68 },
    harbingerRank: 7,
    status: "deceased",
    statusLabel: {
      "zh-CN": "身体被摧毁 · 核心已回收",
      en: "Body destroyed · core recovered",
    },
  },
  signora: {
    graphGroup: "harbinger",
    graphPosition: { x: 33, y: 68 },
    harbingerRank: 8,
    status: "deceased",
    statusLabel: {
      "zh-CN": "御前决斗后被处决",
      en: "Executed after the duel before the throne",
    },
  },
  pantalone: {
    graphGroup: "harbinger",
    graphPosition: { x: 50, y: 68 },
    harbingerRank: 9,
    status: "active",
    statusLabel: { "zh-CN": "现役", en: "Active" },
  },
  "unknown-tenth": {
    graphGroup: "harbinger",
    graphPosition: { x: 67, y: 68 },
    harbingerRank: 10,
    status: "unknown",
    statusLabel: {
      "zh-CN": "身份未公开 · 也可能为空席",
      en: "Holder undisclosed · possibly vacant",
    },
  },
  tartaglia: {
    graphGroup: "harbinger",
    graphPosition: { x: 84, y: 68 },
    harbingerRank: 11,
    status: "active",
    statusLabel: { "zh-CN": "现役", en: "Active" },
  },
  "khaenriah-abyss": {
    graphGroup: "lore",
    graphPosition: { x: 18, y: 89 },
  },
  gnosis: {
    graphGroup: "lore",
    graphPosition: { x: 50, y: 89 },
  },
  "third-descender": {
    graphGroup: "lore",
    graphPosition: { x: 82, y: 89 },
  },
};

export const snezhnayaGraph: SnezhnayaGraphData = {
  ...snezhnayaGraphBase,
  nodes: snezhnayaGraphBase.nodes.map((node) => ({
    ...node,
    ...nodeVisuals[node.id],
  })),
};
