import type { KnowledgeEntry, QuestionCategory } from "@/lib/domain";
import type { SearchPlan } from "@/lib/external-search";

export type LocalEvidenceReason =
  | "atomic_relationship"
  | "controlled_catch_up"
  | "layered_hint"
  | "character_arc_requires_stage_coverage"
  | "insufficient";

export interface LocalEvidenceDecision {
  sufficient: boolean;
  reason: LocalEvidenceReason;
  entryIds: string[];
}

export function assessLocalEvidenceSufficiency(input: {
  question: string;
  category: QuestionCategory;
  entries: KnowledgeEntry[];
  plan: SearchPlan;
}): LocalEvidenceDecision {
  if (input.plan.storyScope === "character_arc") {
    return {
      sufficient: false,
      reason: "character_arc_requires_stage_coverage",
      entryIds: [],
    };
  }

  const reviewed = input.entries.filter((entry) => entry.reviewed);
  const atomicRelationshipEntries =
    input.plan.intent === "relationship"
      ? reviewed.filter(
      (entry) =>
        entry.tags.includes("atomic-fact") &&
        entry.tags.includes("relationship"),
        )
      : [];
  if (atomicRelationshipEntries.length > 0) {
    return {
      sufficient: true,
      reason: "atomic_relationship",
      entryIds: atomicRelationshipEntries.map((entry) => entry.id),
    };
  }

  const catchUp =
    input.category === "version_overview" &&
    /回归|补课|停在|看懂|catch\s*up|stopped\s+after|context.*need/iu.test(
      input.question,
    ) &&
    reviewed.some((entry) => entry.tags.includes("catch-up"));
  if (catchUp) {
    return {
      sufficient: true,
      reason: "controlled_catch_up",
      entryIds: reviewed
        .filter((entry) => entry.tags.includes("catch-up"))
        .map((entry) => entry.id),
    };
  }

  const genericPuzzle =
    input.category === "gameplay" &&
    /机关|解谜|提示|puzzle|mechanism|hint/iu.test(input.question) &&
    reviewed.some((entry) =>
      ["gameplay", "puzzle", "hint"].every((tag) =>
        entry.tags.includes(tag),
      ),
    );
  if (genericPuzzle) {
    return {
      sufficient: true,
      reason: "layered_hint",
      entryIds: reviewed
        .filter((entry) =>
          ["gameplay", "puzzle", "hint"].every((tag) =>
            entry.tags.includes(tag),
          ),
        )
        .map((entry) => entry.id),
    };
  }

  return { sufficient: false, reason: "insufficient", entryIds: [] };
}
