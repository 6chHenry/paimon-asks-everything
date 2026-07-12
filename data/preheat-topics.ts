import type { PreheatTopic } from "@/lib/domain";

export const defaultPreheatTopicId = "seven-gnosis-journeys";

export const preheatTopics: PreheatTopic[] = [
  {
    id: "why-fatui-collect-gnoses",
    titleZh: "愚人众为什么收集神之心？",
    titleEn: "Why are the Fatui collecting Gnoses?",
    introZh:
      "从六国到挪德卡莱，神之心的经历并不相同：有的被夺走，有的用于交易，也有的在其他危机中被消耗并失踪。把这些事件连起来，能看见愚人众任务的连续性，也能看见“目的尚未公开”的边界。",
    introEn:
      "From the six nations through Nod-Krai, the Gnoses do not share one journey: some were taken, some traded, and one disappeared after being used in another crisis. This timeline follows the released events and their confirmed participants.",
    heroConceptIds: [
      "gnosis-mondstadt",
      "tsaritsa-plan-unknown",
      "gnosis-third-descender",
    ],
    depthConceptIds: {
      guided: [
        "gnosis-mondstadt",
        "gnosis-liyue",
        "gnosis-inazuma",
        "gnosis-sumeru",
        "gnosis-fontaine",
        "gnosis-natlan",
        "gnosis-nodkrai",
        "tsaritsa-plan-unknown",
      ],
      research: [
        "gnosis-third-descender",
        "tsaritsa-old-world-implication",
        "fatui-pale-flame-implication",
        "tsaritsa-plan-unknown",
        "gnosis-nodkrai",
      ],
    },
    timelineNodeIds: [
      "mondstadt-gnosis",
      "liyue-gnosis",
      "inazuma-gnosis",
      "sumeru-gnoses",
      "fontaine-gnosis",
      "natlan-gnosis",
      "nodkrai-gnosis",
    ],
    relationGraphId: "fatui-gnosis-overview",
    suggestedQuestionsZh: [
      "从蒙德夺取到璃月依契约交付，为什么愚人众在前两国采用了完全不同的方式？",
      "从稻妻的交换到须弥的谈判，雷神之心如何变成博士取得两枚神之心的筹码？",
      "枫丹交付、纳塔未强夺、挪德卡莱失踪：这些后半段事件的已确认节点如何排列？",
    ],
    suggestedQuestionsEn: [
      "Why does the Fatui shift from seizing the Gnosis in Mondstadt to a contract transfer in Liyue?",
      "How does the Electro Gnosis move from an Inazuma bargain to Dottore's negotiation for two Gnoses in Sumeru?",
      "How do the confirmed Fontaine, Natlan, and Nod-Krai events connect in the later Gnosis chain?",
    ],
  },
  {
    id: defaultPreheatTopicId,
    titleZh: "七枚神之心分别经历了什么？",
    titleEn: "What happened to each of the seven Gnoses?",
    introZh: "本栏目按地区串联七枚神之心的已确认经历，并标出每一步的直接参与者与来源。",
    introEn: "This page connects the seven Gnoses through confirmed regional events, direct participants, and sources.",
    heroConceptIds: [
      "gnosis-mondstadt",
      "gnosis-sumeru",
      "gnosis-natlan",
    ],
    depthConceptIds: {
      guided: [
        "gnosis-mondstadt",
        "gnosis-liyue",
        "gnosis-inazuma",
        "gnosis-sumeru",
        "gnosis-fontaine",
        "gnosis-natlan",
        "gnosis-nodkrai",
      ],
      research: [
        "gnosis-third-descender",
        "tsaritsa-old-world-implication",
        "fatui-pale-flame-implication",
        "tsaritsa-plan-unknown",
        "gnosis-nodkrai",
      ],
    },
    timelineNodeIds: [
      "mondstadt-gnosis",
      "liyue-gnosis",
      "inazuma-gnosis",
      "sumeru-gnoses",
      "fontaine-gnosis",
      "natlan-gnosis",
      "nodkrai-gnosis",
    ],
    relationGraphId: "gnosis-journey-overview",
    suggestedQuestionsZh: [
      "蒙德到璃月：风神之心被夺、岩神之心依契约交付，这两段起点有什么差异？",
      "稻妻到须弥：雷神之心如何从交换旅行者安全，变成博士取得两枚神之心的筹码？",
      "枫丹、纳塔到挪德卡莱：水神之心交接、火神之心未被强夺及其后续状态，哪些事实已被剧情确认？",
    ],
    suggestedQuestionsEn: [
      "Mondstadt to Liyue: how do Signora's seizure and the contract transfer change the starting point?",
      "Inazuma to Sumeru: how does the Electro Gnosis move from a bargain for safety to Dottore's leverage for two Gnoses?",
      "Fontaine, Natlan, and Nod-Krai: which facts are confirmed about the Hydro handoff, the uncompleted mission, and the Pyro Gnosis's later status?",
    ],
  },
  {
    id: "tsaritsa-known-unknown",
    titleZh: "冰之女皇的目标：目前有哪些已知与未知？",
    titleEn: "The Tsaritsa's goal: what is known and unknown?",
    introZh:
      "已知的是长期收集行动与对旧秩序的敌意；未知的是集齐后的完整步骤、代价和最终用途。这个主题专门把证据层级拆开。",
    introEn:
      "This topic separates released evidence about the long-running collection campaign and hostility toward the old order into clear fact-status layers.",
    heroConceptIds: [
      "tsaritsa-plan-unknown",
      "tsaritsa-old-world-implication",
      "fatui-pale-flame-implication",
    ],
    depthConceptIds: {
      guided: [
        "gnosis-sumeru",
        "gnosis-third-descender",
        "tsaritsa-plan-unknown",
        "gnosis-nodkrai",
      ],
      research: [
        "tsaritsa-old-world-implication",
        "fatui-pale-flame-implication",
        "gnosis-third-descender",
        "tsaritsa-plan-unknown",
        "gnosis-nodkrai",
      ],
    },
    timelineNodeIds: [
      "mondstadt-gnosis",
      "liyue-gnosis",
      "sumeru-gnoses",
      "fontaine-gnosis",
      "natlan-gnosis",
      "nodkrai-gnosis",
    ],
    relationGraphId: "tsaritsa-evidence-boundary",
    suggestedQuestionsZh: [
      "蒙德的夺取与璃月的契约交付，能证明女皇拥有一套统一的收集计划吗？",
      "稻妻的交换与须弥的谈判，哪些是执行官策略，哪些能归因于女皇？",
      "从枫丹到纳塔再到挪德卡莱，火神之心没有按既有路径流转，这会改变哪些已知与未知？",
    ],
    suggestedQuestionsEn: [
      "Can the seizure in Mondstadt and the contract transfer in Liyue prove a unified collection plan?",
      "In Inazuma's bargain and Sumeru's negotiation, which moves belong to the Harbingers and which can be attributed to the Tsaritsa?",
      "From Fontaine to Natlan to Nod-Krai, what known and unknown boundaries shift when the Pyro Gnosis leaves the expected route?",
    ],
  },
];
