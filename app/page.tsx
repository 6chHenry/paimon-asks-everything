"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Compass,
  Feather,
  LockKeyhole,
  Radar,
} from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { ChoiceGrid, Field } from "@/components/field";
import type {
  Focus,
  Profile,
  Progress,
  SpoilerPreference,
} from "@/lib/domain";
import { labels, t } from "@/lib/i18n";

const profileDescriptions = {
  new: ["解释术语与入口", "Terms and entry points"],
  returning: ["只补真正需要的背景", "Only the context you need"],
  story: ["人物、伏笔与证据", "People, threads, and evidence"],
  exploration: ["机制解释与分层提示", "Mechanics and layered hints"],
  casual: ["轻量理解核心卖点", "A lighter path to the highlights"],
};

export default function HomePage() {
  const router = useRouter();
  const { preferences, setPreferences } = usePreferences();
  const language = preferences.language;
  const isZh = language === "zh-CN";
  const profileItems = (
    Object.keys(labels.profile) as Profile[]
  ).map((value) => ({
    value,
    label: labels.profile[value][language],
    description: profileDescriptions[value][isZh ? 0 : 1],
  }));
  const progressItems = (
    Object.keys(labels.progress) as Progress[]
  ).map((value) => ({ value, label: labels.progress[value][language] }));
  const spoilerItems = (
    Object.keys(labels.spoiler) as SpoilerPreference[]
  ).map((value) => ({
    value,
    label: labels.spoiler[value][language],
    description:
      value === "none"
        ? t(language, "只给公共背景", "Public context only")
        : value === "low"
          ? t(language, "保留关键反转", "Protect major twists")
          : t(language, "关键剧透仍会再确认", "Major twists still reconfirm"),
  }));

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
    <div className="home-page">
      <section className="hero">
        <div className="hero-copy reveal">
          <span className="eyebrow">
            <Feather size={14} />
            {t(language, "旅行者，准备出发！", "Ready, Traveler?")}
          </span>
          <h1>
            {t(language, "旧故事太多？", "Too much story to catch up on?")}
            <em>{t(language, "派蒙帮你挑重点！", "Paimon will find the important bits!")}</em>
          </h1>
          <p>
            {t(
              language,
              "选好进度和剧透偏好，我们马上开始！",
              "Pick your progress and spoiler limit, then let’s go!",
            )}
          </p>
          <div className="hero-principles">
            <span><Compass size={17} />{t(language, "最小必要补课", "Minimum catch-up")}</span>
            <span><LockKeyhole size={17} />{t(language, "剧透由你控制", "You control spoilers")}</span>
            <span><Radar size={17} />{t(language, "问题沉淀为洞察", "Questions become insights")}</span>
          </div>
        </div>
        <div className="hero-orbit reveal delay-1" aria-hidden="true">
          <div className="orbit-ring orbit-a" />
          <div className="orbit-ring orbit-b" />
          <img src="/compass-mark.svg" alt="" />
          <span className="orbit-note note-a">EVIDENCE</span>
          <span className="orbit-note note-b">NO SPOILERS</span>
          <span className="orbit-note note-c">ZH / EN</span>
        </div>
      </section>

      <section className="setup-panel reveal delay-2">
        <div className="setup-heading">
          <div>
            <span className="section-index">01</span>
            <h2>{t(language, "旅行者，先选一下！", "A few quick choices, Traveler!")}</h2>
          </div>
        </div>

        <Field label={t(language, "你更像哪类玩家？", "What kind of player are you?")}>
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

        <div className="setup-split">
          <Field label={t(language, "大致主线进度", "Approximate story progress")}>
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
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Field>
          <Field label={t(language, "默认剧透深度", "Default spoiler depth")}>
            <ChoiceGrid
              items={spoilerItems}
              value={preferences.spoilerPreference}
              onChange={(value) =>
                setPreferences((current) => ({
                  ...current,
                  spoilerPreference: value as SpoilerPreference,
                }))
              }
            />
          </Field>
        </div>

        <Field
          label={t(language, "回答更关注什么？", "What should answers emphasize?")}
          hint={t(language, "可以多选", "Choose more than one")}
        >
          <div className="focus-row">
            {(Object.keys(labels.focus) as Focus[]).map((focus) => (
              <button
                type="button"
                key={focus}
                className={preferences.focus.includes(focus) ? "pill active" : "pill"}
                onClick={() => toggleFocus(focus)}
              >
                {labels.focus[focus][language]}
              </button>
            ))}
          </div>
        </Field>

        <div className="consent-row">
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
              <strong>{t(language, "保存这次问题", "Save this question")}</strong>
              <small>{t(language, "关闭时只记录匿名分类。", "When off, only anonymous categories are recorded.")}</small>
            </span>
          </label>
          <button className="primary-button" type="button" onClick={() => router.push("/ask")}>
            {t(language, "出发！", "Let’s go!")}
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

    </div>
  );
}
