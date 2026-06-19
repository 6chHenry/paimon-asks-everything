"use client";

import { useState } from "react";
import {
  Check,
  CircleX,
  FlaskConical,
  LoaderCircle,
  Play,
  ShieldCheck,
} from "lucide-react";
import { evaluationCases } from "@/data/evaluation";
import { usePreferences } from "@/components/preferences-provider";
import { t } from "@/lib/i18n";

interface EvaluationResult {
  runAt: string;
  total: number;
  passed: number;
  results: Array<{
    id: string;
    title: string;
    language: string;
    question: string;
    passed: boolean;
    checks: Record<string, boolean>;
    status: string;
    answer: string;
    checkFailures: string[];
    citations: Array<{
      id: string;
      title: string;
      sourceName: string;
      sourceKind: string;
      factStatus: string;
      external: boolean;
      excerpt: string;
    }>;
    citationCount: number;
    usedExternalSources: boolean;
  }>;
}

export default function EvaluationPage() {
  const { preferences } = usePreferences();
  const language = preferences.language;
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  async function run(caseId?: string) {
    setRunning(caseId ?? "all");
    try {
      const response = await fetch("/api/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(caseId ? { caseId } : {}),
      });
      setResult((await response.json()) as EvaluationResult);
    } finally {
      setRunning(null);
    }
  }

  const resultById = new Map(result?.results.map((item) => [item.id, item]));

  return (
    <div className="evaluation-page page-wrap">
      <section className="page-heading evaluation-heading">
        <div>
          <span className="eyebrow"><FlaskConical size={14} />{t(language, "技术评测", "Evaluation")}</span>
          <h1>{t(language, "运行检查", "Run checks")}</h1>
        </div>
        <button className="primary-button" type="button" onClick={() => void run()} disabled={Boolean(running)}>
          {running === "all" ? <LoaderCircle size={17} className="spin" /> : <Play size={17} />}
          {t(language, "运行全部 12 项", "Run all 12 cases")}
        </button>
      </section>

      <section className="eval-summary">
        <div>
          <ShieldCheck size={24} />
          <span>{t(language, "最近一次运行", "Latest run")}</span>
          <strong>{result ? new Date(result.runAt).toLocaleString(language) : t(language, "尚未运行", "Not run yet")}</strong>
        </div>
        <div className="score-ring" style={{ "--score": result ? `${(result.passed / result.total) * 360}deg` : "0deg" } as React.CSSProperties}>
          <span><strong>{result ? result.passed : "—"}</strong>/{result ? result.total : "12"}</span>
        </div>
        <p>{t(language, "联网用例受实时网络影响。", "Live-search cases depend on the network.")}</p>
      </section>

      <section className="eval-list">
        {evaluationCases.map((testCase, index) => {
          const caseResult = resultById.get(testCase.id);
          return (
            <article key={testCase.id} className={caseResult ? (caseResult.passed ? "passed" : "failed") : ""}>
              <div className="eval-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="eval-content">
                <div>
                  <span>{testCase.language}</span>
                  <span>{testCase.expected.external ? t(language, "外部搜索", "External search") : t(language, "受控流程", "Controlled flow")}</span>
                </div>
                <h2>{testCase.title}</h2>
                <p>{testCase.question}</p>
                {caseResult ? (
                  <>
                    <div className="check-row">
                      {Object.entries(caseResult.checks).map(([key, passed]) => (
                        <span key={key} className={passed ? "ok" : "bad"}>
                          {passed ? <Check size={12} /> : <CircleX size={12} />}
                          {key}
                        </span>
                      ))}
                    </div>
                    <details className="eval-review">
                      <summary>{t(language, "查看回答与引用", "Review answer & citations")}</summary>
                      <p>{caseResult.answer || t(language, "无回答文本", "No answer text")}</p>
                      <div>
                        {caseResult.citations.map((citation) => (
                          <span key={citation.id}>
                            {citation.id}: {citation.title} · {citation.sourceKind} · {citation.factStatus}
                          </span>
                        ))}
                      </div>
                      {caseResult.checkFailures.length ? (
                        <small>{t(language, "失败项：", "Failures: ")}{caseResult.checkFailures.join(", ")}</small>
                      ) : null}
                    </details>
                  </>
                ) : null}
              </div>
              <div className="eval-action">
                {caseResult ? (
                  <span className={caseResult.passed ? "result-pass" : "result-fail"}>
                    {caseResult.passed ? t(language, "通过", "Pass") : t(language, "失败", "Fail")}
                  </span>
                ) : null}
                <button type="button" onClick={() => void run(testCase.id)} disabled={Boolean(running)}>
                  {running === testCase.id ? <LoaderCircle className="spin" size={15} /> : <Play size={15} />}
                  {t(language, "运行", "Run")}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <section className="method-panel" id="method">
        <span className="section-index">METHOD</span>
        <div>
          <h2>{t(language, "评测方法边界", "Evaluation boundary")}</h2>
          <p>{t(language, "自动检查结构、引用和门控；内容质量需人工复核。", "Structure, citations, and gates are automated; content quality needs human review.")}</p>
        </div>
      </section>
    </div>
  );
}
