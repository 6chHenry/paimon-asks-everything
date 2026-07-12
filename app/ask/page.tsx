"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  CircleAlert,
  LoaderCircle,
  Send,
  Stars,
} from "lucide-react";
import { AnswerCard } from "@/components/answer-card";
import { usePreferences } from "@/components/preferences-provider";
import { TraceTimeline } from "@/components/trace-timeline";
import { questionSuggestionTopics } from "@/data/question-suggestion-topics";
import { clientPath } from "@/lib/client-path";
import type {
  ChatResult,
  Progress,
  QuestionSuggestionResult,
} from "@/lib/domain";
import { labels, t } from "@/lib/i18n";
import type { TraceEvent } from "@/lib/trace";

const selectableRegions: Exclude<Progress, "unknown">[] = [
  "mondstadt",
  "liyue",
  "inazuma",
  "sumeru",
  "fontaine",
  "natlan",
  "nodkrai",
  "snezhnaya",
];

const regionEmblemSources: Record<Exclude<Progress, "unknown">, string> = {
  mondstadt:
    "https://static.wikia.nocookie.net/gensin-impact/images/9/99/Emblem_Mondstadt_White.png/revision/latest?cb=20220301033214",
  liyue:
    "https://static.wikia.nocookie.net/gensin-impact/images/4/49/Emblem_Liyue_White.png/revision/latest?cb=20220301033230",
  inazuma:
    "https://static.wikia.nocookie.net/gensin-impact/images/5/51/Emblem_Inazuma_White.png/revision/latest?cb=20220301030931",
  sumeru:
    "https://static.wikia.nocookie.net/gensin-impact/images/6/6a/Emblem_Sumeru_White.png/revision/latest?cb=20220718184158",
  fontaine:
    "https://static.wikia.nocookie.net/gensin-impact/images/7/7b/Emblem_Fontaine_White.png/revision/latest?cb=20230807032406",
  natlan:
    "https://static.wikia.nocookie.net/gensin-impact/images/1/10/Emblem_Natlan_White.png/revision/latest?cb=20240828024938",
  nodkrai:
    "https://static.wikia.nocookie.net/gensin-impact/images/6/62/Emblem_Nod-Krai_White.png/revision/latest?cb=20250912003225",
  snezhnaya:
    "https://static.wikia.nocookie.net/gensin-impact/images/5/5a/Emblem_Snezhnaya.png/revision/latest?cb=20260429032726",
};

function fallbackForTopic(topicId: string, language: "zh-CN" | "en") {
  const topic =
    questionSuggestionTopics.find((item) => item.id === topicId) ??
    questionSuggestionTopics[0]!;
  return {
    topicId: topic.id,
    questions: [...topic.fallbackQuestions[language]],
    source: "fallback",
  } satisfies QuestionSuggestionResult;
}

export default function AskPage() {
  const { preferences, sessionId } = usePreferences();
  const language = preferences.language;
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [result, setResult] = useState<ChatResult | null>(null);
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [traceCollapsed, setTraceCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [error, setError] = useState("");
  const [sourceTopicId, setSourceTopicId] = useState("");
  const [sourceTimelineNodeId, setSourceTimelineNodeId] = useState("");
  const [region, setRegion] = useState<Exclude<Progress, "unknown">>(
    "mondstadt",
  );
  const [suggestionTopicId, setSuggestionTopicId] = useState(
    questionSuggestionTopics[0]!.id,
  );
  const [suggestionState, setSuggestionState] =
    useState<QuestionSuggestionResult>(() =>
      fallbackForTopic(questionSuggestionTopics[0]!.id, "zh-CN"),
    );
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeAskRegion, setActiveAskRegion] = useState<
    Exclude<Progress, "unknown"> | null
  >(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const topicsForRegion = questionSuggestionTopics.filter(
    (item) => item.region === region,
  );
  const selectedSuggestionTopic =
    topicsForRegion.find((item) => item.id === suggestionTopicId) ??
    topicsForRegion[0]!;
  const askRegionIcon = activeAskRegion
    ? regionEmblemSources[activeAskRegion]
    : "/compass-mark.svg";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuestion = params.get("question");
    if (initialQuestion) setQuestion(initialQuestion);
    setSourceTopicId(params.get("topicId") ?? "");
    setSourceTimelineNodeId(params.get("timelineNodeId") ?? "");
  }, []);

  useEffect(
    () => () => {
      activeRequestRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    setSuggestionState(fallbackForTopic(suggestionTopicId, language));
  }, [language, suggestionTopicId]);

  function selectSuggestionRegion(nextRegion: Exclude<Progress, "unknown">) {
    const nextTopic = questionSuggestionTopics.find(
      (item) => item.region === nextRegion,
    );
    if (!nextTopic) return;
    setRegion(nextRegion);
    setSuggestionTopicId(nextTopic.id);
    setSuggestionState(fallbackForTopic(nextTopic.id, language));
  }

  async function generateSuggestions() {
    setSuggestionsLoading(true);
    try {
      const response = await fetch(clientPath("/api/question-suggestions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: selectedSuggestionTopic.id,
          language,
          profile: preferences.profile,
          progress: preferences.progress,
          spoilerPreference: preferences.spoilerPreference,
          focus: preferences.focus,
        }),
      });
      const payload: unknown = await response.json();
      if (
        !response.ok ||
        !payload ||
        typeof payload !== "object" ||
        !Array.isArray((payload as QuestionSuggestionResult).questions) ||
        (payload as QuestionSuggestionResult).topicId !== selectedSuggestionTopic.id ||
        (payload as QuestionSuggestionResult).questions.length < 4 ||
        (payload as QuestionSuggestionResult).questions.length > 5 ||
        !(payload as QuestionSuggestionResult).questions.every(
          (item) => typeof item === "string",
        )
      ) {
        throw new Error("invalid_suggestions");
      }
      setSuggestionState(payload as QuestionSuggestionResult);
    } catch {
      setSuggestionState(fallbackForTopic(selectedSuggestionTopic.id, language));
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function submitStreamingRequest(
    text: string,
    controller: AbortController,
    confirmationToken?: string,
  ) {
    const response = await fetch(clientPath("/api/chat/stream"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: text,
        ...preferences,
        sessionId,
        ...(confirmationToken ? { confirmationToken } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error("stream_failed");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    function consumeBlock(block: string) {
      const eventLine = block
        .split("\n")
        .find((line) => line.startsWith("event: "));
      const dataLines = block
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6));
      if (!eventLine || !dataLines.length) return;
      const eventName = eventLine.slice(7).trim();
      const payload = JSON.parse(dataLines.join("\n")) as unknown;
      if (eventName === "trace") {
        setTraceEvents((current) => [...current, payload as TraceEvent].slice(-18));
      }
      if (eventName === "answer" || eventName === "result") {
        setResult(payload as ChatResult);
        setTraceCollapsed(true);
        setLoading(false);
        setResourcesLoading(eventName === "answer");
        setQuestion("");
      }
      if (eventName === "resources") {
        setResult((current) =>
          current
            ? {
                ...current,
                readingRecommendations:
                  payload as ChatResult["readingRecommendations"],
              }
            : current,
        );
        setResourcesLoading(false);
      }
      if (eventName === "done") {
        setResourcesLoading(false);
      }
      if (eventName === "error") {
        throw new Error("stream_event_error");
      }
    }

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) consumeBlock(block);
    }
    if (buffer.trim()) consumeBlock(buffer);
  }

  async function submitQuestion(
    text: string,
    confirmationToken?: string,
    askedRegion?: Exclude<Progress, "unknown">,
  ) {
    if (!text.trim()) return;
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setLoading(true);
    setResourcesLoading(false);
    setError("");
    if (!confirmationToken) {
      setActiveAskRegion(askedRegion ?? null);
      setResult(null);
      setTraceEvents([]);
      setTraceCollapsed(false);
      setLastQuestion(text);
    } else {
      setResult(null);
      setTraceCollapsed(false);
    }
    try {
      await submitStreamingRequest(text, controller, confirmationToken);
      setQuestion("");
    } catch (requestError) {
      if (
        requestError instanceof DOMException &&
        requestError.name === "AbortError"
      ) {
        return;
      }
      setError(
        t(
          language,
          "哎呀，连接断了。再试一次吧！这次问题没有保存。",
          "Oops, the connection dropped. Try again — this question was not saved.",
        ),
      );
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitQuestion(question);
  }

  return (
    <div className="ask-page page-wrap">
      <section className="ask-intro">
        <div>
          <span className="eyebrow">
            {activeAskRegion ? (
              <img
                className="ask-intro-region-emblem"
                src={regionEmblemSources[activeAskRegion]}
                alt=""
              />
            ) : (
              <Stars size={14} />
            )}
            {t(language, "有问题就问派蒙！", "Ask Paimon!")}
          </span>
          <h1>{t(language, "旅行者，哪里没看懂？", "What’s confusing, Traveler?")}</h1>
        </div>
      </section>

      {sourceTopicId ? (
        <div className="ask-source-context">
          <div>
            <span>{t(language, "来自预热主题", "From preheat topic")}</span>
            <strong>{sourceTopicId.replaceAll("-", " ")}</strong>
            {sourceTimelineNodeId ? <small>{sourceTimelineNodeId.replaceAll("-", " ")}</small> : null}
          </div>
          <a href={clientPath(`/preheat?topicId=${encodeURIComponent(sourceTopicId)}&depth=guided`)}>
            <ArrowLeft size={14} />
            {t(language, "返回事件链", "Back to event chain")}
          </a>
        </div>
      ) : null}

      <div className="ask-layout">
        <section
          className={`conversation-panel${
            activeAskRegion ? ` ask-context-${activeAskRegion}` : ""
          }`}
        >
          {activeAskRegion ? (
            <div className="ask-region-context">
              <img className="ask-context-emblem" src={askRegionIcon} alt="" />
              <span>
                {t(
                  language,
                  `派蒙翻出了「${labels.progress[activeAskRegion][language]}」的旅行笔记`,
                  `Paimon opened the ${labels.progress[activeAskRegion][language]} travel notes`,
                )}
              </span>
            </div>
          ) : null}
          {!result && !loading ? (
            <div className="empty-conversation">
              <img src={askRegionIcon} alt="" />
              <h2>{t(language, "派蒙在这儿！", "Paimon’s here!")}</h2>
              <p>{t(language, "选一个问题，或者直接问吧。", "Pick a question, or ask your own.")}</p>
            </div>
          ) : null}
          {loading ? (
            traceEvents.length ? null : (
              <div className="loading-card" role="status">
                <LoaderCircle className="spin" size={28} />
                <div>
                  <strong>{t(language, "派蒙正在查资料！", "Paimon is checking!")}</strong>
                </div>
              </div>
            )
          ) : null}
          <TraceTimeline
            events={traceEvents}
            language={language}
            collapsed={traceCollapsed}
          />
          {error ? (
            <div className="error-card"><CircleAlert size={20} /><span>{error}</span></div>
          ) : null}
          {result ? (
            <AnswerCard
              result={result}
              language={language}
              onConfirmSpoiler={() =>
                result.confirmationToken
                  ? void submitQuestion(lastQuestion, result.confirmationToken)
                  : undefined
              }
            />
          ) : null}
          {result && resourcesLoading ? (
            <div className="resource-loading" role="status">
              <LoaderCircle className="spin" size={16} />
              <span>
                {t(
                  language,
                  "派蒙还在整理相关资料……",
                  "Paimon is still organizing related resources…",
                )}
              </span>
            </div>
          ) : null}

          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t(language, "旅行者，想问什么？", "What do you want to ask, Traveler?")}
              rows={3}
              maxLength={800}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!loading) void submitQuestion(question);
                }
              }}
            />
            <div className="composer-meta">
              <span>
                {preferences.allowQuestionTextStorage
                  ? t(language, "原始问题：已授权保存", "Question text: consented")
                  : t(language, "原始问题：不保存", "Question text: not stored")}
              </span>
              <span>{question.length}/800</span>
              <button type="submit" disabled={loading || question.trim().length < 2}>
                <Send size={17} />
                {t(language, "发送", "Send")}
              </button>
            </div>
          </form>
        </section>

        <aside className="suggestions-panel">
          <div className="aside-heading">
            <span>FIELD NOTES</span>
            <h2>{t(language, "不知道问什么？", "Need an idea?")}</h2>
          </div>
          <div className="suggestion-controls">
            <section className="suggestion-choice-group" aria-label={t(language, "选择地区", "Choose a region")}>
              <span className="suggestion-choice-label">
                {t(language, "选择地区", "Choose a region")}
              </span>
              <div className="suggestion-chip-grid suggestion-region-grid">
                {selectableRegions.map((item) => {
                  return (
                    <button
                      className={`region-button region-${item}${
                        item === region ? " is-selected" : ""
                      }`}
                      type="button"
                      key={item}
                      aria-pressed={item === region}
                      onClick={() => selectSuggestionRegion(item)}
                    >
                      <span>{labels.progress[item][language]}</span>
                      <img
                        className="region-button-emblem"
                        src={regionEmblemSources[item]}
                        alt=""
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </section>
            <section
              className={`suggestion-choice-group suggestion-topic-stage topic-region-${region}`}
              aria-label={t(language, "选择剧情专题", "Choose a story topic")}
            >
              <span className="suggestion-choice-label">
                {t(language, "选择剧情专题", "Choose a story topic")}
              </span>
              <div className="suggestion-chip-grid suggestion-topic-grid">
                {topicsForRegion.map((item) => (
                  <button
                    className={
                      item.id === selectedSuggestionTopic.id
                        ? "is-selected"
                        : undefined
                    }
                    type="button"
                    key={item.id}
                    aria-pressed={item.id === selectedSuggestionTopic.id}
                    onClick={() => setSuggestionTopicId(item.id)}
                  >
                    {item.title[language]}
                  </button>
                ))}
              </div>
            </section>
            <button
              className="suggestion-generate"
              type="button"
              onClick={() => void generateSuggestions()}
              disabled={suggestionsLoading}
            >
              {suggestionsLoading ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Stars size={15} />
              )}
              {t(language, "让派蒙想几个问题", "Let Paimon suggest questions")}
            </button>
          </div>
          <div className="suggestion-status" role="status" aria-live="polite">
            {suggestionsLoading
              ? t(language, "派蒙正在整理问题…", "Paimon is preparing questions…")
              : suggestionState.source === "fallback"
                ? t(language, "派蒙准备的参考问题", "Paimon's prepared prompts")
                : t(language, "派蒙刚想到的问题", "Paimon's fresh prompts")}
          </div>
          <div className="suggestion-list">
            {suggestionState.questions.map((item, index) => (
              <button
                type="button"
                key={item}
                onClick={() => {
                  setQuestion(item);
                  void submitQuestion(item, undefined, region);
                }}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
                <ArrowUp size={16} />
              </button>
            ))}
          </div>
          <div className="privacy-note">
            <strong>{t(language, "隐私提示", "Privacy")}</strong>
            <p>{t(language, "只记录匿名分类；不记录账号、UID 或完整会话。", "Only anonymous categories are recorded — never accounts, UID, or full chats.")}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
