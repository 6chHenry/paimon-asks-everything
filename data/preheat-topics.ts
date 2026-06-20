import type { PreheatTopic } from "@/lib/domain";

export const defaultPreheatTopicId = "why-fatui-collect-gnoses";

export const preheatTopics: PreheatTopic[] = [
  {
    id: defaultPreheatTopicId,
    titleZh: "愚人众为什么收集神之心？",
    titleEn: "Why are the Fatui collecting Gnoses?",
    introZh:
      "从六国到挪德卡莱，神之心的经历并不相同：有的被夺走，有的用于交易，也有的在其他危机中被消耗并失踪。把这些事件连起来，能看见愚人众任务的连续性，也能看见“目的尚未公开”的边界。",
    introEn:
      "From the six nations through Nod-Krai, the Gnoses do not share one journey: some were taken, some traded, and one vanished after being used in another crisis. Connecting those events reveals a continuous Fatui mission—and the limits of what its purpose currently tells us.",
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
      "冰之女皇已经明确说过为什么收集神之心吗？",
      "为什么愚人众在每个国家取得神之心的方法都不同？",
      "神之心和第三降临者到底是什么关系？",
    ],
    suggestedQuestionsEn: [
      "Has the Tsaritsa explicitly explained why she is collecting Gnoses?",
      "Why does the Fatui use a different method in each nation?",
      "What is the connection between the Gnoses and the Third Descender?",
    ],
  },
  {
    id: "seven-gnosis-journeys",
    titleZh: "七枚神之心分别经历了什么？",
    titleEn: "What happened to each of the seven Gnoses?",
    introZh:
      "这条时间线只放已经在正式剧情中发生的流转事件。暗示和猜想留在详情层，避免把“可能如何使用”混成“已经发生什么”。",
    introEn:
      "This timeline contains only transfers that occurred in released story content. Implications and theories remain in the detail layer so possible uses are never confused with confirmed events.",
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
      "目前哪些神之心已经确认在愚人众手里？",
      "雷神之心为什么会从稻妻流转到须弥？",
      "火神之心最后去了哪里？",
    ],
    suggestedQuestionsEn: [
      "Which Gnoses are confirmed to be in Fatui custody?",
      "Why did the Electro Gnosis travel from Inazuma to Sumeru?",
      "What is the Pyro Gnosis's latest known status?",
    ],
  },
  {
    id: "tsaritsa-known-unknown",
    titleZh: "冰之女皇的目标：目前有哪些已知与未知？",
    titleEn: "The Tsaritsa's goal: what is known and unknown?",
    introZh:
      "已知的是长期收集行动与对旧秩序的敌意；未知的是集齐后的完整步骤、代价和最终用途。这个主题专门把证据层级拆开。",
    introEn:
      "What is known is the long-running collection campaign and hostility toward the old order. What remains unknown is the complete procedure, cost, and final use. This topic separates those evidence layers.",
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
      "哀叙冰玉能证明女皇要反抗天理吗？",
      "苍白之火里的执行官动机能代表女皇吗？",
      "火神之心失踪会改变女皇的收集计划吗？",
    ],
    suggestedQuestionsEn: [
      "Does Shivada Jade prove the Tsaritsa plans to fight Celestia?",
      "Do the Pale Flame Harbinger motives represent the Tsaritsa?",
      "Does the missing Pyro Gnosis change the Tsaritsa's collection plan?",
    ],
  },
];
