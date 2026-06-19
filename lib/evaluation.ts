import { evaluationCases } from "@/data/evaluation";
import { runAgent } from "@/lib/agent";
import { isWhitelistedUrl } from "@/lib/external-search";

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
      whitelist: result.citations.every(
        (citation) => !citation.external || isWhitelistedUrl(citation.url),
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
      status: result.status,
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
