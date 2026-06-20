"use client";

import { LockKeyhole, MapPin } from "lucide-react";
import type { Language, Progress } from "@/lib/domain";
import { labels, t } from "@/lib/i18n";
import type { PreheatView } from "@/lib/preheat";

type TimelineItem = PreheatView["timeline"][number];

export function GnosisTimeline({
  items,
  selectedId,
  language,
  onSelect,
}: {
  items: TimelineItem[];
  selectedId?: string;
  language: Language;
  onSelect: (item: TimelineItem) => void;
}) {
  if (!items.length) {
    return (
      <div className="timeline-empty">
        {t(
          language,
          "当前主题暂时没有可展示的事件节点。",
          "This topic currently has no event nodes to display.",
        )}
      </div>
    );
  }
  return (
    <ol className="gnosis-timeline">
      {items.map((item, index) => (
        <li key={item.id} className={selectedId === item.id ? "active" : ""}>
          <button
            type="button"
            disabled={item.locked}
            onClick={() => {
              if (!item.locked) onSelect(item);
            }}
          >
            <span className="timeline-marker">
              {item.locked ? <LockKeyhole size={13} /> : String(index + 1).padStart(2, "0")}
            </span>
            <span>
              <small>
                <MapPin size={12} />
                {labels.progress[item.region as Progress][language]}
              </small>
              <strong>{item.title}</strong>
              <em>
                {item.locked
                  ? t(language, "超出当前进度，详情已保护", "Beyond current progress; details protected")
                  : t(language, "确定事件", "Confirmed event")}
              </em>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
