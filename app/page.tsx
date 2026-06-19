"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpenText,
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
            {t(language, "旅行者的版本理解手帐", "A traveler’s version field guide")}
          </span>
          <h1>
            {t(language, "不是补完所有过去，", "You don’t need every old quest.")}
            <em>{t(language, "而是找回恰好的上下文。", "Just the right context.")}</em>
          </h1>
          <p>
            {t(
              language,
              "派蒙会按你的进度、兴趣和剧透边界解释版本内容；每个关键说法都保留来源，让“我记得好像”变成“这里可以核对”。",
              "Paimon explains a version around your progress, interests, and spoiler boundaries. Important claims keep their sources, turning “I vaguely remember” into something you can verify.",
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
            <h2>{t(language, "先告诉派蒙，你从哪里出发", "Tell Paimon where you’re starting")}</h2>
          </div>
          <p>{t(language, "四步完成设置，之后都能随时修改。", "Four quick choices. Change them anytime.")}</p>
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
              <strong>{t(language, "允许保存原始问题以改进 FAQ", "Allow question text for FAQ improvement")}</strong>
              <small>{t(language, "默认关闭；不保存回答、账号或身份信息。", "Off by default; answers and identity are never stored.")}</small>
            </span>
          </label>
          <button className="primary-button" type="button" onClick={() => router.push("/ask")}>
            {t(language, "开始提问", "Start asking")}
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <section className="story-strip">
        <article>
          <BookOpenText size={23} />
          <span>01</span>
          <h3>{t(language, "理解玩家", "Understand the player")}</h3>
          <p>{t(language, "显式偏好，不猜测你是谁。", "Explicit preferences, no hidden profiling.")}</p>
        </article>
        <article>
          <Compass size={23} />
          <span>02</span>
          <h3>{t(language, "组织证据", "Organize evidence")}</h3>
          <p>{t(language, "同语言优先，事实与推测分开。", "Same-language first; fact and theory stay separate.")}</p>
        </article>
        <article>
          <Radar size={23} />
          <span>03</span>
          <h3>{t(language, "形成行动", "Shape action")}</h3>
          <p>{t(language, "匿名问题聚合为可追溯建议。", "Anonymous questions become traceable drafts.")}</p>
        </article>
      </section>
    </div>
  );
}
