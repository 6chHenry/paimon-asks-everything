"use client";

import {
  Compass,
  Feather,
  ShieldCheck,
  Snowflake,
  Sparkles,
} from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";

const content = {
  "zh-CN": {
    eyebrow: "PAIMON FIELD NOTE · 00",
    title: "关于",
    lead: "如果派蒙不只记得旅行，也能帮旅行者重新找到进入故事的路呢？",
    sections: [
      [
        "为什么需要它",
        "原神的世界观不断扩展。新玩家需要一个清楚的入口，回归玩家也需要重新接上曾经走过的任务、人物与线索。",
      ],
      [
        "为什么要控制剧透",
        "理解不该以牺牲探索乐趣为代价。答案需要知道玩家走到了哪里，也要知道何时停下来，把真正重要的发现留在游戏里。",
      ],
      [
        "为什么是派蒙",
        "派蒙本来就是旅行者的向导。知识、语气和陪伴感应该来自同一个角色，而不是一个脱离提瓦特世界的搜索框。",
      ],
      [
        "为什么是现在",
        "至冬临近，许多长久埋下的伏笔开始收束。回应旧线索、铺设新期待，才能让仍在延伸的提瓦特继续吸引玩家。",
      ],
    ],
    noteTitle: "最初的问题",
    note: "能不能把原本由 Wiki 和人工向导笔记承担的理解工作，写进游戏世界本身？",
    closing: "让玩家更容易进入故事，而不是替玩家经历故事。",
    signature: "一份写给旅行者的向导实验",
  },
  en: {
    eyebrow: "PAIMON FIELD NOTE · 00",
    title: "About",
    lead: "What if Paimon could do more than remember the journey—and help every Traveler find their way back into the story?",
    sections: [
      [
        "Why it needs to exist",
        "Genshin's world keeps expanding. New players need a clear entry point; returning players need a way to reconnect the quests, characters, and clues they once followed.",
      ],
      [
        "Why spoilers must be controlled",
        "Understanding should not cost the joy of discovery. An answer must know how far the player has traveled—and when to stop, leaving the most meaningful discoveries inside the game.",
      ],
      [
        "Why Paimon",
        "Paimon is already the Traveler's guide. Knowledge, voice, and companionship should come from one character, not a search box outside the world of Teyvat.",
      ],
      [
        "Why now",
        "As Snezhnaya approaches, long-running clues begin to converge. Resolving old threads while planting new expectations keeps an ever-growing Teyvat worth returning to.",
      ],
    ],
    noteTitle: "The first question",
    note: "Could the guidance now carried by wikis and hand-written notes become part of the game world itself?",
    closing: "Help players enter the story—never experience it in their place.",
    signature: "A guide experiment for every Traveler",
  },
} as const;

const sectionIcons = [Compass, ShieldCheck, Feather, Snowflake] as const;

export default function AboutPage() {
  const { preferences } = usePreferences();
  const copy = content[preferences.language];

  return (
    <div className="about-page">
      <article className="about-sheet">
        <header className="about-heading">
          <div>
            <span className="about-eyebrow">
              <Sparkles size={13} aria-hidden="true" />
              {copy.eyebrow}
            </span>
            <h1>{copy.title}</h1>
            <p>{copy.lead}</p>
          </div>
          <div className="about-compass-mark" aria-hidden="true">
            <Compass size={34} strokeWidth={1.25} />
          </div>
        </header>

        <div className="about-story-grid">
          <div className="about-story-main">
            {copy.sections.map(([title, body], index) => {
              const Icon = sectionIcons[index]!;
              return (
                <section className="about-story-section" key={title}>
                  <span className="about-story-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="about-story-icon" aria-hidden="true">
                    <Icon size={17} />
                  </span>
                  <div>
                    <h2>{title}</h2>
                    <p>{body}</p>
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="about-margin-note">
            <span>{copy.noteTitle}</span>
            <p>{copy.note}</p>
            <div className="about-note-orbit" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </aside>
        </div>

        <footer className="about-closing">
          <blockquote>{copy.closing}</blockquote>
          <span>{copy.signature}</span>
        </footer>
      </article>
    </div>
  );
}
