import type { Profile } from "@/lib/domain";

export type VisibleProfile = Extract<
  Profile,
  "new" | "returning" | "story"
>;

export const visibleProfiles = ["new", "returning", "story"] as const satisfies
  readonly VisibleProfile[];

export function normalizeVisibleProfile(value: unknown): VisibleProfile {
  return value === "new" || value === "story" || value === "returning"
    ? value
    : "returning";
}
