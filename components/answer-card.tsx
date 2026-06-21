"use client";

import { useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { ChatResult, Language } from "@/lib/domain";
import { parseAnswerCitationMarkers } from "@/lib/citation-markers";
import { labels, t } from "@/lib/i18n";
import { ReadingAppendix } from "@/components/reading-appendix";
import { clientPath } from "@/lib/client-path";

export function AnswerCard({
  result,
  language,
  onConfirmSpoiler,
}: {
  result: ChatResult;
  language: Language;
  onConfirmSpoiler: () => void;
}) {
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const validCitationIds = new Set(result.citations.map((citation) => citation.id));

  function renderInline(text: string, citationIds: string[] = []) {
    const inline = parseAnswerCitationMarkers(text).map(
      (segment, segmentIndex) =>
        segment.type === "citation" ? (
          validCitationIds.has(segment.sourceId) ? (
            <sup
              key={`${segment.sourceId}-${segmentIndex}`}
              className="answer-citation-note"
              title={segment.sourceId}
            >
              [{segment.label}]
            </sup>
          ) : null
        ) : (
          <span key={`text-${segmentIndex}`}>
            {segment.text.split(/(\*\*[^*]+\*\*)/gu).map((part, partIndex) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={partIndex}>{part.slice(2, -2)}</strong>
              ) : (
                <span key={partIndex}>{part}</span>
              ),
            )}
          </span>
        ),
    );
    const structured = citationIds
      .filter((id) => validCitationIds.has(id))
      .map((id, index) => (
        <sup
          key={`${id}-structured-${index}`}
          className="answer-citation-note"
          title={id}
        >
          [{id.replace(/\D/g, "") || id}]
        </sup>
      ));
    return [...inline, ...structured];
  }

  function renderParagraph(text: string, citationIds: string[], index: number) {
    const trimmed = text.trim();
    const heading = trimmed.match(/^#{1,4}\s+(.+)$/u);
    if (heading) {
      return <h3 key={index}>{renderInline(heading[1], citationIds)}</h3>;
    }
    const ordered = trimmed.match(/^(\d+)\.\s+(.+)$/u);
    if (ordered) {
      return (
        <div className="answer-list-line" key={index}>
          <span>{ordered[1]}</span>
          <p>{renderInline(ordered[2], citationIds)}</p>
        </div>
      );
    }
    return <p key={index}>{renderInline(trimmed, citationIds)}</p>;
  }

  function renderLegacyInline(text: string) {
    return parseAnswerCitationMarkers(text).map((segment, segmentIndex) =>
      segment.type === "citation" ? (
        validCitationIds.has(segment.sourceId) ? (
          <sup
            key={`${segment.sourceId}-${segmentIndex}`}
            className="answer-citation-note"
            title={segment.sourceId}
          >
            [{segment.label}]
          </sup>
        ) : null
      ) : (
        <span key={`text-${segmentIndex}`}>
          {segment.text.split(/(\*\*[^*]+\*\*)/gu).map((part, partIndex) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={partIndex}>{part.slice(2, -2)}</strong>
            ) : (
              <span key={partIndex}>{part}</span>
            ),
          )}
        </span>
      ),
    );
  }

  async function sendFeedback(helpful: boolean) {
    setFeedback(helpful);
    if (result.eventId) {
      await fetch(clientPath("/api/feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: result.eventId, helpful }),
      });
    }
  }

  if (result.status === "spoiler_confirmation_required") {
    return (
      <article className="spoiler-card">
        <div className="spoiler-icon"><ShieldAlert size={25} /></div>
        <div>
          <span className="eyebrow">{t(language, "高风险剧透", "High-risk spoiler")}</span>
          <h2>{t(language, "再说下去就要剧透啦！", "Careful, Traveler — spoilers ahead!")}</h2>
          <p>{result.reason}</p>
          <div className="spoiler-actions">
            <button className="danger-button" type="button" onClick={onConfirmSpoiler}>
              {t(language, "继续说", "Continue")}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={`answer-card status-${result.status}`}>
      <div className="answer-kicker">
        <span><Sparkles size={15} />{t(language, "派蒙找到啦！", "Paimon found it!")}</span>
        <span className={`confidence ${result.confidence}`}>
          {t(language, `置信度：${result.confidence === "high" ? "高" : result.confidence === "medium" ? "中" : "低"}`, `Confidence: ${result.confidence}`)}
        </span>
      </div>
      <div className="answer-text">
        {result.answerParagraphs?.length
          ? result.answerParagraphs.map((paragraph, index) =>
              renderParagraph(paragraph.text, paragraph.citationIds, index),
            )
          : result.answer.split("\n").map((line, index) => {
          const trimmed = line.trim();
          if (!trimmed) return null;
          const heading = trimmed.match(/^#{1,4}\s+(.+)$/u);
          if (heading) {
            return <h3 key={index}>{renderLegacyInline(heading[1])}</h3>;
          }
          const ordered = trimmed.match(/^(\d+)\.\s+(.+)$/u);
          if (ordered) {
            return (
              <div className="answer-list-line" key={index}>
                <span>{ordered[1]}</span>
                <p>{renderLegacyInline(ordered[2])}</p>
              </div>
            );
          }
          return <p key={index}>{renderLegacyInline(trimmed)}</p>;
        })}
      </div>

      {result.hints ? (
        <section className="hint-stack">
          <h3>{t(language, "先给你一点提示", "A hint first")}</h3>
          {result.hints.map((hint, index) => (
            <details key={hint} open={index === 0}>
              <summary>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {[
                  t(language, "观察方向", "What to observe"),
                  t(language, "关键机制", "Key mechanism"),
                  t(language, "完整思路", "Full approach"),
                ][index]}
                <ChevronDown size={16} />
              </summary>
              <p>{hint}</p>
            </details>
          ))}
        </section>
      ) : null}

      {result.claims.length ? (
        <section className="claim-list">
          <h3>{t(language, "关键依据", "Key evidence")}</h3>
          {result.claims.map((claim) => (
            <div key={claim.text}>
              <Check size={15} />
              <p>{claim.text}</p>
              <span>{labels.fact[claim.factStatus][language]}</span>
            </div>
          ))}
        </section>
      ) : null}

      {result.citations.length ? (
        <section className="sources">
          <div className="sources-heading">
            <h3><BookOpen size={18} />{t(language, "资料来源", "Sources")}</h3>
            {result.usedExternalSources ? (
              <span className="external-badge">{t(language, "外部资料", "External material")}</span>
            ) : null}
          </div>
          {result.citations.map((citation) => (
            <details key={citation.id}>
              <summary>
                <span className="source-number">{citation.id.replace(/\D/g, "") || "•"}</span>
                <span>
                  <strong>{citation.title}</strong>
                  <small>
                    {citation.sourceName} · {labels.sourceKind[citation.sourceKind][language]} · {labels.fact[citation.factStatus][language]}
                    {citation.crossLanguage ? ` · ${t(language, "跨语言回退", "cross-language fallback")}` : ""}
                  </small>
                </span>
                <ChevronDown size={16} />
              </summary>
              <blockquote>{citation.excerpt}</blockquote>
              <a href={citation.url} target="_blank" rel="noreferrer">
                {t(language, "查看原始来源", "Open source")}
                <ExternalLink size={14} />
              </a>
            </details>
          ))}
        </section>
      ) : null}

      <ReadingAppendix
        resources={result.readingRecommendations ?? []}
        language={language}
      />

      <div className="answer-footer">
        <div>
          {feedback === null ? (
            <>
              <span>{t(language, "有帮助吗？", "Helpful?")}</span>
              <button type="button" onClick={() => sendFeedback(true)} aria-label="Helpful">
                <ThumbsUp size={16} />
              </button>
              <button type="button" onClick={() => sendFeedback(false)} aria-label="Not helpful">
                <ThumbsDown size={16} />
              </button>
            </>
          ) : (
            <span>{t(language, "收到！", "Got it!")}</span>
          )}
        </div>
      </div>
    </article>
  );
}
