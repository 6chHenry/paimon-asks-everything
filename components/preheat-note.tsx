"use client";

import { ArrowRight, Feather } from "lucide-react";
import type { Language, PreheatTopic } from "@/lib/domain";
import { t } from "@/lib/i18n";

export function PreheatNote({
  topic,
  language,
  onStart,
}: {
  topic: PreheatTopic;
  language: Language;
  onStart: () => void;
}) {
  const isZh = language === "zh-CN";
  return (
    <article className="intel-brief">
      <div className="intel-brief-pin note-pin" aria-hidden="true" />
      <header>
        <span className="eyebrow">
          <Feather size={14} />
          {t(language, "今日派蒙小纸条", "Today's Paimon note")}
        </span>
        <span className="note-date">SNEZHNAYA PREHEAT · 01</span>
      </header>
      <div className="intel-brief-copy note-copy">
        <p className="note-kicker">
          {t(
            language,
            "旅行者，进入至冬前，有一条旧线索值得重新串起来。",
            "Traveler, one old thread is worth reconnecting before Snezhnaya.",
          )}
        </p>
        <h1>{isZh ? topic.titleZh : topic.titleEn}</h1>
        {isZh ? (
          topic.introZh ? <p>{topic.introZh}</p> : null
        ) : topic.introEn ? (
          <p>{topic.introEn}</p>
        ) : null}
      </div>
      <footer className="intel-brief-footer">
        <button className="primary-button" type="button" onClick={onStart}>
          {t(language, "展开这张纸条", "Open the note")}
          <ArrowRight size={17} />
        </button>
      </footer>
    </article>
  );
}
