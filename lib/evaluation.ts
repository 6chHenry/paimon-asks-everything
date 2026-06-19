import { evaluationCases } from "@/data/evaluation";
import { runAgent } from "@/lib/agent";

const allowedExternalSourceKinds = new Set([
  "official",
  "trusted_wiki",
  "community",
  "unknown_web",
]);

export async function runEvaluation(caseId?: string) {
  const selected = caseId
    ? evaluationCases.filter((item) => item.id === caseId)
    : evaluationCases;

  const results = [];
  for (const testCase of selected) {
    const result = await runAgent(
      {
        question: testCase.question,
        language: testCase.language,
        profile: testCase.profile,
        progress: testCase.progress,
        spoilerPreference: testCase.spoilerPreference,
        focus: testCase.focus,
        allowQuestionTextStorage: false,
        sessionId: `evaluation-${testCase.id}`,
      },
      { recordEvent: false },
    );
    const checks = {
      status:
        !testCase.expected.status ||
        result.status === testCase.expected.status,
      controlled:
        testCase.expected.controlled === undefined ||
        testCase.expected.controlled ===
          result.citations.some((citation) => !citation.external),
      external:
        testCase.expected.external === undefined ||
        testCase.expected.external === result.usedExternalSources,
      citation:
        testCase.expected.citation === undefined ||
        testCase.expected.citation === result.citations.length > 0,
      category:
        !testCase.expected.category ||
        result.eventClassification.questionCategory ===
          testCase.expected.category,
      sourceClassified: result.citations.every(
        (citation) =>
          !citation.external || allowedExternalSourceKinds.has(citation.sourceKind),
      ),
      structured:
        Boolean(result.language) &&
        Boolean(result.answerMode) &&
        Array.isArray(result.claims) &&
        Array.isArray(result.citations),
      spoilerGate:
        testCase.expected.status !== "spoiler_confirmation_required" ||
        result.spoilerAction === "confirmation_required",
    };
    results.push({
      id: testCase.id,
      title: testCase.title,
      language: testCase.language,
      question: testCase.question,
      passed: Object.values(checks).every(Boolean),
      checks,
      checkFailures: Object.entries(checks)
        .filter(([, passed]) => !passed)
        .map(([key]) => key),
      status: result.status,
      answer: result.answer,
      citations: result.citations.map((citation) => ({
        id: citation.id,
        title: citation.title,
        sourceName: citation.sourceName,
        sourceKind: citation.sourceKind,
        factStatus: citation.factStatus,
        external: citation.external,
        excerpt: citation.excerpt,
      })),
      citationCount: result.citations.length,
      usedExternalSources: result.usedExternalSources,
    });
  }
  return {
    runAt: new Date().toISOString(),
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    results,
  };
}
