import { randomUUID } from "node:crypto";
import {
  classifyQuestion,
  isHighRiskSpoilerQuestion,
} from "@/lib/classification";
import type {
  ChatResult,
  Citation,
  Claim,
  KnowledgeEntry,
  QuestionEvent,
} from "@/lib/domain";
import { recordEvent } from "@/lib/event-store";
import { searchWhitelistedWiki } from "@/lib/external-search";
import { buildHints, generateGroundedAnswer } from "@/lib/generation";
import { t } from "@/lib/i18n";
import { retrieveControlled } from "@/lib/retrieval";
import type { ChatRequest } from "@/lib/schemas";
import { createSpoilerToken } from "@/lib/spoiler-token";

const prohibitedTerms = [
  "外挂",
  "自动跑图",
  "自动脚本",
  "代练",
  "账号交易",
  "cheat",
  "bot script",
  "account trading",
  "play for me",
];

function isProhibited(question: string) {
  const normalized = question.toLowerCase();
  return prohibitedTerms.some((term) => normalized.includes(term));
}

function toCitations(
  entries: Array<KnowledgeEntry & { crossLanguage?: boolean }>,
): Citation[] {
  return entries.map((entry, index) => ({
    id: `source-${index + 1}`,
    title: entry.title,
    url: entry.source.url,
    sourceName: entry.source.sourceName,
    sourceKind: entry.source.sourceKind,
    factStatus: entry.factStatus,
    excerpt: entry.content,
    external: false,
    crossLanguage: Boolean(entry.crossLanguage),
  }));
}

function toClaims(entries: KnowledgeEntry[], citations: Citation[]): Claim[] {
  return entries.slice(0, 3).map((entry, index) => ({
    text: entry.summary,
    citationIds: citations[index] ? [citations[index].id] : [],
    factStatus: entry.factStatus,
  }));
}

async function persistResult(
  request: ChatRequest,
  result: ChatResult,
): Promise<ChatResult> {
  const eventId = randomUUID();
  const event: QuestionEvent = {
    id: eventId,
    occurredAt: new Date().toISOString(),
    language: request.language,
    playerProfile: request.profile,
    questionCategory: result.eventClassification.questionCategory,
    confusionTopic: result.eventClassification.confusionTopic,
    spoilerGateTriggered: result.spoilerAction === "confirmation_required",
    usedExternalSearch: result.usedExternalSources,
    responseStatus: result.status,
    sourceKind: "live_increment",
    questionText: request.allowQuestionTextStorage
      ? request.question
      : undefined,
    textConsent: request.allowQuestionTextStorage,
  };
  try {
    await recordEvent(event);
    return { ...result, eventRecorded: true, eventId };
  } catch {
    return { ...result, eventRecorded: false };
  }
}

export async function runAgent(
  request: ChatRequest,
  options: { confirmedHighRisk?: boolean; recordEvent?: boolean } = {},
): Promise<ChatResult> {
  const finish = (result: ChatResult) =>
    options.recordEvent === false
      ? Promise.resolve(result)
      : persistResult(request, result);
  const eventClassification = classifyQuestion(
    request.question,
    request.language,
  );

  if (isProhibited(request.question)) {
    return finish({
      status: "refused",
      answer: t(
        request.language,
        "这类外挂、自动化或账号交易请求我不能协助。不过如果你是在某个机制或路线卡住，我可以提供不替你操作的分层解释。",
        "I can’t help with cheats, automation, or account trading. If you are stuck on a mechanic or route, I can still offer layered guidance without playing for you.",
      ),
      language: request.language,
      answerMode: "safe_refusal",
      claims: [],
      citations: [],
      spoilerAction: "none",
      usedExternalSources: false,
      confidence: "high",
      eventClassification,
      eventRecorded: false,
    });
  }

  const retrieval = retrieveControlled({
    question: request.question,
    language: request.language,
    progress: request.progress,
    spoilerPreference: request.spoilerPreference,
    focus: request.focus,
    allowHighRisk: options.confirmedHighRisk,
  });

  if (
    !options.confirmedHighRisk &&
    isHighRiskSpoilerQuestion(request.question) &&
    retrieval.blockedHighRisk.length
  ) {
    return finish({
      status: "spoiler_confirmation_required",
      answer: "",
      language: request.language,
      answerMode: "limited_answer",
      claims: [],
      citations: [],
      spoilerAction: "confirmation_required",
      usedExternalSources: false,
      confidence: "high",
      eventClassification,
      eventRecorded: false,
      confirmationToken: createSpoilerToken(request.question),
      reason: t(
        request.language,
        "这个问题会触及关键身份推测或反转。即使你选择了完整解释，我也只为当前问题请求一次确认。",
        "This question touches a major identity theory or twist. Even with full context enabled, I need one-time confirmation for this question.",
      ),
    });
  }

  let entries = retrieval.entries;
  let external: Citation[] = [];
  if (retrieval.topScore < 3) {
    try {
      external = await searchWhitelistedWiki(
        request.question,
        request.language,
      );
    } catch {
      external = [];
    }
  }

  if (!entries.length && !external.length) {
    return finish({
      status: "insufficient_evidence",
      answer: t(
        request.language,
        "我暂时找不到足够可靠的受控证据，白名单外部搜索也没有返回可核对结果。与其用记忆补成一个确定结论，我更愿意明确停在这里。",
        "I could not find enough controlled evidence, and the whitelisted external search returned nothing verifiable. Rather than fill the gap from memory, I’m stopping at that boundary.",
      ),
      language: request.language,
      answerMode: "limited_answer",
      claims: [],
      citations: [],
      spoilerAction: "filtered",
      usedExternalSources: true,
      confidence: "low",
      eventClassification,
      eventRecorded: false,
    });
  }

  if (external.length && retrieval.topScore < 3) entries = [];
  const citations = entries.length ? toCitations(entries) : external;
  const answer = await generateGroundedAnswer({
    question: request.question,
    language: request.language,
    profile: request.profile,
    entries,
    external,
  });
  const isGameplay = eventClassification.questionCategory === "gameplay";

  return finish({
    status: "answered",
    answer,
    language: request.language,
    answerMode: isGameplay
      ? "layered_hint"
      : request.profile === "returning"
        ? "minimal_catch_up"
        : "evidence_answer",
    claims: entries.length ? toClaims(entries, citations) : [],
    citations,
    spoilerAction: options.confirmedHighRisk
      ? "confirmed"
      : retrieval.blockedHighRisk.length
        ? "filtered"
        : "none",
    usedExternalSources: external.length > 0,
    confidence: entries.length
      ? retrieval.topScore >= 6
        ? "high"
        : "medium"
      : "low",
    eventClassification,
    eventRecorded: false,
    hints: isGameplay ? buildHints(request.language) : undefined,
  });
}
