"use client";

import { ArrowRight, Clock3, Feather, ShieldCheck } from "lucide-react";
import type { PreheatDepth, PreheatTopic } from "@/lib/domain";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/domain";

const depthCopy: Record<
  PreheatDepth,
  { zh: string; en: string; noteZh: string; noteEn: string }
> = {
  guided: {
    zh: "已过剧情回顾",
    en: "Story recap",
    noteZh: "确定事件链 + 关键人物关系",
    noteEn: "Confirmed events + key relationships",
  },
  research: {
    zh: "完整考据",
    en: "Research view",
    noteZh: "证据层级 + 暗示与争议边界",
    noteEn: "Evidence layers + disputed boundaries",
  },
};

export function PreheatNote({
  topic,
  language,
  selectedDepth,
  onSelectDepth,
  onStart,
}: {
  topic: PreheatTopic;
  language: Language;
  selectedDepth: PreheatDepth;
  onSelectDepth: (depth: PreheatDepth) => void;
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
      <div className="depth-selector" aria-label="Preheat depth">
        {(Object.keys(depthCopy) as PreheatDepth[]).map((depth) => {
          const copy = depthCopy[depth];
          return (
            <button
              type="button"
              key={depth}
              className={selectedDepth === depth ? "active" : undefined}
              onClick={() => onSelectDepth(depth)}
            >
              <span>
                {depth === "guided" ? (
                  <Clock3 size={15} />
                ) : (
                  <ShieldCheck size={15} />
                )}
                {isZh ? copy.zh : copy.en}
              </span>
              <small>{isZh ? copy.noteZh : copy.noteEn}</small>
            </button>
          );
        })}
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
