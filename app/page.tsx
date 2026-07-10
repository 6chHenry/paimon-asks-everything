"use client";

import {
  HomeAskEntry,
  HomeHeroIntel,
  HomeVideoCarousel,
} from "@/components/home-intel";
import { HomeCountdown } from "@/components/home-countdown";
import { usePreferences } from "@/components/preferences-provider";
import { SnezhnayaCharacterCarousel } from "@/components/snezhnaya-character-carousel";
import { SnezhnayaGraph } from "@/components/snezhnaya-graph";
import { snezhnayaGraph } from "@/data/snezhnaya-graph";

export default function HomePage() {
  const { preferences } = usePreferences();
  const language = preferences.language;

  return (
    <div className="home-page home-intel-page">
      <HomeCountdown language={language} />
      <HomeVideoCarousel language={language} graph={snezhnayaGraph} />
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
    </div>
  );
}
