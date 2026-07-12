import { describe, expect, it } from "vitest";
import {
  customTopicKeywordsByRegion,
  getCustomTopicCandidates,
} from "@/data/custom-topic-candidates";

describe("custom topic candidates", () => {
  it("contains playable characters and story-critical NPCs for every region", () => {
    expect(customTopicKeywordsByRegion.mondstadt).toEqual(
      expect.arrayContaining(["温迪", "法尔伽"]),
    );
    expect(customTopicKeywordsByRegion.liyue).toContain("钟离");
    expect(customTopicKeywordsByRegion.fontaine).toContain("那维莱特");
    expect(customTopicKeywordsByRegion.snezhnaya).toContain("冰之女皇");
  });

  it("ranks current-region names first and returns no more than four matches", () => {
    expect(getCustomTopicCandidates("mondstadt", "温")[0]).toBe("温迪");
    expect(getCustomTopicCandidates("liyue", "钟")[0]).toBe("钟离");
    expect(getCustomTopicCandidates("fontaine", "水仙")[0]).toBe("水仙十字结社");
    expect(getCustomTopicCandidates("sumeru", "")).toEqual([]);
    expect(getCustomTopicCandidates("mondstadt", "阿").length).toBeLessThanOrEqual(4);
  });
});
