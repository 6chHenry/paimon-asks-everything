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
    zh: "3 分钟轻剧透",
    en: "3-minute guide",
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
    <article className="preheat-note">
      <div className="note-pin" aria-hidden="true" />
      <header>
        <span className="eyebrow">
          <Feather size={14} />
          {t(language, "今日派蒙小纸条", "Today's Paimon note")}
        </span>
        <span className="note-date">SNEZHNAYA PREHEAT · 01</span>
      </header>
      <div className="note-copy">
        <p className="note-kicker">
          {t(
            language,
            "旅行者，进入至冬前，有一条旧线索值得重新串起来。",
            "Traveler, one old thread is worth reconnecting before Snezhnaya.",
          )}
        </p>
        <h1>{isZh ? topic.titleZh : topic.titleEn}</h1>
        <p>{isZh ? topic.introZh : topic.introEn}</p>
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
      <footer>
        <span>
          {t(
            language,
            "已实装文本 · 不含泄露 · 高风险剧透仍会二次确认",
            "Released text only · No leaks · Major spoilers still reconfirm",
          )}
        </span>
        <button className="primary-button" type="button" onClick={onStart}>
          {t(language, "展开这张纸条", "Open the note")}
          <ArrowRight size={17} />
        </button>
      </footer>
    </article>
  );
}
