import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pagePath = "app/preview/page.tsx";

const expectedCases = [
  {
    id: "sumeru-spoiler-sensitive",
    title: "剧透敏感",
    question: "我刚到须弥城，大慈树王是谁？",
    progress: "inazuma",
    spoilerPreference: "none",
  },
  {
    id: "sumeru-story-state",
    title: "剧情状态变化",
    question: "为什么我做完须弥主线后，资料里没人记得大慈树王？",
    progress: "sumeru",
    spoilerPreference: "full",
  },
  {
    id: "signora-premise-correction",
    title: "错误前提纠正",
    question: "女士是旅行者杀死的吗？",
    progress: "inazuma",
    spoilerPreference: "full",
  },
  {
    id: "paimon-official-status",
    title: "暂无官方结论",
    question: "派蒙的真实身份已经官方确认了吗？",
    progress: "nodkrai",
    spoilerPreference: "full",
  },
  {
    id: "live-wish-timeliness",
    title: "版本时效性",
    question: "现在的角色活动祈愿是谁，什么时候结束？",
    progress: "nodkrai",
    spoilerPreference: "none",
  },
] as const;

function extractCaseSource(source: string, id: string) {
  const caseSource = source.match(
    new RegExp(`  \\{\\r?\\n    id: "${id}",([\\s\\S]*?)\\r?\\n  \\},`),
  )?.[1];

  expect(caseSource, `${id} case`).toBeDefined();
  return caseSource!;
}

describe("preview capability catalogue", () => {
  it("keeps the five executable capability cases and their safeguards visible", () => {
    const source = readFileSync(pagePath, "utf8");

    for (const { id, title, question, progress, spoilerPreference } of expectedCases) {
      const caseSource = extractCaseSource(source, id);

      expect(caseSource).toContain(`title: "${title}"`);
      expect(caseSource).toContain(`question: "${question}"`);
      expect(caseSource).toContain(`progress: "${progress}"`);
      expect(caseSource).toContain(`spoilerPreference: "${spoilerPreference}"`);
      const checks = caseSource.match(
        /checks: \[([\s\S]*?)\],\r?\n    overrides:/,
      )?.[1].match(/^      "/gm);
      expect(checks, `${title} checks`).toHaveLength(3);
    }

    const liveWishCase = extractCaseSource(source, "live-wish-timeliness");
    expect(liveWishCase).toContain("查询日期");
    expect(liveWishCase).toContain("服务器时区");
    expect(liveWishCase).toContain("必须实时联网检索");
    expect(liveWishCase).toContain("当前有效的官方祈愿公告");
    expect(liveWishCase).toContain("不能依赖缓存、本地静态或训练知识");
  });

  it("refreshes the Sandrone case with current story evidence instead of speculation", () => {
    const source = readFileSync(pagePath, "utf8");
    const sandroneCase = extractCaseSource(source, "sandrone-alain");

    expect(sandroneCase).toContain('title: "旧结论及时更新"');
    expect(sandroneCase).not.toContain('title: "长尾关系检索"');
    expect(sandroneCase).toContain("当前已实装剧情证据");
    expect(sandroneCase).toContain("创造者/造物关系");
    expect(sandroneCase).toContain("旧有推测性表述");
  });
});
