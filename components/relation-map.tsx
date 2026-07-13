"use client";

import { useEffect, useMemo, useState } from "react";
import type { Language } from "@/lib/domain";
import { labels, t } from "@/lib/i18n";
import type { StoryPlayerPreheatView } from "@/lib/preheat";

type Graph = StoryPlayerPreheatView["relationGraph"];

const positions = [
  [50, 12],
  [82, 28],
  [82, 70],
  [50, 87],
  [18, 70],
  [18, 28],
  [50, 50],
  [68, 50],
] as const;

export function RelationMap({
  graph,
  language,
  selectedNodeId,
  onNodeSelect,
}: {
  graph: Graph;
  language: Language;
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string) => void;
}) {
  const [localSelectedNodeId, setLocalSelectedNodeId] = useState(selectedNodeId);
  useEffect(() => setLocalSelectedNodeId(selectedNodeId), [graph.id, selectedNodeId]);
  const coordinates = Object.fromEntries(
    graph.nodes.map((node, index) => [node.id, positions[index] ?? [50, 50]]),
  );
  const selectedNode = useMemo(
    () =>
      graph.nodes.find((node) => node.id === localSelectedNodeId) ?? graph.nodes[0],
    [graph.nodes, localSelectedNodeId],
  );
  return (
    <div className="relation-map">
      <div className="relation-canvas">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          {graph.edges.map((edge) => {
            const from = coordinates[edge.from];
            const to = coordinates[edge.to];
            if (!from || !to) return null;
            return (
              <line
                key={edge.id}
                x1={from[0]}
                y1={from[1]}
                x2={to[0]}
                y2={to[1]}
                className={`edge-${edge.factStatus}`}
              />
            );
          })}
        </svg>
        {graph.nodes.map((node, index) => {
          const [left, top] = positions[index] ?? [50, 50];
          return (
            <button
              type="button"
              key={node.id}
              className={`relation-node kind-${node.kind}${
                selectedNode?.id === node.id ? " active" : ""
              }`}
              style={{ left: `${left}%`, top: `${top}%` }}
              aria-pressed={selectedNode?.id === node.id}
              onClick={() => {
                setLocalSelectedNodeId(node.id);
                onNodeSelect(node.id);
              }}
            >
              <span>{node.label}</span>
              <small>{node.kind}</small>
            </button>
          );
        })}
      </div>
      <div className="relation-legend">
        {graph.edges.map((edge) => (
          <div key={edge.id}>
            <i className={`edge-${edge.factStatus}`} />
            <span>{edge.label}</span>
            <small>{labels.fact[edge.factStatus][language]}</small>
          </div>
        ))}
      </div>
      {selectedNode ? (
        <article className="relation-detail" aria-live="polite">
          <header>
            <span>{selectedNode.kind}</span>
            <h3>{selectedNode.label}</h3>
          </header>
          {selectedNode.details.length ? (
            <ul>
              {selectedNode.details.map((detail) => (
                <li key={detail.id}>
                  <span>{labels.fact[detail.factStatus][language]}</span>
                  <strong>{detail.title}</strong>
                  <p>{detail.summary}</p>
                  <a href={detail.sourceUrl} target="_blank" rel="noreferrer">
                    {detail.sourceTitle}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {t(
                language,
                "这个节点暂时没有可展示的已解锁详情。",
                "This node has no unlocked detail yet.",
              )}
            </p>
          )}
        </article>
      ) : null}
    </div>
  );
}
