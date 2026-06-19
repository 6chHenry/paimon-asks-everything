import { describe, expect, it } from "vitest";
import { formatTraceSse, makeTraceEvent } from "@/lib/trace";

describe("trace events", () => {
  it("formats trace events as server-sent events", () => {
    const event = makeTraceEvent({
      stage: "search",
      status: "running",
      message: "Searching web evidence",
      detail: "Genshin Impact Wiki",
    });

    expect(formatTraceSse("trace", event)).toContain("event: trace\n");
    expect(formatTraceSse("trace", event)).toContain('"stage":"search"');
    expect(event.id).toBeTruthy();
    expect(event.at).toBeTruthy();
  });
});
