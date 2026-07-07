"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Sparkles } from "lucide-react";
import type { Language } from "@/lib/domain";
import type { SnezhnayaGraphData } from "@/lib/snezhnaya-graph";
import { localize } from "@/lib/snezhnaya-graph";
import { t } from "@/lib/i18n";

export function SnezhnayaCharacterCarousel({
  graph,
  language,
}: {
  graph: SnezhnayaGraphData;
  language: Language;
}) {
  const [characterIndex, setCharacterIndex] = useState(0);
  const previews = graph.characterPreviews;
  const character = previews[characterIndex] ?? previews[0];

  useEffect(() => {
    if (previews.length <= 1) return;
    const timer = window.setInterval(() => {
      setCharacterIndex((current) => (current + 1) % previews.length);
    }, 6200);
    return () => window.clearInterval(timer);
  }, [previews.length]);

  if (!character) return null;

  function selectCharacter(index: number) {
    setCharacterIndex(index);
  }

  function stepCharacter(offset: number) {
    setCharacterIndex(
      (current) => (current + offset + previews.length) % previews.length,
    );
  }

  return (
    <section
      className={`snezhnaya-character-carousel tone-${character.accent} reveal delay-1`}
      aria-label={t(language, "新角色立绘", "New character artwork")}
    >
      <div
        className="snezhnaya-character-art"
        style={{
          backgroundImage: `url(${localize(character.imageUrls, language)})`,
        }}
        role="img"
        aria-label={localize(character.name, language)}
      />
      <div className="snezhnaya-character-copy" aria-live="polite">
        <span>
          <Sparkles size={14} />
          {t(language, "新角色立绘", "New character artwork")}
        </span>
        <h2>{localize(character.name, language)}</h2>
        <strong>{localize(character.title, language)}</strong>
        <p>{localize(character.roleLine, language)}</p>
        <small>{localize(character.teaser, language)}</small>
        <div className="snezhnaya-character-actions">
          <a
            href={localize(character.sourceUrls, language)}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={15} />
            {t(language, "查看原文", "View source")}
          </a>
          <div
            className="snezhnaya-character-dots"
            aria-label={t(language, "切换角色", "Switch character")}
          >
            {previews.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={index === characterIndex ? "active" : undefined}
                onClick={() => selectCharacter(index)}
                aria-label={localize(item.name, language)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="snezhnaya-character-nav">
        <button
          type="button"
          onClick={() => stepCharacter(-1)}
          aria-label={t(language, "上一个角色", "Previous character")}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => stepCharacter(1)}
          aria-label={t(language, "下一个角色", "Next character")}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
}
