"use client";

import type { Language } from "@/lib/domain";
import type { SnezhnayaGraphData } from "@/lib/snezhnaya-graph";
import { localize } from "@/lib/snezhnaya-graph";

export function SnezhnayaGraphPreview({
  graph,
  language,
  href,
}: {
  graph: SnezhnayaGraphData;
  language: Language;
  href: string;
}) {
  const basePreviewNodes = graph.nodes
    .filter((node) => node.graphPosition)
    .slice(0, 12);
  const pinnedNodeIds = ["pantalone"];
  const pinnedPreviewNodes = pinnedNodeIds
    .map((nodeId) =>
      graph.nodes.find((node) => node.id === nodeId && node.graphPosition),
    )
    .filter((node): node is (typeof graph.nodes)[number] => Boolean(node))
    .filter((node) => !basePreviewNodes.some((item) => item.id === node.id));
  const previewNodes = [...basePreviewNodes, ...pinnedPreviewNodes];

  return (
    <a
      className="home-graph-preview"
      href={href}
      aria-label={
        language === "zh-CN"
          ? "打开至冬关系图"
          : "Open Snezhnaya relationship graph"
      }
    >
      <span className="home-graph-preview-orbit" aria-hidden="true" />
      {previewNodes.map((node) => (
        <span
          key={node.id}
          className={`home-graph-preview-node group-${node.graphGroup}`}
          style={{
            left: `${node.graphPosition?.x ?? 50}%`,
            top: `${node.graphPosition?.y ?? 50}%`,
          }}
        >
          <i />
          <b>{localize(node.label, language)}</b>
        </span>
      ))}
      <span className="home-graph-preview-caption">
        {language === "zh-CN" ? "至冬关系图谱" : "Snezhnaya relationship map"}
      </span>
    </a>
  );
}
