import type { ReadingResource } from "@/lib/domain";

export interface CuratedStoryResource extends ReadingResource {
  aliases: string[];
}

export const curatedStoryResources: CuratedStoryResource[] = [
  {
    id: "narzissenkreuz-text-index-zh",
    title: "水仙十字结社剧情文本索引",
    url: "https://wiki.biligame.com/ys/%E6%B0%B4%E4%BB%99%E5%8D%81%E5%AD%97%E7%BB%93%E7%A4%BE",
    platform: "原神 WIKI_BWIKI",
    kind: "official_text",
    authority: "reference",
    spoilerLevel: 3,
    reason: "社区整理的游戏内剧情文本索引，适合按任务回查原文。",
    language: "zh-CN",
    aliases: ["水仙十字", "水仙十字结社", "水仙十字院", "narzissenkreuz"],
  },
  {
    id: "narzissenkreuz-video-guide-zh",
    title: "水仙十字系列世界任务剧情梳理",
    url: "https://www.bilibili.com/video/BV1EN411u7wM/",
    platform: "Bilibili",
    kind: "analysis_video",
    authority: "community",
    spoilerLevel: 3,
    reason: "按任务线梳理人物和事件，适合完成相关任务后复盘。",
    language: "zh-CN",
    aliases: ["水仙十字", "水仙十字结社", "水仙十字院"],
  },
  {
    id: "narzissenkreuz-discussion-zh",
    title: "水仙十字系列剧情梳理与解析",
    url: "https://zhuanlan.zhihu.com/p/668052393",
    platform: "知乎",
    kind: "discussion",
    authority: "community",
    spoilerLevel: 3,
    reason: "多角度社区讨论，适合在掌握主线后选择性阅读。",
    language: "zh-CN",
    aliases: ["水仙十字", "水仙十字结社", "水仙十字院"],
  },
];
