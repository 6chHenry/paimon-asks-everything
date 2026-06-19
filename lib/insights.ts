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

export interface InsightBriefingCard {
  id: string;
  topic: string;
  titleZh: string;
  titleEn: string;
  plainSummaryZh: string;
  plainSummaryEn: string;
  playerNeedZh: string;
  playerNeedEn: string;
  strategyZh: string;
  strategyEn: string;
  affectedPlayers: string;
  priority: "high" | "medium";
  evidenceItems: string[];
}

const topicPlaybook: Record<
  string,
  {
    labelZh: string;
    labelEn: string;
    needZh: string;
    needEn: string;
    strategyZh: string;
    strategyEn: string;
  }
> = {
  fontaine_catch_up: {
    labelZh: "枫丹回归补课",
    labelEn: "Fontaine catch-up",
    needZh: "玩家不是想补完全部旧内容，而是想知道进入新版本前最低需要理解哪几件事。",
    needEn:
      "Players are not asking to replay everything; they want the minimum context needed before entering the new release.",
    strategyZh:
      "做一页按进度展开的“最小必要背景”：先给 3 个必须知道的剧情点，再把可跳过内容折叠到次级区域。",
    strategyEn:
      "Create a progress-aware minimum-context page: lead with three must-know story points and move optional catch-up into expandable sections.",
  },
  sandrone_identity: {
    labelZh: "桑多涅身份与关系",
    labelEn: "Sandrone identity and relationships",
    needZh: "剧情型玩家在追问角色关系链，尤其是机械研究、阿兰、玛丽安与执行官身份之间的联系。",
    needEn:
      "Lore-focused players are trying to connect character relationships, especially machinery research, Alain, Mary-Ann, and Harbinger identity clues.",
    strategyZh:
      "准备带剧透层级的角色关系图：公共信息、剧情暗示、社区推测分层展示，避免社媒物料把推测写成定论。",
    strategyEn:
      "Prepare a spoiler-layered relationship map: separate public facts, narrative implications, and community theories so social copy does not present theory as fact.",
  },
  layered_puzzle_help: {
    labelZh: "分层解谜提示",
    labelEn: "Layered puzzle help",
    needZh: "探索玩家想要提示，但不想一上来被完整解法剥夺解谜体验。",
    needEn:
      "Exploration players want hints without having the full solution revealed immediately.",
    strategyZh:
      "把攻略内容改成三段式：观察线索、关键机制、完整步骤，并在标题里明确“无剧透提示”。",
    strategyEn:
      "Convert guides into three layers: what to observe, the key mechanism, and the full steps. Label the first layer as spoiler-light.",
  },
  terminology: {
    labelZh: "术语理解",
    labelEn: "Terminology",
    needZh: "新玩家卡在名词和阵营关系上，问题本身通常不是剧情深度，而是入口解释不够低门槛。",
    needEn:
      "New players are blocked by terms and faction relationships; the issue is often onboarding clarity rather than deep lore.",
    strategyZh:
      "补一套跨语言术语小抄：每个词只用一句话解释，并附“什么时候需要知道它”。",
    strategyEn:
      "Add a cross-language terminology cheat sheet: one plain sentence per term plus when the player actually needs it.",
  },
};

function playbookFor(topic: string) {
  return (
    topicPlaybook[topic] ?? {
      labelZh: topic.replaceAll("_", " "),
      labelEn: topic.replaceAll("_", " "),
      needZh: "玩家在这个主题上反复追问，说明当前内容没有把关键上下文放在足够显眼的位置。",
      needEn:
        "Repeated questions on this topic suggest the key context is not visible enough in the current content.",
      strategyZh:
        "把该主题整理成短 FAQ：先回答一句结论，再列必要背景、来源和剧透边界。",
      strategyEn:
        "Turn this topic into a short FAQ: start with a one-sentence answer, then list required context, sources, and spoiler boundaries.",
    }
  );
}

function buildBriefingCards(events: QuestionEvent[]) {
  const topics = countBy(events, (event) => event.confusionTopic);
  return topics.slice(0, 4).map((topic) => {
    const group = events.filter((event) => event.confusionTopic === topic.key);
    const profiles = countBy<Profile>(group, (event) => event.playerProfile);
    const languages = countBy<Language>(group, (event) => event.language);
    const categories = countBy<QuestionCategory>(
      group,
      (event) => event.questionCategory,
    );
    const playbook = playbookFor(topic.key);
    const share = Math.round((topic.count / Math.max(1, events.length)) * 100);
    const leadingProfile = profiles[0]?.key ?? "unknown";
    const languageText = languages
      .map((item) => `${item.key}: ${item.count}`)
      .join(" / ");
    const categoryText = categories
      .slice(0, 2)
      .map((item) => item.key.replaceAll("_", " "))
      .join(", ");

    return {
      id: `brief-${topic.key}`,
      topic: topic.key,
      titleZh: `玩家在问：${playbook.labelZh}`,
      titleEn: `Players are asking about ${playbook.labelEn}`,
      plainSummaryZh: `这个困惑出现了 ${topic.count} 次，占全部问题 ${share}%。主要来自 ${leadingProfile} 玩家，说明它已经不是零散长尾。`,
      plainSummaryEn: `This confusion appeared ${topic.count} times, ${share}% of all questions. It is led by ${leadingProfile} players, so it is more than a one-off long tail.`,
      playerNeedZh: playbook.needZh,
      playerNeedEn: playbook.needEn,
      strategyZh: playbook.strategyZh,
      strategyEn: playbook.strategyEn,
      affectedPlayers: `${topic.count} events · ${leadingProfile} · ${languageText}`,
      priority: topic.count >= 12 || share >= 20 ? "high" : "medium",
      evidenceItems: [
        `topic=${topic.key}`,
        `category=${categoryText || "unknown"}`,
        `languages=${languageText || "unknown"}`,
        `share=${share}%`,
      ],
    } satisfies InsightBriefingCard;
  });
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
    briefingCards: buildBriefingCards(events),
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
