"use client";

import type { Language } from "@/lib/domain";
import { labels, t } from "@/lib/i18n";
import type { PreheatView } from "@/lib/preheat";

type Graph = PreheatView["relationGraph"];

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
  onNodeSelect,
}: {
  graph: Graph;
  language: Language;
  onNodeSelect: (nodeId: string) => void;
}) {
  const coordinates = Object.fromEntries(
    graph.nodes.map((node, index) => [node.id, positions[index] ?? [50, 50]]),
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
              className={`relation-node kind-${node.kind}`}
              style={{ left: `${left}%`, top: `${top}%` }}
              onClick={() => onNodeSelect(node.id)}
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
      <p>
        {t(
          language,
          "图中每条边都绑定受控证据；虚线表示暗示或推测，不表示已确认因果。",
          "Every edge is bound to controlled evidence; dashed lines mark implications or theory, not confirmed causality.",
        )}
      </p>
    </div>
  );
}
