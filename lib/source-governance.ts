import { fetch as undiciFetch, ProxyAgent } from "undici";
import type {
  Citation,
  ContentKind,
  FactStatus,
  PlatformKind,
  PublisherKind,
  SourceAssessment,
  SourceAuthority,
  SourceCredibility,
  SourceKind,
} from "@/lib/domain";
import { officialPublisherById } from "@/lib/official-publishers";
import type { SearchIntent, SearchPlan } from "@/lib/external-search";

let proxyAgent: ProxyAgent | undefined;

function getProxyAgent() {
  const proxyUrl =
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.HTTP_PROXY;
  if (!proxyUrl || !/^https?:\/\//i.test(proxyUrl)) return undefined;
  proxyAgent ??= new ProxyAgent(proxyUrl);
  return proxyAgent;
}

const communityHosts = [
  "hoyolab.com",
  "miyoushe.com",
  "tieba.baidu.com",
  "baike.baidu.com",
  "zhihu.com",
  "nga.178.com",
  "bbs.nga.cn",
  "reddit.com",
  "weixin.qq.com",
  "mp.weixin.qq.com",
  "gamersky.com",
  "17173.com",
  "gamer.com.tw",
  "douyin.com",
];

const gameplayPattern =
  /攻略|一图流|养成|培养|配队|圣遗物|武器推荐|输出手法|伤害计算|技能循环|毕业面板|build|guide|walkthrough|team comp|artifact|weapon recommendation|rotation|damage calculation/iu;
const gameplayBodyPattern =
  /主词条|副词条|命座|天赋升级|精炼|充能效率|暴击率|暴击伤害|每秒伤害|循环轴|推荐队伍|best in slot|stat priority|talent priority/iu;
const speculationPattern =
  /猜测|推测|可能是|个人理解|脑洞|未证实|预测|疑似|也许|或许|我认为|考据认为|不应该|这下知道|居然|竟然|还要被|内鬼|爆料|leak|datamine|theory|speculation|probably|might be/iu;
const loreAnalysisPattern =
  /考据|解析|原型|象征|神话|文本分析|剧情分析|深度解读|lore analysis|explained|symbolism|mythology|mystery of/iu;
const officialContentPattern =
  /版本更新|维护预告|活动说明|调整说明|开发者公告|角色介绍|角色预告|角色演示|角色PV|特别节目|更新维护|version update|maintenance|official announcement|character teaser|character demo|special program/iu;
const gameTextPattern =
  /任务文本|传说任务|傳說任務|武器故事|圣遗物故事|书籍|物品描述|角色故事|语音|过场动画|quest text|story quest|quest type story|quest chapter|weapon story|artifact lore|book|item description|character story|voice-over/iu;
const storyCutPattern =
  /剧情\s*(?:cut|纯享|合集|录屏|实录|全对话)|主线\s*剧情|全对话|剧情PV|story\s*cut|full\s*dialogue|recorded\s*(?:quest|story)|quest\s*recording/iu;
const dialogueReferencePattern =
  /(?:剧情|主线|任务)?(?:完整)?(?:全)?对话|剧情彩蛋|剧情片段|主线片段|角色互动|story\s*dialogue|dialogue\s*(?:clip|recording)|character\s*interaction/iu;

function hostMatches(hostname: string, host: string) {
  return hostname === host || hostname.endsWith(`.${host}`);
}

function parsedUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function platformForUrl(url: string): {
  platformKind: PlatformKind;
  platform?: "bilibili" | "youtube" | "miyoushe" | "hoyolab";
  signals: string[];
} {
  const parsed = parsedUrl(url);
  if (!parsed) return { platformKind: "general_web", signals: ["invalid-url"] };
  const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (
    hostMatches(hostname, "genshin.hoyoverse.com") ||
    hostMatches(hostname, "ys.mihoyo.com") ||
    hostMatches(hostname, "act.hoyoverse.com") ||
    hostMatches(hostname, "webstatic.mihoyo.com") ||
    hostMatches(hostname, "hoyoverse.com")
  ) {
    return { platformKind: "official_site", signals: ["official-domain"] };
  }
  if (
    hostMatches(hostname, "baike.mihoyo.com") ||
    hostMatches(hostname, "wiki.hoyolab.com")
  ) {
    return {
      platformKind: "official_operated_wiki",
      signals: ["official-operated-wiki"],
    };
  }
  if (hostMatches(hostname, "bilibili.com")) {
    return {
      platformKind: "video_platform",
      platform: "bilibili",
      signals: ["video-platform"],
    };
  }
  if (
    hostMatches(hostname, "youtube.com") ||
    hostMatches(hostname, "youtu.be")
  ) {
    return {
      platformKind: "video_platform",
      platform: "youtube",
      signals: ["video-platform"],
    };
  }
  if (hostMatches(hostname, "miyoushe.com")) {
    return {
      platformKind: "community",
      platform: "miyoushe",
      signals: ["community-platform"],
    };
  }
  if (hostMatches(hostname, "hoyolab.com")) {
    return {
      platformKind: "community",
      platform: "hoyolab",
      signals: ["community-platform"],
    };
  }
  if (
    hostMatches(hostname, "genshin-impact.fandom.com") ||
    hostMatches(hostname, "wiki.biligame.com")
  ) {
    return {
      platformKind: "general_web",
      signals: ["verified-reference-wiki"],
    };
  }
  if (communityHosts.some((host) => hostMatches(hostname, host))) {
    return { platformKind: "community", signals: ["community-platform"] };
  }
  return { platformKind: "general_web", signals: ["general-web"] };
}

export function extractPublisherIdentity(
  url: string,
  html = "",
): { accountId?: string; verifiedOfficial: boolean; signals: string[] } {
  const platform = platformForUrl(url);
  const parsed = parsedUrl(url);
  const candidates: string[] = [];
  if (platform.platform === "bilibili") {
    const direct = parsed?.pathname.match(/^\/(?:space\/)?(\d+)(?:\/|$)/u)?.[1];
    const fromHtml =
      html.match(/space\.bilibili\.com\/(\d+)/iu)?.[1] ||
      html.match(/["']mid["']\s*:\s*(\d+)/iu)?.[1] ||
      html.match(/["']owner["'][\s\S]{0,160}?["']mid["']\s*:\s*(\d+)/iu)?.[1];
    if (direct) candidates.push(direct);
    if (fromHtml) candidates.push(fromHtml);
  }
  if (platform.platform === "youtube") {
    const direct = parsed?.pathname.match(/^\/channel\/([^/?]+)/u)?.[1];
    const fromHtml =
      html.match(/["']channelId["']\s*:\s*["']([^"']+)["']/iu)?.[1] ||
      html.match(/["']externalId["']\s*:\s*["']([^"']+)["']/iu)?.[1] ||
      html.match(/youtube\.com\/channel\/([^"'/?]+)/iu)?.[1];
    if (direct) candidates.push(direct);
    if (fromHtml) candidates.push(fromHtml);
  }
  if (platform.platform === "miyoushe" || platform.platform === "hoyolab") {
    const fromHtml =
      html.match(/["'](?:account_id|accountId|uid|user_id)["']\s*:\s*["']?(\d+)/iu)?.[1];
    if (fromHtml) candidates.push(fromHtml);
  }
  const accountId = candidates[0];
  const registered =
    platform.platform && officialPublisherById(platform.platform, accountId);
  const verifiedBadge =
    /原神官方账号|official\s+genshin\s+impact|["']is_official["']\s*:\s*true|官方认证/iu.test(
      html,
    );
  const officialName =
    /(?:作者|UP主|channel|name)["']?\s*[:：]\s*["']?(?:原神|Genshin Impact)/iu.test(
      html,
    );
  return {
    accountId,
    verifiedOfficial: Boolean(registered || (verifiedBadge && officialName)),
    signals: [
      ...(accountId ? ["publisher-account-id"] : []),
      ...(registered ? ["official-account-id"] : []),
      ...(!registered && verifiedBadge && officialName
        ? ["official-verification-badge"]
        : []),
    ],
  };
}

function ruleContentKind(
  title: string,
  excerpt: string,
  publisherKind: PublisherKind,
): { contentKind: ContentKind; signals: string[] } {
  const titleText = title.trim();
  const bodyText = excerpt.trim();
  const combined = `${titleText} ${bodyText}`;
  if (
    /吗[？?]?(?:\s*[-—|·].*)?$/u.test(titleText) &&
    !officialContentPattern.test(combined)
  ) {
    return { contentKind: "speculation", signals: ["question-headline"] };
  }
  if (
    gameplayPattern.test(titleText) ||
    (gameplayPattern.test(combined) && gameplayBodyPattern.test(bodyText))
  ) {
    return {
      contentKind: "gameplay_guide",
      signals: [
        gameplayPattern.test(titleText) ? "gameplay-title" : "gameplay-body",
      ],
    };
  }
  if (speculationPattern.test(combined)) {
    return { contentKind: "speculation", signals: ["speculation-language"] };
  }
  if (loreAnalysisPattern.test(combined)) {
    return { contentKind: "lore_analysis", signals: ["lore-analysis-language"] };
  }
  if (officialContentPattern.test(combined)) {
    return {
      contentKind:
        /角色介绍|角色预告|角色演示|角色PV|character teaser|character demo/iu.test(
          combined,
        )
          ? "character_profile"
          : "announcement",
      signals: ["official-content-format"],
    };
  }
  if (storyCutPattern.test(combined)) {
    return {
      contentKind: "game_text_reference",
      signals: ["story-cut-reference"],
    };
  }
  if (dialogueReferencePattern.test(combined)) {
    return {
      contentKind: "game_text_reference",
      signals: ["dialogue-reference"],
    };
  }
  if (gameTextPattern.test(combined)) {
    return { contentKind: "game_text_reference", signals: ["game-text-reference"] };
  }
  return {
    contentKind: "neutral_reference",
    signals: [
      publisherKind === "verified_aggregator"
        ? "neutral-aggregated-reference"
        : "neutral-reference",
    ],
  };
}

function authorityFor(
  platformKind: PlatformKind,
  publisherKind: PublisherKind,
  contentKind: ContentKind,
): SourceAuthority {
  if (platformKind === "official_site" || publisherKind === "genshin_official") {
    return "official";
  }
  if (
    platformKind === "official_operated_wiki" ||
    publisherKind === "verified_aggregator"
  ) {
    return contentKind === "speculation"
      ? "community_speculation"
      : "curated_reference";
  }
  if (contentKind === "speculation") return "community_speculation";
  return "community_analysis";
}

export function assessSourceRule(input: {
  url: string;
  title: string;
  excerpt: string;
  pageHtml?: string;
}): SourceAssessment {
  const platform = platformForUrl(input.url);
  const publisher = extractPublisherIdentity(input.url, input.pageHtml);
  let publisherKind: PublisherKind = "unknown";
  if (publisher.verifiedOfficial) publisherKind = "genshin_official";
  else if (
    platform.platformKind === "official_operated_wiki" ||
    platform.signals.includes("verified-reference-wiki")
  ) {
    publisherKind = "verified_aggregator";
  } else if (
    platform.platformKind === "community" ||
    platform.platformKind === "video_platform"
  ) {
    publisherKind = publisher.accountId ? "user" : "unknown";
  }
  const content = ruleContentKind(input.title, input.excerpt, publisherKind);
  const authority = authorityFor(
    platform.platformKind,
    publisherKind,
    content.contentKind,
  );
  return {
    platformKind: platform.platformKind,
    publisherKind,
    contentKind: content.contentKind,
    authority,
    officialAccountId:
      publisherKind === "genshin_official" ? publisher.accountId : undefined,
    signals: Array.from(
      new Set([...platform.signals, ...publisher.signals, ...content.signals]),
    ),
    confidence:
      platform.platformKind === "official_site" ||
      platform.platformKind === "official_operated_wiki" ||
      publisher.verifiedOfficial
        ? "high"
        : publisherKind === "verified_aggregator"
          ? "medium"
        : publisher.accountId
          ? "medium"
          : "low",
  };
}

export function reconcileContentKind(
  rule: ContentKind,
  model: ContentKind | undefined,
) {
  if (!model || model === rule) return rule;
  const risk: Record<ContentKind, number> = {
    announcement: 0,
    character_profile: 0,
    game_text_reference: 0,
    neutral_reference: 1,
    gameplay_guide: 2,
    lore_analysis: 3,
    speculation: 4,
  };
  return risk[model] > risk[rule] ? model : rule;
}

async function classifyContentWithModel(
  citations: Citation[],
  question: string,
  intent: SearchIntent,
): Promise<Array<{ id: string; contentKind: ContentKind }> | null> {
  if (
    process.env.NODE_ENV === "test" ||
    !process.env.LLM_API_KEY ||
    process.env.SOURCE_CLASSIFIER_LLM_ENABLED === "false" ||
    !citations.length
  ) {
    return null;
  }
  const baseURL = process.env.LLM_BASE_URL || "https://api.deepseek.com";
  const endpoint = new URL("/chat/completions", baseURL);
  const body = JSON.stringify({
    model: process.env.LLM_MODEL || "deepseek-v4-flash",
    thinking: { type: "disabled" },
    temperature: 0,
    max_tokens: 800,
    messages: [
      {
        role: "system",
        content:
          "Classify source content conservatively. Do not assess publisher identity or answer the question. Return strict JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify({
          question,
          intent,
          sources: citations.map((citation) => ({
            id: citation.id,
            title: citation.title,
            excerpt: citation.excerpt.slice(0, 700),
            ruleAssessment: citation.assessment,
          })),
          instruction:
            'Return {"sources":[{"id":"...","contentKind":"announcement|character_profile|game_text_reference|neutral_reference|gameplay_guide|lore_analysis|speculation"}]}. Mark subjective theories as speculation and build/team/artifact/rotation advice as gameplay_guide.',
        }),
      },
    ],
  });
  try {
    const headers = {
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      "Content-Type": "application/json",
    };
    const agent = getProxyAgent();
    const response = agent
      ? await undiciFetch(endpoint, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(20_000),
          dispatcher: agent,
        })
      : await fetch(endpoint, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(20_000),
        });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = payload.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(
      raw.startsWith("```")
        ? raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
        : raw,
    ) as { sources?: Array<{ id?: unknown; contentKind?: unknown }> };
    const allowed: ContentKind[] = [
      "announcement",
      "character_profile",
      "game_text_reference",
      "neutral_reference",
      "gameplay_guide",
      "lore_analysis",
      "speculation",
    ];
    return (parsed.sources ?? [])
      .filter(
        (item): item is { id: string; contentKind: ContentKind } =>
          typeof item.id === "string" &&
          allowed.includes(item.contentKind as ContentKind),
      )
      .map((item) => ({ id: item.id, contentKind: item.contentKind }));
  } catch {
    return null;
  }
}

export async function assessSources(
  citations: Citation[],
  input: { question: string; plan: SearchPlan; useModel?: boolean },
) {
  const ruled = citations.map((citation) => ({
    ...citation,
    assessment:
      citation.assessment ??
      assessSourceRule({
        url: citation.url,
        title: citation.title,
        excerpt: citation.excerpt,
      }),
  }));
  const ambiguous = ruled.filter((citation) => {
    const assessment = citation.assessment!;
    return (
      assessment.confidence === "low" &&
      assessment.contentKind === "neutral_reference" &&
      (assessment.platformKind === "community" ||
        assessment.platformKind === "video_platform" ||
        assessment.publisherKind === "unknown")
    );
  });
  const model =
    input.useModel === false
      ? null
      : await classifyContentWithModel(
          ambiguous,
          input.question,
          input.plan.intent,
        );
  if (!model) return ruled;
  const byId = new Map(model.map((item) => [item.id, item.contentKind]));
  return ruled.map((citation) => {
    const assessment = citation.assessment!;
    const contentKind = reconcileContentKind(
      assessment.contentKind,
      byId.get(citation.id),
    );
    return {
      ...citation,
      assessment: {
        ...assessment,
        contentKind,
        authority: authorityFor(
          assessment.platformKind,
          assessment.publisherKind,
          contentKind,
        ),
        signals: [
          ...assessment.signals,
          ...(byId.has(citation.id) ? ["llm-content-check"] : []),
          ...(contentKind !== assessment.contentKind ? ["conservative-conflict"] : []),
        ],
      },
    };
  });
}

function isGameplayQuestion(question: string) {
  return /技能|天赋|命座|伤害|配队|武器|圣遗物|手法|循环|怎么打|build|skill|talent|constellation|damage|team|weapon|artifact|rotation/iu.test(
    question,
  );
}

function normalized(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, "");
}

function allEntitiesPresent(citation: Citation, plan: SearchPlan) {
  const haystack = normalized(
    `${citation.title} ${citation.excerpt} ${decodeURIComponentSafe(citation.url)}`,
  );
  return plan.coreEntities.every((entity) =>
    haystack.includes(normalized(entity)),
  );
}

function decodeURIComponentSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function sourceAllowedForQuestion(
  citation: Citation,
  input: { question: string; plan: SearchPlan },
) {
  const assessment =
    citation.assessment ??
    assessSourceRule({
      url: citation.url,
      title: citation.title,
      excerpt: citation.excerpt,
    });
  const gameplay = isGameplayQuestion(input.question);
  if (!gameplay && assessment.contentKind === "gameplay_guide") return false;
  if (
    gameplay &&
    (assessment.contentKind === "lore_analysis" ||
      assessment.contentKind === "speculation")
  ) {
    return false;
  }
  if (
    input.plan.intent === "relationship" &&
    input.plan.coreEntities.length > 1 &&
    !allEntitiesPresent(citation, input.plan)
  ) {
    return false;
  }
  if (
    input.plan.storyScope === "character_story_quest" &&
    assessment.authority !== "official" &&
    assessment.authority !== "curated_reference"
  ) {
    return false;
  }
  return true;
}

const authorityRank: Record<SourceAuthority, number> = {
  official: 100,
  curated_reference: 80,
  community_analysis: 40,
  community_speculation: 10,
};

export function sourceGovernanceScore(
  citation: Citation,
  input: { question: string; plan: SearchPlan },
) {
  const assessment =
    citation.assessment ??
    assessSourceRule({
      url: citation.url,
      title: citation.title,
      excerpt: citation.excerpt,
    });
  let score = authorityRank[assessment.authority];
  if (assessment.publisherKind === "genshin_official") score += 30;
  if (assessment.platformKind === "official_operated_wiki") score += 20;
  if (assessment.contentKind === "speculation") score -= 35;
  if (assessment.publisherKind === "unknown") score -= 8;
  if (
    input.plan.intent === "relationship" &&
    input.plan.coreEntities.length > 1 &&
    allEntitiesPresent(citation, input.plan)
  ) {
    score += 60;
  }
  return score;
}

export function legacySourceFields(assessment: SourceAssessment): {
  sourceKind: SourceKind;
  credibility: SourceCredibility;
  factStatus: FactStatus;
  rank: number;
} {
  if (assessment.authority === "official") {
    return {
      sourceKind: "official",
      credibility: "official",
      factStatus: "official_explicit",
      rank: 100,
    };
  }
  if (assessment.authority === "curated_reference") {
    return {
      sourceKind: "trusted_wiki",
      credibility: "trusted_wiki",
      factStatus: "trusted_secondary",
      rank: 80,
    };
  }
  return {
    sourceKind: "community",
    credibility: "community",
    factStatus:
      assessment.authority === "community_analysis"
        ? "community_analysis"
        : "community_speculation",
    rank:
      assessment.authority === "community_analysis"
        ? 40
        : 10,
  };
}
