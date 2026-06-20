"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Settings2, Sparkles } from "lucide-react";
import { ChoiceGrid, Field } from "@/components/field";
import { PreheatNote } from "@/components/preheat-note";
import { usePreferences } from "@/components/preferences-provider";
import { preheatTopics } from "@/data/preheat-topics";
import type {
  Focus,
  PreheatDepth,
  Profile,
  Progress,
} from "@/lib/domain";
import { labels, t } from "@/lib/i18n";

const profileDescriptions = {
  new: ["先解释阵营和术语", "Explain factions and terms first"],
  returning: ["只补进入至冬前的必要背景", "Only the context needed before Snezhnaya"],
  story: ["展开证据、人物与伏笔", "Open evidence, characters, and threads"],
  exploration: ["轻量理解大世界文本", "Light context from world text"],
  casual: ["先看核心卖点", "Start with the main hook"],
};

export default function HomePage() {
  const router = useRouter();
  const { preferences, setPreferences } = usePreferences();
  const language = preferences.language;
  const isZh = language === "zh-CN";
  const [topicId, setTopicId] = useState(preheatTopics[0].id);
  const [depth, setDepth] = useState<PreheatDepth>("guided");
  const topic =
    preheatTopics.find((item) => item.id === topicId) ?? preheatTopics[0];

  const profileItems = (Object.keys(labels.profile) as Profile[]).map(
    (value) => ({
      value,
      label: labels.profile[value][language],
      description: profileDescriptions[value][isZh ? 0 : 1],
    }),
  );
  const progressItems = (Object.keys(labels.progress) as Progress[]).map(
    (value) => ({ value, label: labels.progress[value][language] }),
  );
  function toggleFocus(focus: Focus) {
    setPreferences((current) => {
      const exists = current.focus.includes(focus);
      const next = exists
        ? current.focus.filter((item) => item !== focus)
        : [...current.focus, focus];
      return { ...current, focus: next.length ? next : [focus] };
    });
  }

  return (
    <div className="home-page preheat-home">
      <section className="preheat-home-hero">
        <div className="preheat-home-heading reveal">
          <span className="eyebrow">
            <Sparkles size={14} />
            {t(language, "主动版本预热", "Proactive release preheat")}
          </span>
          <h2>
            {t(language, "旧线索不是作业。", "Old clues are not homework.")}
            <em>
              {t(
                language,
                "派蒙把值得重看的那一条递给你。",
                "Paimon hands you the one thread worth revisiting.",
              )}
            </em>
          </h2>
        </div>
        <div className="topic-rail reveal delay-1">
          <span>{t(language, "本期可轮换主题", "Curated topic rotation")}</span>
          {preheatTopics.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={item.id === topicId ? "active" : undefined}
              onClick={() => setTopicId(item.id)}
            >
              <small>{String(index + 1).padStart(2, "0")}</small>
              <strong>{isZh ? item.titleZh : item.titleEn}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="note-stage reveal delay-2">
        <PreheatNote
          topic={topic}
          language={language}
          selectedDepth={depth}
          onSelectDepth={setDepth}
          onStart={() =>
            router.push(
              `/preheat?topicId=${encodeURIComponent(topicId)}&depth=${depth}`,
            )
          }
        />
        <aside className="note-margin">
          <Compass size={24} />
          <strong>{t(language, "今日导览原则", "Today's guide rule")}</strong>
          <p>
            {t(
              language,
              "是否展开某国剧情，只看你是否完成该国主线；完整考据仅增加武器、圣遗物、物品和大世界文本，不会越过进度锁。",
              "A nation's story opens only after you finish that nation's main quest. Research adds weapon, artifact, item, and world text, but never bypasses progress locks.",
            )}
          </p>
        </aside>
      </section>

      <details className="traveler-settings">
        <summary>
          <span>
            <Settings2 size={16} />
            {t(language, "调整旅行者状态", "Adjust Traveler context")}
          </span>
          <small>
            {labels.profile[preferences.profile][language]} ·{" "}
            {labels.progress[preferences.progress][language]}
          </small>
        </summary>
        <div className="settings-body">
          <Field
            label={t(language, "你更像哪类玩家？", "What kind of player are you?")}
          >
            <ChoiceGrid
              items={profileItems}
              value={preferences.profile}
              onChange={(value) =>
                setPreferences((current) => ({
                  ...current,
                  profile: value as Profile,
                }))
              }
              columns={5}
            />
          </Field>
          <Field
            label={t(
              language,
              "你最新完成了哪个地区的主线？",
              "Which region's main quest have you most recently completed?",
            )}
            hint={t(
              language,
              "后续地区的事件节点将保持锁定",
              "Later-region event nodes remain locked",
            )}
          >
            <select
              value={preferences.progress}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  progress: event.target.value as Progress,
                }))
              }
            >
              {progressItems.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t(language, "回答更关注什么？", "What should answers emphasize?")}
            hint={t(language, "可以多选", "Choose more than one")}
          >
            <div className="focus-row">
              {(Object.keys(labels.focus) as Focus[]).map((focus) => (
                <button
                  type="button"
                  key={focus}
                  className={
                    preferences.focus.includes(focus) ? "pill active" : "pill"
                  }
                  onClick={() => toggleFocus(focus)}
                >
                  {labels.focus[focus][language]}
                </button>
              ))}
            </div>
          </Field>
          <label className="switch-label">
            <input
              type="checkbox"
              checked={preferences.allowQuestionTextStorage}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  allowQuestionTextStorage: event.target.checked,
                }))
              }
            />
            <span className="switch" />
            <span>
              <strong>
                {t(language, "允许保存我主动提交的问题", "Allow saving questions I submit")}
              </strong>
              <small>
                {t(
                  language,
                  "关闭时仍只记录匿名分类；预热点击不含原始文本。",
                  "When off, only anonymous categories are stored; preheat clicks contain no raw text.",
                )}
              </small>
            </span>
          </label>
        </div>
      </details>
    </div>
  );
}
