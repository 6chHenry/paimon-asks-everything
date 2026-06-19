import OpenAI from "openai";
import type {
  Citation,
  KnowledgeEntry,
  Language,
  Profile,
} from "@/lib/domain";
import { t } from "@/lib/i18n";

function deterministicAnswer({
  language,
  profile,
  entries,
  external,
}: {
  language: Language;
  profile: Profile;
  entries: KnowledgeEntry[];
  external: Citation[];
}) {
  if (external.length) {
    return t(
      language,
      `受控语料暂时没有覆盖这个问题。我查到了 ${external.length} 条白名单 Wiki 结果，但它们属于外部社区资料，不能自动视为官方事实。你可以先从“${external[0].title}”开始核对；下面的来源卡保留了可追溯链接。`,
      `The controlled corpus does not cover this question yet. I found ${external.length} result(s) from the whitelisted community wiki, but they are external material rather than automatically official facts. “${external[0].title}” is the best place to begin, and the source cards preserve the traceable links.`,
    );
  }

  const first = entries[0];
  const supporting = entries.slice(1, 3);
  const opening =
    profile === "returning"
      ? t(
          language,
          "可以，不用先把旧内容全部补完。",
          "Yes — you do not need to clear every old quest first.",
        )
      : t(
          language,
          "先给你结论：可以从与当前问题最相关的背景开始。",
          "Short answer: start with only the background that serves this question.",
        );
  const details = [first, ...supporting]
    .filter(Boolean)
    .map((entry) => entry.summary.replace(/[。；.!;]+$/u, ""))
    .join(language === "zh-CN" ? "；" : " ");
  const boundary = entries.some(
    (entry) =>
      entry.factStatus === "community_speculation" ||
      entry.factStatus === "demo_hypothesis",
  )
    ? t(
        language,
        "其中推测与 Demo 假设已单独标记，不会冒充官方剧情结论。",
        "Theories and demo hypotheses are labeled separately and are not presented as official plot facts.",
      )
    : t(
        language,
        "我把每个关键点的来源和事实状态放在下方，方便你自己核对。",
        "Each key point keeps its source and fact status below so you can verify it.",
      );
  return `${opening}\n\n${details}\n\n${boundary}`;
}

export async function generateGroundedAnswer(input: {
  question: string;
  language: Language;
  profile: Profile;
  entries: KnowledgeEntry[];
  external: Citation[];
}) {
  const fallback = deterministicAnswer(input);
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey || input.external.length) return fallback;

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL || undefined,
  });
  const evidence = input.entries.map((entry, index) => ({
    id: `source-${index + 1}`,
    summary: entry.summary,
    factStatus: entry.factStatus,
  }));
  try {
    const completion = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "deepseek-v4-flash",
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You are a concise bilingual game-version understanding assistant. Answer only from supplied evidence. Lead with the answer, preserve spoiler boundaries, never recommend spending or pulling, and do not expose internal reasoning.",
        },
        {
          role: "user",
          content: JSON.stringify({
            language: input.language,
            playerProfile: input.profile,
            question: input.question,
            evidence,
            instruction:
              "Return a concise answer in the requested language. Treat demo_hypothesis and community_speculation as explicitly uncertain.",
          }),
        },
      ],
    });
    return completion.choices[0]?.message.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export function buildHints(language: Language): [string, string, string] {
  return language === "zh-CN"
    ? [
        "先别急着按机关：观察附近可交互物的颜色、朝向和运动节奏。",
        "把机关当成一个顺序系统：先找能改变能量状态的节点，再看哪些装置会同步响应。",
        "完整思路：从离入口最近的能量节点开始，按视觉连线依次激活；每次操作后等待运动部件归位，再处理下一组。",
      ]
    : [
        "Before touching the mechanism, inspect nearby interactables, colors, directions, and movement rhythm.",
        "Treat it as a sequence system: find the node that changes energy state, then watch which devices respond together.",
        "Full approach: start with the energy node nearest the entrance, activate along the visible connection order, and let each moving part settle before the next step.",
      ];
}
