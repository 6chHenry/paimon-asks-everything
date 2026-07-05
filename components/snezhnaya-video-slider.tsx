"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Play,
  Sparkles,
} from "lucide-react";
import type { Language } from "@/lib/domain";
import { t } from "@/lib/i18n";
import type { SnezhnayaGraphData } from "@/lib/snezhnaya-graph";
import { localize } from "@/lib/snezhnaya-graph";

export function SnezhnayaVideoSlider({
  graph,
  language,
}: {
  graph: SnezhnayaGraphData;
  language: Language;
}) {
  const [videoIndex, setVideoIndex] = useState(0);
  const video = graph.videos[videoIndex] ?? graph.videos[0];

  if (!video) return null;

  return (
    <div className="snezhnaya-video-slider">
      <div className="snezhnaya-video-slider-body">
        <div
          className="snezhnaya-video-cover"
          style={{ backgroundImage: `url(${video.coverImageUrl})` }}
        >
          <span className="snezhnaya-video-badge">
            <Sparkles size={15} />
            {t(language, "至冬预热", "Snezhnaya preheat")}
          </span>
        </div>
        <div className="snezhnaya-video-copy">
          <h1>{localize(video.title, language)}</h1>
          <p>{localize(video.description, language)}</p>
          <div className="snezhnaya-video-actions">
            <a href={video.youtubeUrls[language]} target="_blank" rel="noreferrer">
              <Play size={16} />
              YouTube
            </a>
            <a href={video.miyousheUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} />
              {t(language, "米游社", "Miyoushe")}
            </a>
          </div>
        </div>
      </div>
      <div className="snezhnaya-video-nav">
        <button
          type="button"
          className="snezhnaya-video-nav-arrow"
          onClick={() =>
            setVideoIndex(
              (videoIndex - 1 + graph.videos.length) % graph.videos.length,
            )
          }
          aria-label={t(language, "上一个视频", "Previous video")}
        >
          <ChevronLeft size={22} />
        </button>
        <div className="snezhnaya-video-dots">
          {graph.videos.map((_, index) => (
            <button
              key={index}
              type="button"
              className={index === videoIndex ? "dot active" : "dot"}
              onClick={() => setVideoIndex(index)}
              aria-label={t(
                language,
                `切换至第 ${index + 1} 个视频`,
                `Go to video ${index + 1}`,
              )}
            />
          ))}
        </div>
        <button
          type="button"
          className="snezhnaya-video-nav-arrow"
          onClick={() => setVideoIndex((videoIndex + 1) % graph.videos.length)}
          aria-label={t(language, "下一个视频", "Next video")}
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}
