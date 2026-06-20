import type { KnowledgeEntry, Language } from "@/lib/domain";

const wikiBase = "https://genshin-impact.fandom.com/wiki/";
const questIndex = (slug: string) => `${wikiBase}${slug}`;

type PairSeed = Omit<
  KnowledgeEntry,
  "id" | "language" | "reviewed" | "title" | "content" | "summary" | "aliases"
> & {
  zh: Pick<KnowledgeEntry, "title" | "content" | "summary" | "aliases">;
  en: Pick<KnowledgeEntry, "title" | "content" | "summary" | "aliases">;
};

const pairs: PairSeed[] = [
  {
    conceptId: "gnosis-definition",
    zh: {
      title: "神之心是什么",
      content:
        "神之心是七神与天空岛体系相关的特殊物件，能提供强大的元素能量，但它并不等同于神座或全部元素权能。枫丹剧情进一步确认，神之心以第三降临者的遗骨制成。",
      summary: "神之心是强力媒介，但不是神座或全部元素权能本身。",
      aliases: ["神之心", "Gnosis", "七神", "第三降临者"],
    },
    en: {
      title: "What a Gnosis is",
      content:
        "A Gnosis is a special object tied to the Seven and Celestia's order. It can supply immense elemental energy, but it is not identical to a divine throne or the entirety of an elemental authority. Fontaine's story further identifies the Gnoses as remains of the Third Descender.",
      summary: "A Gnosis is a powerful medium, not the divine throne or all elemental authority.",
      aliases: ["Gnosis", "Gnoses", "The Seven", "Third Descender"],
    },
    tags: ["gnosis", "celestia", "definition"],
    contentType: "story",
    spoilerLevel: 1,
    minimumProgress: "fontaine",
    factStatus: "official_explicit",
    source: {
      title: "Gnosis — in-game story index",
      url: questIndex("Gnosis"),
      sourceName: "In-game text indexed by Genshin Impact Wiki",
      sourceKind: "game_text",
    },
  },
  {
    conceptId: "gnosis-mondstadt",
    zh: {
      title: "蒙德：风神之心被夺走",
      content:
        "蒙德危机结束后，女士在西风大教堂外伏击温迪并夺走风神之心。这是旅行者首次明确看到愚人众执行官回收神之心。",
      summary: "女士以武力从温迪手中夺走风神之心。",
      aliases: ["蒙德", "风神之心", "温迪", "女士", "Signora"],
    },
    en: {
      title: "Mondstadt: the Anemo Gnosis was taken",
      content:
        "After Mondstadt's crisis, Signora ambushed Venti outside the cathedral and took the Anemo Gnosis. This is the Traveler's first explicit encounter with a Harbinger retrieving a Gnosis.",
      summary: "Signora took Venti's Anemo Gnosis by force.",
      aliases: ["Mondstadt", "Anemo Gnosis", "Venti", "Signora"],
    },
    tags: ["gnosis", "mondstadt", "signora"],
    contentType: "story",
    spoilerLevel: 1,
    minimumProgress: "mondstadt",
    factStatus: "official_explicit",
    source: {
      title: "Ending Note",
      url: questIndex("Ending_Note"),
      sourceName: "In-game Archon Quest text index",
      sourceKind: "game_text",
    },
  },
  {
    conceptId: "gnosis-liyue",
    zh: {
      title: "璃月：岩神之心成为契约筹码",
      content:
        "钟离与冰之女皇签订“终结一切契约的契约”，在璃月事件结束后把岩神之心交给女士。交易的完整对价尚未公开。",
      summary: "钟离依照与冰之女皇的契约交出岩神之心。",
      aliases: ["璃月", "岩神之心", "钟离", "契约", "女士"],
    },
    en: {
      title: "Liyue: the Geo Gnosis became a contract term",
      content:
        "Zhongli entered the 'contract to end all contracts' with the Tsaritsa and handed the Geo Gnosis to Signora after the Liyue crisis. The full consideration exchanged in that contract remains undisclosed.",
      summary: "Zhongli surrendered the Geo Gnosis under a contract with the Tsaritsa.",
      aliases: ["Liyue", "Geo Gnosis", "Zhongli", "contract", "Signora"],
    },
    tags: ["gnosis", "liyue", "contract"],
    contentType: "story",
    spoilerLevel: 1,
    minimumProgress: "liyue",
    factStatus: "official_explicit",
    source: {
      title: "The Fond Farewell",
      url: questIndex("The_Fond_Farewell"),
      sourceName: "In-game Archon Quest text index",
      sourceKind: "game_text",
    },
  },
  {
    conceptId: "gnosis-inazuma",
    zh: {
      title: "稻妻：雷神之心经由八重神子流转",
      content:
        "雷电影早已把雷神之心交给八重神子保管。旅行者在邪眼工厂陷入危险时，八重神子用它换取旅行者安全，散兵随后带走神之心。",
      summary: "八重神子用雷神之心从散兵手中换回旅行者。",
      aliases: ["稻妻", "雷神之心", "八重神子", "散兵", "邪眼工厂"],
    },
    en: {
      title: "Inazuma: the Electro Gnosis passed through Yae Miko",
      content:
        "Ei had already entrusted the Electro Gnosis to Yae Miko. When the Traveler was endangered at the Delusion Factory, Yae exchanged it for the Traveler's safety, and Scaramouche left with the Gnosis.",
      summary: "Yae Miko traded the Electro Gnosis to Scaramouche for the Traveler's safety.",
      aliases: ["Inazuma", "Electro Gnosis", "Yae Miko", "Scaramouche"],
    },
    tags: ["gnosis", "inazuma", "scaramouche"],
    contentType: "story",
    spoilerLevel: 1,
    minimumProgress: "inazuma",
    factStatus: "official_explicit",
    source: {
      title: "The Omnipresent God",
      url: questIndex("The_Omnipresent_God"),
      sourceName: "In-game Archon Quest text index",
      sourceKind: "game_text",
    },
  },
  {
    conceptId: "gnosis-sumeru",
    zh: {
      title: "须弥：两枚神之心通过谈判交给博士",
      content:
        "纳西妲取回散兵使用的雷神之心后，与博士谈判：雷神之心换取博士销毁其他切片，草神之心换取关于提瓦特虚假之天的信息。博士最终带走两枚神之心。",
      summary: "博士通过两次交换取得雷、草两枚神之心。",
      aliases: ["须弥", "草神之心", "雷神之心", "纳西妲", "博士"],
    },
    en: {
      title: "Sumeru: Dottore obtained two Gnoses through negotiation",
      content:
        "After Nahida recovered the Electro Gnosis used by Scaramouche, she negotiated with Dottore: the Electro Gnosis for the destruction of his other segments, and the Dendro Gnosis for information about Teyvat's false sky. Dottore departed with both.",
      summary: "Dottore acquired the Electro and Dendro Gnoses through two exchanges.",
      aliases: ["Sumeru", "Dendro Gnosis", "Electro Gnosis", "Nahida", "Dottore"],
    },
    tags: ["gnosis", "sumeru", "dottore"],
    contentType: "story",
    spoilerLevel: 2,
    minimumProgress: "sumeru",
    factStatus: "official_explicit",
    source: {
      title: "A Toast to Victory",
      url: questIndex("A_Toast_to_Victory"),
      sourceName: "In-game Archon Quest text index",
      sourceKind: "game_text",
    },
  },
  {
    conceptId: "gnosis-fontaine",
    zh: {
      title: "枫丹：水神之心被交给仆人",
      content:
        "芙卡洛斯摧毁水神神座并归还水元素权能后，神之心仍作为独立物件存在。那维莱特在处理枫丹危机后将水神之心交给仆人，仆人把它带回至冬。",
      summary: "那维莱特将水神之心交给仆人，愚人众由此取得它。",
      aliases: ["枫丹", "水神之心", "那维莱特", "仆人", "芙卡洛斯"],
    },
    en: {
      title: "Fontaine: the Hydro Gnosis was given to Arlecchino",
      content:
        "After Focalors destroyed the Hydro divine throne and restored the Hydro Authority, the Gnosis remained a separate object. Once Fontaine's crisis was resolved, Neuvillette gave it to Arlecchino, who carried it back toward Snezhnaya.",
      summary: "Neuvillette gave the Hydro Gnosis to Arlecchino for return to the Fatui.",
      aliases: ["Fontaine", "Hydro Gnosis", "Neuvillette", "Arlecchino", "Focalors"],
    },
    tags: ["gnosis", "fontaine", "arlecchino"],
    contentType: "story",
    spoilerLevel: 2,
    minimumProgress: "fontaine",
    factStatus: "official_explicit",
    source: {
      title: "Masquerade of the Guilty",
      url: questIndex("Masquerade_of_the_Guilty"),
      sourceName: "In-game Archon Quest text index",
      sourceKind: "game_text",
    },
  },
  {
    conceptId: "gnosis-natlan",
    zh: {
      title: "纳塔：火神之心未被愚人众夺取",
      content:
        "队长曾以取得火神之心为目标与玛薇卡交手，但在败北后拒绝趁她虚弱时强夺。纳塔主线结束时，火神之心仍不属于愚人众已确认持有的神之心。",
      summary: "队长没有强夺火神之心，纳塔主线未确认愚人众取得它。",
      aliases: ["纳塔", "火神之心", "玛薇卡", "队长", "Capitano"],
    },
    en: {
      title: "Natlan: the Fatui did not seize the Pyro Gnosis",
      content:
        "Capitano pursued the Pyro Gnosis and fought Mavuika, but after losing he refused to take it while she was weakened. By the close of Natlan's main crisis, the Pyro Gnosis was not among the Gnoses confirmed to be in Fatui custody.",
      summary: "Capitano did not seize the Pyro Gnosis, and Natlan did not confirm Fatui possession.",
      aliases: ["Natlan", "Pyro Gnosis", "Mavuika", "Capitano"],
    },
    tags: ["gnosis", "natlan", "capitano"],
    contentType: "story",
    spoilerLevel: 2,
    minimumProgress: "natlan",
    factStatus: "official_explicit",
    source: {
      title: "Chapter V — Natlan Archon Quest",
      url: questIndex("Chapter_V"),
      sourceName: "In-game Archon Quest text index",
      sourceKind: "game_text",
    },
  },
  {
    conceptId: "gnosis-third-descender",
    zh: {
      title: "神之心与第三降临者",
      content:
        "丝柯克转述其师父苏尔特洛奇的说法：神之心是第三降临者的遗骨。这个事实解释了神之心为何可能带来超出七神行政象征的风险，但没有直接说明冰之女皇打算如何使用它们。",
      summary: "神之心由第三降临者遗骨制成，但用途仍未公开。",
      aliases: ["第三降临者", "丝柯克", "苏尔特洛奇", "遗骨", "神之心"],
    },
    en: {
      title: "The Gnoses and the Third Descender",
      content:
        "Skirk relayed Surtalogi's statement that the Gnoses are the remains of the Third Descender. This explains why they may carry risks beyond serving as symbols of the Seven, but it does not reveal how the Tsaritsa intends to use them.",
      summary: "Gnoses are remains of the Third Descender, while their intended use is undisclosed.",
      aliases: ["Third Descender", "Skirk", "Surtalogi", "remains", "Gnosis"],
    },
    tags: ["gnosis", "descender", "celestia"],
    contentType: "story",
    spoilerLevel: 2,
    minimumProgress: "fontaine",
    factStatus: "official_explicit",
    source: {
      title: "Finale",
      url: questIndex("Finale"),
      sourceName: "In-game Archon Quest text index",
      sourceKind: "game_text",
    },
  },
  {
    conceptId: "tsaritsa-old-world-implication",
    zh: {
      title: "冰之女皇与“旧世界”的文本暗示",
      content:
        "哀叙冰玉的描述以冰之女皇口吻提到“背负世界的委屈”与“为我燃烧旧世界”。它能支持女皇对现有世界秩序抱有敌意的解读，但不能单独证明她收集神之心的具体方案。",
      summary: "材料文本暗示女皇反对旧秩序，不足以确定神之心计划。",
      aliases: ["哀叙冰玉", "旧世界", "冰之女皇", "燃烧", "Shivada Jade"],
    },
    en: {
      title: "The Tsaritsa and the 'old world' implication",
      content:
        "Shivada Jade Gemstone uses the Tsaritsa's voice to speak of bearing the world's grievances and burning away the old world. It supports reading her as hostile to the present order, but it does not by itself prove a specific plan for the Gnoses.",
      summary: "The material text implies opposition to the old order, not a confirmed Gnosis plan.",
      aliases: ["Shivada Jade Gemstone", "old world", "Tsaritsa", "burn"],
    },
    tags: ["tsaritsa", "implication", "item-text"],
    contentType: "story",
    spoilerLevel: 1,
    minimumProgress: "mondstadt",
    factStatus: "narrative_implied",
    source: {
      title: "Shivada Jade Gemstone description",
      url: questIndex("Shivada_Jade_Gemstone"),
      sourceName: "In-game item text index",
      sourceKind: "game_text",
    },
  },
  {
    conceptId: "fatui-pale-flame-implication",
    zh: {
      title: "苍白之火中的愚人众目标暗示",
      content:
        "“苍白之火”圣遗物故事描绘了部分执行官加入愚人众时对世界、神与旧秩序的态度。它能补充愚人众高层的思想背景，但这些角色动机不能自动等同于冰之女皇完整计划。",
      summary: "圣遗物文本补充执行官思想背景，不能替代女皇计划的明示证据。",
      aliases: ["苍白之火", "圣遗物", "执行官", "女皇", "Pale Flame"],
    },
    en: {
      title: "Fatui purpose implied by Pale Flame",
      content:
        "The Pale Flame artifact stories describe how several Harbingers approached the Fatui and the existing order of gods and the world. They add ideological context, but individual Harbinger motives cannot be treated as a complete statement of the Tsaritsa's plan.",
      summary: "Artifact stories add Harbinger context without proving the Tsaritsa's full plan.",
      aliases: ["Pale Flame", "artifact", "Harbingers", "Tsaritsa"],
    },
    tags: ["fatui", "artifact-text", "implication"],
    contentType: "character",
    spoilerLevel: 2,
    minimumProgress: "sumeru",
    factStatus: "narrative_implied",
    source: {
      title: "Pale Flame artifact set stories",
      url: questIndex("Pale_Flame"),
      sourceName: "In-game artifact text index",
      sourceKind: "game_text",
    },
  },
  {
    conceptId: "tsaritsa-plan-unknown",
    zh: {
      title: "冰之女皇为何收集神之心：仍未明示",
      content:
        "剧情已确认愚人众长期收集神之心，也给出女皇反对现有秩序的多处线索；但截至当前正式实装文本，女皇尚未公开说明集齐神之心后的完整步骤、代价和最终用途。",
      summary: "收集行为已确认，完整目的与使用方案仍未知。",
      aliases: ["为什么收集", "冰之女皇目的", "神之心用途", "未知"],
    },
    en: {
      title: "Why the Tsaritsa collects Gnoses remains unstated",
      content:
        "The story confirms a long-running Fatui effort to collect Gnoses and offers multiple clues that the Tsaritsa opposes the present order. Current released text still does not disclose the complete procedure, cost, or final use planned for a full set.",
      summary: "The collection is confirmed; its complete purpose and method remain unknown.",
      aliases: ["why collect", "Tsaritsa goal", "Gnosis use", "unknown"],
    },
    tags: ["tsaritsa", "gnosis", "unknown"],
    contentType: "version_overview",
    spoilerLevel: 1,
    minimumProgress: "fontaine",
    factStatus: "official_explicit",
    source: {
      title: "Gnosis — current released-story status",
      url: questIndex("Gnosis"),
      sourceName: "In-game story index",
      sourceKind: "game_text",
    },
  },
  {
    conceptId: "gnosis-nodkrai",
    zh: {
      title: "挪德卡莱：火神之心在焚烧世界树后失踪",
      content:
        "在挪德卡莱主线月之七中，玛薇卡将火神之心借给纳西妲，并由旅行者将其带过世界树屏障。纳西妲使用火神之心焚毁已被博士破坏、无法修复的世界树体系，博士及其切片相关威胁也在决战中终结。火神之心在释放力量时消失，事后未能找到，因此最新已知状态是下落不明。",
      summary: "火神之心被用于焚毁世界树，释放力量后消失，现下落不明。",
      aliases: [
        "挪德卡莱",
        "月之七",
        "火神之心下落",
        "纳西妲焚烧世界树",
        "博士切片",
      ],
    },
    en: {
      title: "Nod-Krai: the Pyro Gnosis vanishes after Irminsul burns",
      content:
        "In Nod-Krai's Luna VII Archon Quest, Mavuika lends the Pyro Gnosis to Nahida, with the Traveler carrying it through Irminsul's barrier. Nahida uses it to burn the irreparably damaged Irminsul system, ending the threat tied to Dottore and his segments. The Gnosis disappears as its power is released and cannot be found afterward, so its latest confirmed status is unknown.",
      summary: "The Pyro Gnosis powers Irminsul's destruction, then vanishes and remains unaccounted for.",
      aliases: [
        "Nod-Krai",
        "Luna VII",
        "Pyro Gnosis whereabouts",
        "Nahida burns Irminsul",
        "Dottore segments",
      ],
    },
    tags: ["gnosis", "nodkrai", "irminsul", "dottore"],
    contentType: "story",
    spoilerLevel: 2,
    minimumProgress: "nodkrai",
    factStatus: "official_explicit",
    source: {
      title: "Truth Amongst the Pages of Purana",
      url: questIndex("Truth_Amongst_the_Pages_of_Purana_(Quest)"),
      sourceName: "In-game Archon Quest text index",
      sourceKind: "game_text",
    },
  },
];

export const gnosisKnowledgeEntries: KnowledgeEntry[] = pairs.flatMap((pair) =>
  (["zh-CN", "en"] as Language[]).map((language) => {
    const localized = language === "zh-CN" ? pair.zh : pair.en;
    return {
      id: `${pair.conceptId}-${language === "zh-CN" ? "zh" : "en"}`,
      conceptId: pair.conceptId,
      language,
      title: localized.title,
      content: localized.content,
      summary: localized.summary,
      aliases: localized.aliases,
      tags: pair.tags,
      contentType: pair.contentType,
      spoilerLevel: pair.spoilerLevel,
      minimumProgress: pair.minimumProgress,
      factStatus: pair.factStatus,
      source: pair.source,
      reviewed: true,
    };
  }),
);
