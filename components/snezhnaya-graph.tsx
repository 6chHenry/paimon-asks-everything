"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  LoaderCircle,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { AnswerCard } from "@/components/answer-card";
import { usePreferences } from "@/components/preferences-provider";
import { TraceTimeline } from "@/components/trace-timeline";
import { clientPath } from "@/lib/client-path";
import type { ChatResult } from "@/lib/domain";
import { t } from "@/lib/i18n";
import {
  buildRelationshipQuestion,
  evidenceTierLabel,
  initialSnezhnayaNodeId,
  localize,
  type SnezhnayaGraphData,
  type SnezhnayaNode,
} from "@/lib/snezhnaya-graph";
import type { TraceEvent } from "@/lib/trace";

function nodeKindLabel(kind: SnezhnayaNode["kind"], language: "zh-CN" | "en") {
  const labels: Record<SnezhnayaNode["kind"], [string, string]> = {
    character: ["人物", "Character"],
    organization: ["组织", "Organization"],
    concept: ["概念", "Concept"],
    event: ["事件", "Event"],
    item: ["物品", "Item"],
    text_clue: ["文本线索", "Text clue"],
  };
  return labels[kind][language === "zh-CN" ? 0 : 1];
}

function sourceTypeLabel(sourceType: string, language: "zh-CN" | "en") {
  const labels: Record<string, [string, string]> = {
    official_video: ["官方视频", "Official video"],
    quest_text: ["剧情文本", "Quest text"],
    weapon_text: ["武器文本", "Weapon text"],
    artifact_text: ["圣遗物文本", "Artifact text"],
    character_story: ["角色故事", "Character story"],
    voice_over: ["角色语音", "Voice-over"],
    wiki_text_index: ["文本索引", "Text index"],
    community_analysis: ["社区分析", "Community analysis"],
  };
  return (labels[sourceType] ?? [sourceType, sourceType])[
    language === "zh-CN" ? 0 : 1
  ];
}

function parseSseBlock(block: string) {
  const event = block.match(/^event:\s*(.+)$/mu)?.[1]?.trim();
  const data = block.match(/^data:\s*(.+)$/mu)?.[1];
  if (!event || !data) return null;
  return { event, data };
}

export function SnezhnayaGraph({ graph }: { graph: SnezhnayaGraphData }) {
  const { preferences } = usePreferences();
  const language = preferences.language;
  const [selectedId, setSelectedId] = useState(initialSnezhnayaNodeId(graph));
  const [relationIds, setRelationIds] = useState<string[]>([]);
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [answer, setAnswer] = useState<ChatResult | null>(null);
  const [loadingRelation, setLoadingRelation] = useState(false);
  const [relationError, setRelationError] = useState("");

  const selectedNode = graph.nodes.find((node) => node.id === selectedId);
  const relationNodes = relationIds
    .map((id) => graph.nodes.find((node) => node.id === id))
    .filter((node): node is SnezhnayaNode => Boolean(node));
  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );

  function toggleRelationNode(node: SnezhnayaNode) {
    setSelectedId(node.id);
    setAnswer(null);
    setRelationError("");
    setTraceEvents([]);
    setRelationIds((current) => {
      if (current.includes(node.id)) {
        return current.filter((id) => id !== node.id);
      }
      return [...current.slice(-1), node.id];
    });
  }

  async function analyzeRelationship() {
    if (relationNodes.length !== 2) return;
    setLoadingRelation(true);
    setRelationError("");
    setAnswer(null);
    setTraceEvents([]);

    const question = buildRelationshipQuestion({
      language,
      left: relationNodes[0],
      right: relationNodes[1],
    });

    try {
      const response = await fetch(clientPath("/api/chat/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          language,
          profile: preferences.profile,
          progress: preferences.progress,
          spoilerPreference: "full",
          focus: ["story", "character"],
          allowQuestionTextStorage: preferences.allowQuestionTextStorage,
          sessionId: `snezhnaya-${Date.now().toString(36)}`,
        }),
      });

      if (!response.ok || !response.body) throw new Error("request_failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const parsed = parseSseBlock(block);
          if (!parsed) continue;
          const payload = JSON.parse(parsed.data);
          if (parsed.event === "trace") {
            setTraceEvents((current) => [...current, payload as TraceEvent]);
          }
          if (parsed.event === "answer") {
            setAnswer(payload as ChatResult);
          }
          if (parsed.event === "error") {
            throw new Error("stream_error");
          }
        }
      }
    } catch {
      setRelationError(
        t(
          language,
          "关系分析暂时失败，请稍后重试。",
          "Relationship analysis failed. Please try again.",
        ),
      );
    } finally {
      setLoadingRelation(false);
    }
  }

  return (
    <section className="snezhnaya-section reveal">
      <div className="snezhnaya-video">
        <div
          className="snezhnaya-video-cover"
          style={{ backgroundImage: `url(${graph.video.coverImageUrl})` }}
        >
          <span className="snezhnaya-video-badge">
            <Sparkles size={15} />
            {t(language, "至冬预热", "Snezhnaya preheat")}
          </span>
        </div>
        <div className="snezhnaya-video-copy">
          <h1>{localize(graph.video.title, language)}</h1>
          <p>{localize(graph.video.description, language)}</p>
          <div className="snezhnaya-video-actions">
            <a href={graph.video.youtubeUrl} target="_blank" rel="noreferrer">
              <Play size={16} />
              YouTube
            </a>
            <a href={graph.video.miyousheUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} />
              {t(language, "米游社", "Miyoushe")}
            </a>
          </div>
        </div>
      </div>

      <div className="snezhnaya-workbench">
        <div className="snezhnaya-map">
          <div className="snezhnaya-map-heading">
            <span>{t(language, "关键词图谱", "Keyword graph")}</span>
            <strong>
              {t(
                language,
                "选择两个节点，问它们之间的关系",
                "Select two nodes and ask how they connect",
              )}
            </strong>
          </div>
          <div className="snezhnaya-node-cloud">
            {graph.nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={[
                  "snezhnaya-node",
                  `kind-${node.kind}`,
                  `tier-${node.tier}`,
                  selectedId === node.id ? "active" : "",
                  relationIds.includes(node.id) ? "selected-for-relation" : "",
                ].join(" ")}
                onClick={() => toggleRelationNode(node)}
              >
                <span>{localize(node.label, language)}</span>
                <small>{nodeKindLabel(node.kind, language)}</small>
              </button>
            ))}
          </div>
          <div className="snezhnaya-relation-bar">
            <div>
              {relationNodes.length ? (
                relationNodes.map((node) => (
                  <span key={node.id}>{localize(node.label, language)}</span>
                ))
              ) : (
                <span>{t(language, "先选择节点", "Select nodes")}</span>
              )}
            </div>
            <button
              type="button"
              disabled={relationNodes.length !== 2 || loadingRelation}
              onClick={analyzeRelationship}
            >
              {loadingRelation ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <ArrowRight size={16} />
              )}
              {t(language, "分析关系", "Analyze relationship")}
            </button>
            <button
              type="button"
              className="snezhnaya-ghost-button"
              aria-label={t(language, "重置关系选择", "Reset relation selection")}
              onClick={() => {
                setRelationIds([]);
                setAnswer(null);
                setRelationError("");
                setTraceEvents([]);
              }}
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        <aside className="snezhnaya-detail">
          {selectedNode ? (
            <>
              <div
                className={[
                  "snezhnaya-detail-heading",
                  selectedNode.imageUrl ? "with-portrait" : "",
                ].join(" ")}
              >
                <div>
                  <span className={`snezhnaya-tier tier-${selectedNode.tier}`}>
                    {evidenceTierLabel(selectedNode.tier, language)}
                  </span>
                  <h2>{localize(selectedNode.label, language)}</h2>
                </div>
                {selectedNode.imageUrl ? (
                  <Image
                    className="snezhnaya-portrait"
                    src={selectedNode.imageUrl}
                    alt={localize(selectedNode.label, language)}
                    width={144}
                    height={144}
                    loading="eager"
                    unoptimized
                  />
                ) : null}
              </div>
              <p>{localize(selectedNode.summary, language)}</p>
              {selectedNode.detail[language].map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <div className="snezhnaya-clues">
                <h3>{t(language, "文本线索", "Text clues")}</h3>
                {selectedNode.clues.map((clue) => (
                  <a
                    key={clue.id}
                    href={clue.url}
                    target={clue.url ? "_blank" : undefined}
                    rel={clue.url ? "noreferrer" : undefined}
                  >
                    <b>{clue.title}</b>
                    <span>
                      {sourceTypeLabel(clue.sourceType, language)} ·{" "}
                      {evidenceTierLabel(clue.tier, language)}
                    </span>
                    <small>{localize(clue.excerpt, language)}</small>
                  </a>
                ))}
              </div>
              <div className="snezhnaya-related">
                <h3>{t(language, "相邻节点", "Related nodes")}</h3>
                {selectedNode.relatedNodeIds.map((id) => {
                  const related = nodeMap.get(id);
                  if (!related) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleRelationNode(related)}
                    >
                      {localize(related.label, language)}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </aside>
      </div>

      {traceEvents.length || loadingRelation ? (
        <TraceTimeline
          events={traceEvents}
          language={language}
          collapsed={Boolean(answer)}
        />
      ) : null}
      {relationError ? <div className="error-card">{relationError}</div> : null}
      {answer ? (
        <AnswerCard
          result={answer}
          language={language}
          onConfirmSpoiler={() => {
            setRelationError(
              t(
                language,
                "首页关系分析默认使用完整剧透上下文，请在问派蒙页继续确认高风险剧透。",
                "Home relationship analysis uses full-spoiler context; continue high-risk confirmation on the Ask page.",
              ),
            );
          }}
        />
      ) : null}
    </section>
  );
}
