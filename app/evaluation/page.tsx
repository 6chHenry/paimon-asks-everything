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
          <span className="eyebrow"><FlaskConical size={14} />{t(language, "可重复技术证据", "Repeatable technical evidence")}</span>
          <h1>{t(language, "把“它应该可以”变成一组可以重跑的检查。", "Turn “it should work” into checks you can rerun.")}</h1>
          <p>{t(language, "检索命中、引用、白名单、结构和剧透门控使用确定性检查；表达质量仍保留人工审核位置。", "Retrieval hits, citations, source allowlists, structure, and spoiler gates use deterministic checks. Answer quality still reserves a human-review lane.")}</p>
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
        <p>{t(language, "外部搜索用例依赖实时 Wiki 网络；网络不可用时会作为代表性失败保留，而不是伪造通过。", "The external-search case depends on the live wiki. Network failure remains visible as a representative failure instead of being papered over.")}</p>
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
                  <div className="check-row">
                    {Object.entries(caseResult.checks).map(([key, passed]) => (
                      <span key={key} className={passed ? "ok" : "bad"}>
                        {passed ? <Check size={12} /> : <CircleX size={12} />}
                        {key}
                      </span>
                    ))}
                  </div>
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
          <p>{t(language, "确定性检查适合验证“有没有引用”“是否命中白名单”“Level 3 是否被拦截”。回答是否真正解决玩家问题、语气是否自然、本地化差异是否表达准确，仍应由人审核。", "Deterministic checks are suited to citation presence, source allowlists, and Level 3 gating. Whether an answer truly solves the player’s problem, sounds natural, and handles localization nuance still requires human review.")}</p>
        </div>
      </section>
    </div>
  );
}
