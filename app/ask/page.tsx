"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, CircleAlert, LoaderCircle, Send, Stars } from "lucide-react";
import { AnswerCard } from "@/components/answer-card";
import { usePreferences } from "@/components/preferences-provider";
import { TraceTimeline } from "@/components/trace-timeline";
import { clientPath } from "@/lib/client-path";
import type { ChatResult } from "@/lib/domain";
import { t } from "@/lib/i18n";
import { suggestedQuestions } from "@/lib/suggested-questions";
import type { TraceEvent } from "@/lib/trace";

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
  const activeRequestRef = useRef<AbortController | null>(null);

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
  ) {
    if (!text.trim()) return;
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setLoading(true);
    setResourcesLoading(false);
    setError("");
    if (!confirmationToken) {
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
          <span className="eyebrow"><Stars size={14} />{t(language, "有问题就问派蒙！", "Ask Paimon!")}</span>
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
        <section className="conversation-panel">
          {!result && !loading ? (
            <div className="empty-conversation">
              <img src="/compass-mark.svg" alt="" />
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
          <div className="suggestion-list">
            {suggestedQuestions[language].map((item, index) => (
              <button
                type="button"
                key={item}
                onClick={() => {
                  setQuestion(item);
                  void submitQuestion(item);
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
