"use client";

import { useEffect, useRef, useState } from "react";
import {
  CircleAlert,
  Gauge,
  LoaderCircle,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AnswerCard } from "@/components/answer-card";
import { usePreferences } from "@/components/preferences-provider";
import { TraceTimeline } from "@/components/trace-timeline";
import { clientPath } from "@/lib/client-path";
import type { ChatResult, Preferences } from "@/lib/domain";
import type { TraceEvent } from "@/lib/trace";

interface PreviewCase {
  id: string;
  title: string;
  question: string;
  tags: string[];
  checks: string[];
  overrides?: Partial<Preferences>;
}

const previewCases: PreviewCase[] = [
  {
    id: "skirk-origin",
    title: "身份判断与弱证据过滤",
    question: "丝柯克是外星人吗",
    tags: ["实体锚定", "证据过滤", "中文回答"],
    checks: [
      "不把 Wiki 首页或技能描述当作答案",
      "区分可信资料与是否能证明“外星人”这个判断",
      "来源角标能对应下方资料",
    ],
    overrides: {
      focus: ["story", "character"],
      progress: "fontaine",
      spoilerPreference: "low",
    },
  },
  {
    id: "raiden-relation",
    title: "同名/近名关系防跑题",
    question: "雷电将军和雷电影的关系",
    tags: ["关系问题", "防跑题", "双实体"],
    checks: [
      "搜索词保留雷电将军和雷电影",
      "答案不能漂移到桑多涅/阿兰",
      "能直接说明人偶与本体关系",
    ],
    overrides: {
      focus: ["story", "character"],
      progress: "inazuma",
      spoilerPreference: "low",
    },
  },
  {
    id: "signora-death",
    title: "明确剧情事实命中",
    question: "女士为什么死在稻妻了",
    tags: ["剧情事实", "Wiki 检索", "置信度"],
    checks: [
      "能命中御前决斗/处决相关资料",
      "不会把社区猜测当成主要依据",
      "回答先给结论，再补证据边界",
    ],
    overrides: {
      focus: ["story", "character"],
      progress: "inazuma",
      spoilerPreference: "full",
    },
  },
  {
    id: "sandrone-alain",
    title: "长尾关系检索",
    question: "桑多涅和阿兰的关系",
    tags: ["长尾考据", "关系实体", "来源治理"],
    checks: [
      "检索计划不只搜桑多涅单页",
      "回答不能偷懒让用户自己读来源",
      "能说明资料支持到什么程度",
    ],
    overrides: {
      focus: ["story", "character"],
      progress: "fontaine",
      spoilerPreference: "full",
    },
  },
  {
    id: "varka-story-quest",
    title: "中文传说任务检索",
    question: "法尔伽传说任务故事梗概",
    tags: ["传说任务", "中文 Wiki", "来源治理"],
    checks: [
      "主要资料命中《天狼之章》或《致予远征之人》",
      "最终引用不出现英文 Wiki、个人视频或社区推测",
      "使用中文给出基于任务文本的剧情梗概",
    ],
    overrides: {
      focus: ["story", "character"],
      progress: "nodkrai",
      spoilerPreference: "full",
    },
  },
  {
    id: "english-answer",
    title: "英文输入英文回答",
    question: "Who is Skirk and where is she from?",
    tags: ["English", "language lock", "citation"],
    checks: [
      "Answer body stays in English",
      "No mixed Chinese prose unless it is a source title",
      "Citations still render as compact notes",
    ],
    overrides: {
      language: "en",
      focus: ["story", "character"],
      progress: "fontaine",
      spoilerPreference: "low",
    },
  },
];

function mergePreferences(base: Preferences, item?: PreviewCase) {
  return {
    ...base,
    ...(item?.overrides ?? {}),
  };
}

export default function PreviewPage() {
  const { preferences, sessionId } = usePreferences();
  const [activeId, setActiveId] = useState(previewCases[0]!.id);
  const activeCase =
    previewCases.find((item) => item.id === activeId) ?? previewCases[0]!;
  const [customQuestion, setCustomQuestion] = useState(activeCase.question);
  const [result, setResult] = useState<ChatResult | null>(null);
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [traceCollapsed, setTraceCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [error, setError] = useState("");
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setCustomQuestion(activeCase.question);
  }, [activeCase.question]);

  useEffect(
    () => () => {
      activeRequestRef.current?.abort();
    },
    [],
  );

  async function submitQuestion(
    question: string,
    item = activeCase,
    confirmationToken?: string,
  ) {
    if (!question.trim()) return;
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setLoading(true);
    setResourcesLoading(false);
    setError("");
    setResult(null);
    setTraceCollapsed(false);
    if (!confirmationToken) {
      setTraceEvents([]);
    }

    try {
      const response = await fetch(clientPath("/api/chat/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          ...mergePreferences(preferences, item),
          question,
          sessionId,
          ...(confirmationToken ? { confirmationToken } : {}),
        }),
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
          setTraceEvents((current) => [
            ...current,
            payload as TraceEvent,
          ].slice(-24));
        }
        if (eventName === "answer" || eventName === "result") {
          setResult(payload as ChatResult);
          setTraceCollapsed(true);
          setLoading(false);
          setResourcesLoading(eventName === "answer");
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
        if (eventName === "done") setResourcesLoading(false);
        if (eventName === "error") throw new Error("stream_event_error");
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
    } catch (requestError) {
      if (
        requestError instanceof DOMException &&
        requestError.name === "AbortError"
      ) {
        return;
      }
      setError("预览请求失败：请检查本地 dev server、API key 和网络环境。");
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  function reset() {
    activeRequestRef.current?.abort();
    setResult(null);
    setTraceEvents([]);
    setTraceCollapsed(false);
    setLoading(false);
    setResourcesLoading(false);
    setError("");
    setCustomQuestion(activeCase.question);
  }

  const activePreferences = mergePreferences(preferences, activeCase);

  return (
    <div className="preview-page page-wrap">
      <section className="preview-hero">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} />
            CAPABILITY PREVIEW
          </span>
          <h1>问派蒙能力验收台</h1>
          <p>
            用固定问题快速检查实体识别、联网检索、来源治理、引用渲染和流式体验。
          </p>
        </div>
        <div className="preview-status">
          <Gauge size={18} />
          <span>当前预设</span>
          <strong>
            {activePreferences.language} · {activePreferences.progress} ·{" "}
            {activePreferences.spoilerPreference}
          </strong>
        </div>
      </section>

      <div className="preview-layout">
        <aside className="preview-case-panel">
          <div className="preview-panel-heading">
            <span>TEST SET</span>
            <h2>测试问题</h2>
          </div>
          <div className="preview-case-list">
            {previewCases.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={item.id === activeId ? "active" : undefined}
                onClick={() => {
                  setActiveId(item.id);
                  setResult(null);
                  setTraceEvents([]);
                  setTraceCollapsed(false);
                  setError("");
                }}
              >
                <small>{String(index + 1).padStart(2, "0")}</small>
                <span>
                  <strong>{item.title}</strong>
                  <em>{item.question}</em>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="preview-runner">
          <div className="preview-question-card">
            <div className="preview-case-meta">
              <div>
                <span>{activeCase.title}</span>
                <h2>{activeCase.question}</h2>
              </div>
              <div className="preview-tags">
                {activeCase.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>

            <label className="preview-custom-question">
              <span>本次测试问题</span>
              <textarea
                value={customQuestion}
                onChange={(event) => setCustomQuestion(event.target.value)}
                rows={3}
              />
            </label>

            <div className="preview-actions">
              <button
                type="button"
                className="primary-button"
                disabled={loading || customQuestion.trim().length < 2}
                onClick={() => void submitQuestion(customQuestion)}
              >
                {loading ? <LoaderCircle className="spin" size={17} /> : <Play size={17} />}
                运行测试
              </button>
              <button type="button" className="secondary-button" onClick={reset}>
                <RotateCcw size={16} />
                重置
              </button>
            </div>
          </div>

          <div className="preview-checks">
            {activeCase.checks.map((check) => (
              <div key={check}>
                <ShieldCheck size={16} />
                <span>{check}</span>
              </div>
            ))}
          </div>

          {loading && !traceEvents.length ? (
            <div className="loading-card" role="status">
              <LoaderCircle className="spin" size={28} />
              <div>
                <strong>正在发起预览测试</strong>
              </div>
            </div>
          ) : null}

          <TraceTimeline
            events={traceEvents}
            language={activePreferences.language}
            collapsed={traceCollapsed}
          />

          {error ? (
            <div className="error-card">
              <CircleAlert size={20} />
              <span>{error}</span>
            </div>
          ) : null}

          {result ? (
            <AnswerCard
              result={result}
              language={result.language}
              onConfirmSpoiler={() =>
                result.confirmationToken
                  ? void submitQuestion(
                      customQuestion,
                      activeCase,
                      result.confirmationToken,
                    )
                  : undefined
              }
            />
          ) : null}

          {result && resourcesLoading ? (
            <div className="resource-loading" role="status">
              <LoaderCircle className="spin" size={16} />
              <span>答案已返回，延伸资料还在补齐。</span>
            </div>
          ) : null}

          {!result && !loading ? (
            <div className="preview-empty">
              <Send size={22} />
              <strong>选择一个测试问题，然后运行。</strong>
              <span>结果会直接显示在这里，包含 trace、答案、来源和延伸阅读。</span>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
