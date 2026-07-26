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
    title: "旧结论及时更新",
    question: "桑多涅和阿兰的关系",
    tags: ["已实装剧情", "创造关系", "结论更新"],
    checks: [
      "只采用当前已实装剧情证据，不能把未实装内容当作事实",
      "明确阿兰与桑多涅的创造者/造物关系，不能混淆两者身份",
      "拒绝“阿兰就是桑多涅”等旧有推测性表述，并说明证据边界",
    ],
    overrides: {
      focus: ["story", "character"],
      progress: "fontaine",
      spoilerPreference: "full",
    },
  },
  {
    id: "sumeru-spoiler-sensitive",
    title: "剧透敏感",
    question: "我刚到须弥城，大慈树王是谁？",
    tags: ["剧透门槛", "须弥", "玩家进度"],
    checks: [
      "先按稻妻进度识别尚未完成须弥主线，不能直接揭示后续真相",
      "给出不剧透的引导与继续推进建议，不能用模糊话术绕过剧透限制",
      "明确需要玩家确认后才能展开，不能默认输出完整剧情答案",
    ],
    overrides: {
      progress: "inazuma",
      spoilerPreference: "none",
    },
  },
  {
    id: "sumeru-story-state",
    title: "剧情状态变化",
    question: "为什么我做完须弥主线后，资料里没人记得大慈树王？",
    tags: ["剧情状态", "须弥", "完整剧透"],
    checks: [
      "按已完成须弥主线提供完整解释，不能仍把玩家当作未解锁状态",
      "说明游戏内资料与剧情状态变化的关系，不能把设定矛盾误报为资料错误",
      "区分主线事实与延伸解读，不能把社区猜测补成官方结论",
    ],
    overrides: {
      progress: "sumeru",
      spoilerPreference: "full",
    },
  },
  {
    id: "signora-premise-correction",
    title: "错误前提纠正",
    question: "女士是旅行者杀死的吗？",
    tags: ["前提纠正", "稻妻", "剧情事实"],
    checks: [
      "先纠正“旅行者杀死女士”的错误前提，不能顺着错误设问编造因果",
      "准确区分御前决斗与雷电将军执行处决，不能抹去关键剧情角色",
      "引用可核验的剧情证据，不能用玩家二创或情绪化概括替代事实",
    ],
    overrides: {
      progress: "inazuma",
      spoilerPreference: "full",
    },
  },
  {
    id: "paimon-official-status",
    title: "暂无官方结论",
    question: "派蒙的真实身份已经官方确认了吗？",
    tags: ["官方边界", "身份推测", "结论校准"],
    checks: [
      "明确说明当前暂无官方确认，不能把流行推测包装成既定设定",
      "可列出已知线索与未解部分，不能用线索强度替代官方结论",
      "标注证据来源层级，不能以 Wiki 或社区讨论作为官方确认依据",
    ],
    overrides: {
      progress: "nodkrai",
      spoilerPreference: "full",
    },
  },
  {
    id: "live-wish-timeliness",
    title: "版本时效性",
    question: "现在的角色活动祈愿是谁，什么时候结束？",
    tags: ["实时信息", "祈愿公告", "版本时效"],
    checks: [
      "显示查询日期与服务器时区，不能把无日期的旧版本信息当作当前状态",
      "必须实时联网检索当前有效的官方祈愿公告，不能依赖缓存、本地静态或训练知识",
      "给出活动结束时间及其适用服务器，无法核验时不能编造实时答案",
    ],
    overrides: {
      progress: "nodkrai",
      spoilerPreference: "none",
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
