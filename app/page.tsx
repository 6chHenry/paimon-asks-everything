"use client";

import {
  HomeAskEntry,
  HomeHeroIntel,
  HomeVideoCarousel,
  TravelerContextDrawer,
} from "@/components/home-intel";
import { HomeCountdown } from "@/components/home-countdown";
import { usePreferences } from "@/components/preferences-provider";
import { SnezhnayaCharacterCarousel } from "@/components/snezhnaya-character-carousel";
import { SnezhnayaGraph } from "@/components/snezhnaya-graph";
import { snezhnayaGraph } from "@/data/snezhnaya-graph";
import type {
  Focus,
  Profile,
  Progress,
} from "@/lib/domain";
import { labels } from "@/lib/i18n";

const profileDescriptions = {
  new: ["先解释阵营和术语", "Explain factions and terms first"],
  returning: ["只补进入至冬前的必要背景", "Only the context needed before Snezhnaya"],
  story: ["展开证据、人物与伏笔", "Open evidence, characters, and threads"],
  exploration: ["轻量理解大世界文本", "Light context from world text"],
  casual: ["先看核心卖点", "Start with the main hook"],
};

export default function HomePage() {
  const { preferences, setPreferences } = usePreferences();
  const language = preferences.language;
  const isZh = language === "zh-CN";

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
    <div className="home-page home-intel-page">
      <HomeVideoCarousel language={language} graph={snezhnayaGraph} />
      <HomeCountdown language={language} />
      <SnezhnayaCharacterCarousel language={language} graph={snezhnayaGraph} />
      <HomeHeroIntel
        language={language}
        graph={snezhnayaGraph}
        graphHref="#snezhnaya-graph"
      />
      <section id="snezhnaya-graph" className="home-full-graph">
        <SnezhnayaGraph
          graph={snezhnayaGraph}
          showVideos={false}
        />
      </section>
      <HomeAskEntry language={language} />
      <TravelerContextDrawer
        language={language}
        profile={preferences.profile}
        progress={preferences.progress}
        focus={preferences.focus}
        allowQuestionTextStorage={preferences.allowQuestionTextStorage}
        profileItems={profileItems}
        progressItems={progressItems}
        onSelectProfile={(profile) =>
          setPreferences((current) => ({ ...current, profile }))
        }
        onSelectProgress={(progress) =>
          setPreferences((current) => ({ ...current, progress }))
        }
        onToggleFocus={toggleFocus}
        onToggleStorage={(allowQuestionTextStorage) =>
          setPreferences((current) => ({
            ...current,
            allowQuestionTextStorage,
          }))
        }
      />
    </div>
  );
}
