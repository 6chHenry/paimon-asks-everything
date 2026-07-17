"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  LayoutGrid,
  LoaderCircle,
  Map as MapIcon,
  Network,
  RotateCcw,
  Snowflake,
  Sparkles,
} from "lucide-react";
import { AnswerCard } from "@/components/answer-card";
import { useDiscoveries } from "@/components/discoveries-provider";
import { usePreferences } from "@/components/preferences-provider";
import { SnezhnayaVideoSlider } from "@/components/snezhnaya-video-slider";
import { TraceTimeline } from "@/components/trace-timeline";
import { clientPath } from "@/lib/client-path";
import type { ChatResult } from "@/lib/domain";
import { t } from "@/lib/i18n";
import {
  SNEZHNAYA_GRAPH_CANVAS,
  buildRelationshipQuestion,
  cleanRelationshipAnswerForDisplay,
  initialSnezhnayaNodeId,
  localize,
  nodeDetailFacts,
  updateRelationshipSelection,
  type SnezhnayaEdge,
  type SnezhnayaGraphData,
  type SnezhnayaNode,
  type SnezhnayaNodeStatus,
} from "@/lib/snezhnaya-graph";
import type { TraceEvent } from "@/lib/trace";

type AtlasView = "constellation" | "seats";

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

function statusShortLabel(
  status: SnezhnayaNodeStatus | undefined,
  language: "zh-CN" | "en",
) {
  const labels: Record<SnezhnayaNodeStatus, [string, string]> = {
    active: ["现役", "Active"],
    former: ["前席", "Former"],
    deceased: ["已故 / 躯体毁损", "Dead / body lost"],
    dormant: ["融合休眠", "Dormant"],
    unknown: ["未公开", "Unknown"],
  };
  if (!status) return "";
  return labels[status][language === "zh-CN" ? 0 : 1];
}

function edgePath(
  edge: SnezhnayaEdge,
  nodeMap: Map<string, SnezhnayaNode>,
) {
  if (edge.path) return edge.path;
  const from = nodeMap.get(edge.from)?.graphPosition;
  const to = nodeMap.get(edge.to)?.graphPosition;
  if (!from || !to) return "";
  const x1 = (from.x / 100) * SNEZHNAYA_GRAPH_CANVAS.width;
  const y1 = (from.y / 100) * SNEZHNAYA_GRAPH_CANVAS.height;
  const x2 = (to.x / 100) * SNEZHNAYA_GRAPH_CANVAS.width;
  const y2 = (to.y / 100) * SNEZHNAYA_GRAPH_CANVAS.height;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const bend =
    edge.tone === "opposition"
      ? -42
      : Math.abs(y2 - y1) < 60
        ? -24
        : x1 === x2
          ? 0
          : x1 < x2
            ? 24
            : -24;
  return `M ${x1} ${y1} Q ${midX + bend} ${midY} ${x2} ${y2}`;
}

function edgeLabelPosition(
  edge: SnezhnayaEdge,
  nodeMap: Map<string, SnezhnayaNode>,
) {
  if (edge.labelPosition) return edge.labelPosition;
  const from = nodeMap.get(edge.from)?.graphPosition;
  const to = nodeMap.get(edge.to)?.graphPosition;
  if (!from || !to) return { x: 0, y: 0, width: 90, height: 24 };
  return {
    x:
      (((from.x + to.x) / 2) / 100) * SNEZHNAYA_GRAPH_CANVAS.width -
      45,
    y:
      (((from.y + to.y) / 2) / 100) * SNEZHNAYA_GRAPH_CANVAS.height -
      (edge.tone === "opposition" ? 30 : 18),
    width: 90,
    height: 24,
  };
}

function parseSseBlock(block: string) {
  const event = block.match(/^event:\s*(.+)$/mu)?.[1]?.trim();
  const data = block.match(/^data:\s*(.+)$/mu)?.[1];
  if (!event || !data) return null;
  return { event, data };
}

export function SnezhnayaGraph({
  graph,
  showVideos = true,
}: {
  graph: SnezhnayaGraphData;
  showVideos?: boolean;
}) {
  const { preferences } = usePreferences();
  const { discoveries, discoverNode } = useDiscoveries();
  const language = preferences.language;
  const [selectedId, setSelectedId] = useState(initialSnezhnayaNodeId(graph));
  const [relationIds, setRelationIds] = useState<string[]>([]);
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [answer, setAnswer] = useState<ChatResult | null>(null);
  const [loadingRelation, setLoadingRelation] = useState(false);
  const [relationError, setRelationError] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState("");
  const [atlasView, setAtlasView] = useState<AtlasView>("constellation");
  const [relationMode, setRelationMode] = useState(false);
  const [sealTaps, setSealTaps] = useState(0);
  const [auroraAwake, setAuroraAwake] = useState(false);
  const [easterMessage, setEasterMessage] = useState("");

  const selectedNode = graph.nodes.find((node) => node.id === selectedId);
  const relationNodes = relationIds
    .map((id) => graph.nodes.find((node) => node.id === id))
    .filter((node): node is SnezhnayaNode => Boolean(node));
  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const seatNodes = useMemo(
    () =>
      graph.nodes
        .filter((node) => node.harbingerRank)
        .sort((left, right) =>
          (left.harbingerRank ?? 99) - (right.harbingerRank ?? 99),
        ),
    [graph.nodes],
  );
  const discoveryCount = Math.min(discoveries.visitedNodeIds.length, 3);

  useEffect(() => {
    if (!detailOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [detailOpen]);

  function selectGraphNode(node: SnezhnayaNode) {
    discoverNode(node.id);
    setSelectedId(node.id);
    setAnswer(null);
    setRelationError("");
    setTraceEvents([]);
  }

  function toggleRelationNode(node: SnezhnayaNode) {
    selectGraphNode(node);
    setRelationIds((current) =>
      updateRelationshipSelection(current, node.id),
    );
  }

  function openNode(node: SnezhnayaNode) {
    if (relationMode) {
      toggleRelationNode(node);
      return;
    }
    selectGraphNode(node);
  }

  function setRelationshipMode(next: boolean) {
    setRelationMode(next);
    setAnswer(null);
    setRelationError("");
    setTraceEvents([]);
    if (!next) setRelationIds([]);
  }

  function touchAtlasSeal() {
    if (auroraAwake) {
      setAuroraAwake(false);
      setSealTaps(0);
      setEasterMessage(
        t(
          language,
          "极光已经收回档案页后。",
          "The aurora slips back behind the archive page.",
        ),
      );
      return;
    }
    const next = sealTaps + 1;
    setSealTaps(next);
    if (next >= 5) {
      setAuroraAwake(true);
      setSealTaps(0);
      setEasterMessage(
        t(
          language,
          "极光协议已开启。派蒙说：这页可不是我偷偷画亮的！",
          "Aurora protocol awake. Paimon says: I definitely did not illuminate this page!",
        ),
      );
      return;
    }
    if (next === 3) {
      setEasterMessage(
        t(
          language,
          "冰纹里传来很轻的回声……",
          "A tiny echo answers from inside the frost seal…",
        ),
      );
    }
  }

  async function analyzeRelationship(targetNodes = relationNodes) {
    if (targetNodes.length !== 2) return;
    setLoadingRelation(true);
    setRelationError("");
    setAnswer(null);
    setTraceEvents([]);
    setRelationIds([targetNodes[0].id, targetNodes[1].id]);

    const question = buildRelationshipQuestion({
      language,
      left: targetNodes[0],
      right: targetNodes[1],
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
            setAnswer(cleanRelationshipAnswerForDisplay(payload as ChatResult));
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
    <section
      className={`snezhnaya-section snezhnaya-intel-section snezhnaya-atlas reveal${
        auroraAwake ? " aurora-awake" : ""
      }`}
    >
      <span className="snezhnaya-atlas-aurora" aria-hidden="true" />
      <header className="snezhnaya-atlas-masthead">
        <div className="snezhnaya-atlas-title">
          <span>SNEZHNAYA ROYAL ATLAS · ISSUE 07</span>
          <h2>{t(language, "至冬皇家地理志", "Royal Atlas of Snezhnaya")}</h2>
          <p>
            {t(
              language,
              "翻阅席位、命运与证据。先浏览档案；需要比较时，再进入关系推演。",
              "Browse seats, fates, and evidence. Enter relationship analysis only when comparison is needed.",
            )}
          </p>
        </div>
        <div className="snezhnaya-atlas-actions">
          <div className="snezhnaya-atlas-tabs" role="tablist" aria-label={t(language, "图谱视图", "Atlas view")}>
            <button
              type="button"
              role="tab"
              aria-selected={atlasView === "constellation"}
              className={atlasView === "constellation" ? "active" : ""}
              onClick={() => setAtlasView("constellation")}
            >
              <MapIcon size={16} aria-hidden="true" />
              {t(language, "星图", "Constellation")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={atlasView === "seats"}
              className={atlasView === "seats" ? "active" : ""}
              onClick={() => setAtlasView("seats")}
            >
              <LayoutGrid size={16} aria-hidden="true" />
              {t(language, "席位册", "Seat archive")}
            </button>
          </div>
          <button
            type="button"
            className={`snezhnaya-relation-mode${relationMode ? " active" : ""}`}
            aria-pressed={relationMode}
            onClick={() => setRelationshipMode(!relationMode)}
          >
            <Network size={16} aria-hidden="true" />
            {relationMode
              ? t(language, "退出推演", "Leave analysis")
              : t(language, "关系推演", "Analyze relations")}
          </button>
          <button
            type="button"
            className="snezhnaya-atlas-seal"
            aria-pressed={auroraAwake}
            aria-label={t(language, "触碰至冬档案印记", "Touch the Snezhnaya archive seal")}
            title={t(language, "这枚冰纹似乎会回应……", "This frost seal seems responsive…")}
            onClick={touchAtlasSeal}
          >
            <Snowflake size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="snezhnaya-atlas-easter-message" aria-live="polite">
          {easterMessage}
        </p>
      </header>
      {showVideos ? (
        <SnezhnayaVideoSlider graph={graph} language={language} />
      ) : null}

      <div className="snezhnaya-workbench">
        <div className="snezhnaya-map snezhnaya-intel-map">
          <div className="snezhnaya-map-heading">
            <span>{t(language, "至冬权力与命运图谱", "Snezhnaya power and fate map")}</span>
            <strong>
              {t(
                language,
                "从女皇的意志，到十一席各自的去向",
                "From the Tsaritsa's will to the fate of every numbered seat",
              )}
            </strong>
          </div>
          <div className="snezhnaya-map-tools">
            <div className="snezhnaya-map-legend">
              {(
                [
                  ["active", "现役", "Active"],
                  ["former", "前席 / 脱离", "Former / departed"],
                  ["deceased", "死亡 / 躯体毁损", "Dead / body lost"],
                  ["dormant", "融合休眠", "Dormant"],
                  ["unknown", "身份未知", "Unknown"],
                ] as const
              ).map(([status, zh, en]) => (
                <span key={status} className={`status-${status}`}>
                  <i />
                  {t(language, zh, en)}
                </span>
              ))}
            </div>
            <div className="snezhnaya-map-pan-hint">
              {t(
                language,
                "窄屏可左右拖动查看完整席位",
                "Drag horizontally on narrow screens to view every seat",
              )}
            </div>
            <div className="snezhnaya-discovery-progress" aria-live="polite">
              <Sparkles size={14} />
              <span>
                {discoveryCount >= 3
                  ? t(language, "派蒙已盖章", "Stamped by Paimon")
                  : t(language, "巡游星图", "Constellation trail")}
              </span>
              <strong>{discoveryCount} / 3</strong>
            </div>
          </div>
          {atlasView === "constellation" ? (
          <div className="snezhnaya-map-viewport" role="tabpanel" aria-label={t(language, "至冬星图", "Snezhnaya constellation map")}>
            <div className="snezhnaya-map-canvas">
              <div className="snezhnaya-map-zone zone-top" aria-hidden="true">
                {t(language, "天理 / 世界秩序", "Heavenly Principles / World Order")}
              </div>
              <div className="snezhnaya-map-zone zone-axis" aria-hidden="true">
                {t(language, "秩序与反叛的边界", "Boundary of order and rebellion")}
              </div>
              <div className="snezhnaya-map-zone zone-bottom" aria-hidden="true">
                {t(language, "至冬 / 愚人众战略档案", "Snezhnaya / Fatui strategic archive")}
              </div>
              <div className="snezhnaya-conflict-rift" aria-hidden="true" />
              <div className="snezhnaya-harbinger-field" aria-hidden="true">
                <span>
                  {t(
                    language,
                    "愚人众十一执行官 · 丑角统括",
                    "Eleven Fatui Harbingers · directed by Pierro",
                  )}
                </span>
              </div>
              <svg
                className={[
                  "snezhnaya-edges",
                  highlightedId ? "has-highlight" : "",
                ].join(" ")}
                viewBox={`0 0 ${SNEZHNAYA_GRAPH_CANVAS.width} ${SNEZHNAYA_GRAPH_CANVAS.height}`}
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="snezhnaya-arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" />
                  </marker>
                  <marker
                    id="snezhnaya-arrow-opposition"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" />
                  </marker>
                </defs>
                {graph.edges.map((edge) => {
                  const labelPosition = edgeLabelPosition(edge, nodeMap);
                  const isHighlighted = highlightedId
                    ? edge.from === highlightedId || edge.to === highlightedId
                    : false;
                  const isDimmed = Boolean(highlightedId && !isHighlighted);
                  return (
                    <g
                      key={edge.id}
                      className={[
                        "snezhnaya-edge-group",
                        `edge-${edge.tone ?? "lore"}`,
                        isHighlighted ? "is-highlighted" : "",
                        isDimmed ? "is-dimmed" : "",
                      ].join(" ")}
                    >
                      <path
                        className="snezhnaya-edge"
                        d={edgePath(edge, nodeMap)}
                        markerEnd={`url(#${
                          edge.tone === "opposition"
                            ? "snezhnaya-arrow-opposition"
                            : "snezhnaya-arrow"
                        })`}
                        markerStart={
                          edge.direction === "bidirectional"
                            ? "url(#snezhnaya-arrow-opposition)"
                            : undefined
                        }
                      />
                      {edge.showLabel ? (
                        <g
                          className="snezhnaya-edge-label"
                          transform={`translate(${labelPosition.x} ${labelPosition.y})`}
                        >
                          <rect
                            className="snezhnaya-edge-label-bg"
                            width={labelPosition.width}
                            height={labelPosition.height}
                            rx="6"
                          />
                          <text
                            x={labelPosition.width / 2}
                            y={labelPosition.height / 2 + 3}
                            textAnchor="middle"
                          >
                            {localize(edge.label, language)}
                          </text>
                        </g>
                      ) : null}
                    </g>
                  );
                })}
              </svg>
              {graph.nodes.map((node) => {
                const position = node.graphPosition;
                const relationIndex = relationMode
                  ? relationIds.indexOf(node.id)
                  : -1;
                const relationSlot =
                  relationIndex >= 0 ? (relationIndex === 0 ? "A" : "B") : "";
                if (!position) return null;
                return (
                  <button
                    key={node.id}
                    type="button"
                    data-node-id={node.id}
                    data-relation-slot={relationSlot || undefined}
                    aria-pressed={relationIndex >= 0}
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                    }}
                    className={[
                      "snezhnaya-node",
                      `group-${node.graphGroup}`,
                      node.status ? `status-${node.status}` : "",
                      selectedId === node.id ? "active" : "",
                      relationIds.includes(node.id)
                        ? "selected-for-relation"
                        : "",
                    ].join(" ")}
                    aria-label={`${localize(node.label, language)}${
                      node.statusLabel
                        ? ` · ${localize(node.statusLabel, language)}`
                        : ""
                    }`}
                    onMouseEnter={() => setHighlightedId(node.id)}
                    onMouseLeave={() => setHighlightedId("")}
                    onFocus={() => setHighlightedId(node.id)}
                    onBlur={() => setHighlightedId("")}
                    onClick={() => openNode(node)}
                  >
                    {relationSlot ? (
                      <small
                        className={`snezhnaya-node-selection-index slot-${relationSlot.toLowerCase()}`}
                        aria-hidden="true"
                      >
                        {relationSlot}
                      </small>
                    ) : null}
                    {node.harbingerRank ? (
                      <small className="snezhnaya-rank">
                        {String(node.harbingerRank).padStart(2, "0")}
                      </small>
                    ) : null}
                    <span>{localize(node.label, language)}</span>
                    <small className="snezhnaya-node-meta">
                      {node.status
                        ? statusShortLabel(node.status, language)
                        : nodeKindLabel(node.kind, language)}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>
          ) : (
            <div className="snezhnaya-seat-archive" role="tabpanel" aria-label={t(language, "执行官席位册", "Harbinger seat archive")}>
              <div className="snezhnaya-seat-archive-heading">
                <span>{t(language, "十一席人物档案", "Eleven-seat character archive")}</span>
                <small>{t(language, "按席位浏览；状态以文字与印记同时标注", "Browse by seat; status is shown with both text and seal")}</small>
              </div>
              <div className="snezhnaya-seat-grid">
                {seatNodes.map((node) => {
                  const relationIndex = relationMode
                    ? relationIds.indexOf(node.id)
                    : -1;
                  return (
                    <button
                      type="button"
                      key={node.id}
                      className={`snezhnaya-seat-card status-${node.status ?? "unknown"}${selectedId === node.id ? " active" : ""}${relationIndex >= 0 ? " selected-for-relation" : ""}`}
                      aria-pressed={relationIndex >= 0}
                      onClick={() => openNode(node)}
                    >
                      <span className="snezhnaya-seat-number">
                        {String(node.harbingerRank).padStart(2, "0")}
                      </span>
                      <span className="snezhnaya-seat-portrait">
                        {node.imageUrl ? (
                          <Image
                            src={node.imageUrl}
                            alt=""
                            width={160}
                            height={188}
                            loading="lazy"
                            unoptimized
                          />
                        ) : (
                          <Snowflake size={28} aria-hidden="true" />
                        )}
                      </span>
                      <span className="snezhnaya-seat-copy">
                        <strong>{localize(node.label, language)}</strong>
                        <small>{statusShortLabel(node.status, language)}</small>
                      </span>
                      {relationIndex >= 0 ? (
                        <b className="snezhnaya-seat-relation-mark">
                          {relationIndex === 0 ? "A" : "B"}
                        </b>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {relationMode ? (
          <div className="snezhnaya-relation-bar snezhnaya-relation-bar-active">
            <div>
              {relationNodes.length ? (
                <>
                  {relationNodes.map((node, index) => (
                    <span
                      key={node.id}
                      className={`snezhnaya-relation-chip slot-${
                        index === 0 ? "a" : "b"
                      }`}
                    >
                      <b>{index === 0 ? "A" : "B"}</b>
                      {localize(node.label, language)}
                    </span>
                  ))}
                  {relationNodes.length === 1 ? (
                    <span className="snezhnaya-relation-prompt">
                      {t(
                        language,
                        "再选择一个节点作为 B",
                        "Select another node as B",
                      )}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="snezhnaya-relation-prompt">
                  {t(
                    language,
                    "点击图中节点选择 A",
                    "Select node A on the map",
                  )}
                </span>
              )}
            </div>
            <button
              type="button"
              disabled={relationNodes.length !== 2 || loadingRelation}
              onClick={() => void analyzeRelationship()}
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
          ) : (
            <div className="snezhnaya-browse-bar">
              <BookOpenText size={16} aria-hidden="true" />
              <span>
                {t(
                  language,
                  "浏览模式：选择一份档案，右侧会展开它的身份、命运与证据。",
                  "Browse mode: select a dossier to reveal its identity, fate, and evidence.",
                )}
              </span>
              <button type="button" onClick={() => setRelationshipMode(true)}>
                <Network size={15} aria-hidden="true" />
                {t(language, "比较两份档案", "Compare two dossiers")}
              </button>
            </div>
          )}
        </div>

        <aside className="snezhnaya-detail snezhnaya-intel-detail">
          {selectedNode ? (
            <>
              <div className="snezhnaya-detail-kicker">
                <BookOpenText size={15} aria-hidden="true" />
                <span>{t(language, "皇家档案", "Royal dossier")}</span>
                <small>{selectedNode.id.toUpperCase()}</small>
              </div>
              <div
                className={[
                  "snezhnaya-detail-heading",
                  selectedNode.imageUrl ? "with-portrait" : "",
                ].join(" ")}
              >
                <div>
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
              {selectedNode.statusLabel ? (
                <div
                  className={`snezhnaya-status-callout status-${selectedNode.status}`}
                >
                  {selectedNode.harbingerRank ? (
                    <strong>
                      {t(
                        language,
                        `第 ${selectedNode.harbingerRank} 席`,
                        `Seat ${selectedNode.harbingerRank}`,
                      )}
                    </strong>
                  ) : null}
                  <span>{localize(selectedNode.statusLabel, language)}</span>
                </div>
              ) : null}
              <p>{localize(selectedNode.summary, language)}</p>
              <div className="snezhnaya-detail-quick-facts">
                {nodeDetailFacts(selectedNode, language).slice(1, 3).map((fact) => (
                  <div key={`${fact.label}-${fact.value}`}>
                    <span>{fact.label}</span>
                    <strong>{fact.value}</strong>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="snezhnaya-detail-open"
                onClick={() => setDetailOpen(true)}
              >
                <Sparkles size={15} />
                {t(language, "展开详情", "Open details")}
              </button>
              <details className="snezhnaya-clues-drawer">
                <summary>
                  <span>{t(language, "档案证据", "Archive evidence")}</span>
                  <b>{selectedNode.clues.length}</b>
                </summary>
                <div className="snezhnaya-clues">
                  {selectedNode.clues.map((clue) => (
                    <a
                      key={clue.id}
                      href={clue.url}
                      target={clue.url ? "_blank" : undefined}
                      rel={clue.url ? "noreferrer" : undefined}
                    >
                      <b>{clue.title}</b>
                      <span>
                        {sourceTypeLabel(clue.sourceType, language)}
                      </span>
                      <small>{localize(clue.excerpt, language)}</small>
                    </a>
                  ))}
                </div>
              </details>
              <div className="snezhnaya-related">
                <h3>{t(language, "相邻节点", "Related nodes")}</h3>
                {selectedNode.relatedNodeIds.map((id) => {
                  const related = nodeMap.get(id);
                  if (!related) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => openNode(related)}
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

      {detailOpen && selectedNode ? (
        <div
          className="snezhnaya-detail-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="snezhnaya-detail-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailOpen(false);
          }}
        >
          <div className="snezhnaya-detail-dialog snezhnaya-intel-dialog">
            <button
              type="button"
              className="snezhnaya-detail-close"
              onClick={() => setDetailOpen(false)}
              autoFocus
            >
              {t(language, "关闭", "Close")}
            </button>
            <section className="snezhnaya-detail-profile">
              <div className="snezhnaya-detail-profile-copy">
                <h2 id="snezhnaya-detail-title">
                  {localize(selectedNode.label, language)}
                </h2>
                <p>{localize(selectedNode.summary, language)}</p>
              </div>
              {selectedNode.imageUrl ? (
                <Image
                  className="snezhnaya-detail-hero-portrait"
                  src={selectedNode.imageUrl}
                  alt={localize(selectedNode.label, language)}
                  width={220}
                  height={220}
                  unoptimized
                />
              ) : null}
            </section>

            <section className="snezhnaya-detail-facts">
              {nodeDetailFacts(selectedNode, language).map((fact) => (
                <div key={`${fact.label}-${fact.value}`}>
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                </div>
              ))}
            </section>

            <section className="snezhnaya-detail-main">
              <article>
                <h3>{t(language, "完整介绍", "Profile")}</h3>
                {selectedNode.detail[language].map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </article>
              <article>
                <h3>{t(language, "Wiki 信息", "Wiki information")}</h3>
                <div className="snezhnaya-detail-clue-grid">
                  {selectedNode.clues.map((clue) => (
                    <a
                      key={clue.id}
                      href={clue.url}
                      target={clue.url ? "_blank" : undefined}
                      rel={clue.url ? "noreferrer" : undefined}
                    >
                      <span>
                        {sourceTypeLabel(clue.sourceType, language)}
                      </span>
                      <b>{clue.title}</b>
                      <small>{localize(clue.excerpt, language)}</small>
                    </a>
                  ))}
                </div>
              </article>
            </section>

            <section className="snezhnaya-detail-relations">
              <div>
                <h3>{t(language, "关联节点", "Related nodes")}</h3>
                <p>
                  {t(
                    language,
                    "切换节点查看详情，或直接分析两者关系。",
                    "Switch to a node's details, or analyze the relationship directly.",
                  )}
                </p>
              </div>
              <div className="snezhnaya-detail-relation-grid">
                {selectedNode.relatedNodeIds.map((id) => {
                  const related = nodeMap.get(id);
                  if (!related) return null;
                  return (
                    <div key={id}>
                      <button
                        type="button"
                        onClick={() => {
                          selectGraphNode(related);
                        }}
                      >
                        {localize(related.label, language)}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDetailOpen(false);
                          void analyzeRelationship([selectedNode, related]);
                        }}
                      >
                        {t(language, "分析关系", "Analyze")}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="snezhnaya-detail-questions">
                <h3>{t(language, "推荐追问", "Suggested questions")}</h3>
                {selectedNode.suggestedQuestions[language].map((question) => (
                  <button
                    type="button"
                    key={question}
                    onClick={() => {
                      const related = selectedNode.relatedNodeIds
                        .map((id) => nodeMap.get(id))
                        .find((node): node is SnezhnayaNode => Boolean(node));
                      if (related) {
                        setDetailOpen(false);
                        void analyzeRelationship([selectedNode, related]);
                      }
                    }}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      ) : null}

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
