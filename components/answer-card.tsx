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
import { labels, t } from "@/lib/i18n";

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

  async function sendFeedback(helpful: boolean) {
    setFeedback(helpful);
    if (result.eventId) {
      await fetch("/api/feedback", {
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
          <h2>{t(language, "派蒙先在这里踩一下刹车", "Paimon is tapping the brakes")}</h2>
          <p>{result.reason}</p>
          <div className="spoiler-actions">
            <button className="danger-button" type="button" onClick={onConfirmSpoiler}>
              {t(language, "仅这一次，继续解释", "Continue for this question")}
            </button>
            <span>{t(language, "不会修改你的默认偏好", "Your default preference stays unchanged")}</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={`answer-card status-${result.status}`}>
      <div className="answer-kicker">
        <span><Sparkles size={15} />{t(language, "派蒙的回答", "Paimon’s answer")}</span>
        <span className={`confidence ${result.confidence}`}>
          {t(language, `置信度：${result.confidence === "high" ? "高" : result.confidence === "medium" ? "中" : "低"}`, `Confidence: ${result.confidence}`)}
        </span>
      </div>
      <div className="answer-text">
        {result.answer.split("\n").map((paragraph, index) =>
          paragraph ? <p key={index}>{paragraph}</p> : null,
        )}
      </div>

      {result.hints ? (
        <section className="hint-stack">
          <h3>{t(language, "分层提示", "Layered hints")}</h3>
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
          <h3>{t(language, "这次回答依据了什么", "What this answer relies on")}</h3>
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
            <h3><BookOpen size={18} />{t(language, "来源与证据", "Sources & evidence")}</h3>
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
                    {citation.sourceName} · {labels.fact[citation.factStatus][language]}
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

      <div className="answer-footer">
        <span>
          {result.eventRecorded
            ? t(language, "已写入匿名问题事件", "Anonymous event recorded")
            : t(language, "回答可用，但事件写入失败", "Answer available; event recording failed")}
        </span>
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
            <span>{t(language, "谢谢，收到啦。", "Thanks — noted.")}</span>
          )}
        </div>
      </div>
    </article>
  );
}
