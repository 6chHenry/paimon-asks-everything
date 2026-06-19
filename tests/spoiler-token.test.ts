import { describe, expect, it } from "vitest";
import { createSpoilerToken, verifySpoilerToken } from "@/lib/spoiler-token";

describe("spoiler confirmation token", () => {
  it("is bound to the exact normalized question", () => {
    const token = createSpoilerToken("Is Sandrone really Alain?");
    expect(verifySpoilerToken(token, " is sandrone really alain? ")).toBe(true);
    expect(verifySpoilerToken(token, "Is Sandrone Mary-Ann?")).toBe(false);
  });
});
