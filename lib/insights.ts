import type {
  Language,
  Profile,
  QuestionCategory,
  QuestionEvent,
} from "@/lib/domain";

function countBy<T extends string>(
  events: QuestionEvent[],
  selector: (event: QuestionEvent) => T,
) {
  return Object.entries(
    events.reduce<Record<string, number>>((acc, event) => {
      const key = selector(event);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([key, count]) => ({ key: key as T, count }))
    .sort((a, b) => b.count - a.count);
}

export interface InsightSignal {
  id: string;
  type: "high_frequency" | "profile_concentration" | "language_gap";
  topic: string;
  rule: string;
  evidence: string;
  strength: "medium" | "high";
}

export interface Recommendation {
  id: string;
  type: "FAQ" | "release_note" | "social" | "localization";
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  signalId: string;
  status: "draft";
}

export function aggregateInsights(events: QuestionEvent[]) {
  const languages = countBy<Language>(events, (event) => event.language);
  const profiles = countBy<Profile>(events, (event) => event.playerProfile);
  const categories = countBy<QuestionCategory>(
    events,
    (event) => event.questionCategory,
  );
  const topics = countBy(events, (event) => event.confusionTopic);
  const liveCount = events.filter(
    (event) => event.sourceKind === "live_increment",
  ).length;
  const lastUpdated =
    [...events]
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      )[0]?.occurredAt ?? new Date().toISOString();

  const signals: InsightSignal[] = [];
  const topTopic = topics[0];
  if (topTopic && topTopic.count >= 8 && topTopic.count / events.length >= 0.15) {
    signals.push({
      id: "high-frequency-topic",
      type: "high_frequency",
      topic: topTopic.key,
      rule: "样本数 ≥ 8 且占全部问题 ≥ 15%",
      evidence: `${topTopic.count}/${events.length} (${Math.round(
        (topTopic.count / events.length) * 100,
      )}%)`,
      strength: topTopic.count >= 15 ? "high" : "medium",
    });
  }

  for (const profile of profiles) {
    const group = events.filter((event) => event.playerProfile === profile.key);
    if (group.length < 8) continue;
    const groupTopics = countBy(group, (event) => event.confusionTopic);
    const leader = groupTopics[0];
    const overallShare =
      (topics.find((topic) => topic.key === leader.key)?.count ?? 0) /
      events.length;
    const groupShare = leader.count / group.length;
    if (groupShare - overallShare >= 0.18) {
      signals.push({
        id: `profile-${profile.key}-${leader.key}`,
        type: "profile_concentration",
        topic: leader.key,
        rule: "画像内主题占比比总体高 ≥ 18 个百分点，且画像样本 ≥ 8",
        evidence: `${profile.key}: ${Math.round(
          groupShare * 100,
        )}% vs overall ${Math.round(overallShare * 100)}%`,
        strength: "medium",
      });
      break;
    }
  }

  const zh = events.filter((event) => event.language === "zh-CN");
  const en = events.filter((event) => event.language === "en");
  if (zh.length >= 12 && en.length >= 12) {
    for (const category of categories) {
      const zhShare =
        zh.filter((event) => event.questionCategory === category.key).length /
        zh.length;
      const enShare =
        en.filter((event) => event.questionCategory === category.key).length /
        en.length;
      if (Math.abs(zhShare - enShare) >= 0.12) {
        signals.push({
          id: `language-${category.key}`,
          type: "language_gap",
          topic: category.key,
          rule: "中英文类别占比差 ≥ 12 个百分点，且两组样本均 ≥ 12",
          evidence: `ZH ${Math.round(zhShare * 100)}% / EN ${Math.round(
            enShare * 100,
          )}%`,
          strength: "medium",
        });
        break;
      }
    }
  }

  const recommendations: Recommendation[] = signals.map((signal, index) => {
    if (signal.type === "language_gap") {
      return {
        id: `rec-${index}`,
        type: "localization",
        titleZh: "核对中英文内容显著性，而不只核对直译",
        titleEn: "Review information salience across CN and EN",
        bodyZh:
          "为差异最大的主题补充并列示例与术语解释，检查是否有一侧把关键背景藏在过长的叙述中。发布前由本地化与内容团队共同审核。",
        bodyEn:
          "Add parallel examples and terminology support for the largest gap, then check whether key context is buried in one language. Route the draft to localization and content review.",
        signalId: signal.id,
        status: "draft",
      };
    }
    return {
      id: `rec-${index}`,
      type: "FAQ",
      titleZh: "新增“最小必要补课”FAQ",
      titleEn: "Add a minimum-context catch-up FAQ",
      bodyZh:
        "围绕该高频困惑制作一页可按玩家进度展开的 FAQ：先回答“是否必须补完”，再给 3 个必要背景点，并清楚标注事实状态与剧透深度。",
      bodyEn:
        "Create a progress-aware FAQ for this recurring confusion: answer whether full completion is required, give three essential context points, and label fact status and spoiler depth.",
      signalId: signal.id,
      status: "draft",
    };
  });

  return {
    total: events.length,
    liveCount,
    lastUpdated,
    languages,
    profiles,
    categories,
    topics,
    signals,
    recommendations,
    consentedSamples: events
      .filter((event) => event.textConsent && event.questionText)
      .slice(-6)
      .reverse(),
  };
}
