"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Beaker,
  ChevronRight,
  CircleOff,
  FileSearch,
  FlaskConical,
  Gauge,
  MapPinned,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import type {
  ChannelAttributionReport,
  PvUpliftReport,
  ReleaseLabReport,
} from "@/lib/release-lab";

type Scenario = "pv" | "attribution";
type SegmentDecision = PvUpliftReport["segments"][number];

function signedPoints(value: number) {
  if (value === 0) return "0.00 pp";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)} pp`;
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function share(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function interval(low: number, high: number) {
  return `${signedPoints(low)} ～ ${signedPoints(high)}`;
}

function pvCellTone(value: number) {
  if (value >= 5) return "strong";
  if (value >= 1) return "positive";
  if (value > -1) return "uncertain";
  return "negative";
}

export function ReleaseIncrementalityLab({
  report,
}: {
  report: ReleaseLabReport;
}) {
  const [scenario, setScenario] = useState<Scenario>("pv");
  const [segmentId, setSegmentId] = useState(
    report.pvUplift.segments[0]?.segmentId ?? "",
  );
  const selectedSegment = useMemo(
    () =>
      report.pvUplift.segments.find(
        (segment) => segment.segmentId === segmentId,
      ) ?? report.pvUplift.segments[0],
    [report.pvUplift.segments, segmentId],
  );

  return (
    <main className="release-lab-page">
      <header className="release-lab-hero">
        <div>
          <span className="release-lab-eyebrow">
            <FlaskConical size={15} aria-hidden="true" />
            RELEASE INCREMENTALITY LAB · 发行作战档案
          </span>
          <h1>发行作战方案</h1>
        </div>
        <aside className="release-lab-disclosure">
          <Beaker size={20} aria-hidden="true" />
          <div>
            <strong>合成随机实验</strong>
            <span>方法演示 · 非真实业务效果</span>
          </div>
        </aside>
      </header>

      <nav className="release-lab-tabs" aria-label="实验场景" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={scenario === "pv"}
          className={scenario === "pv" ? "active" : ""}
          onClick={() => setScenario("pv")}
        >
          <Target size={17} aria-hidden="true" />
          <span>
            <strong>PV × 玩家</strong>
            <small>给谁看什么</small>
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scenario === "attribution"}
          className={scenario === "attribution" ? "active" : ""}
          onClick={() => setScenario("attribution")}
        >
          <MapPinned size={17} aria-hidden="true" />
          <span>
            <strong>达人 × 展会</strong>
            <small>增量如何拆分</small>
          </span>
        </button>
      </nav>

      {scenario === "pv" && selectedSegment ? (
        <PvDecisionPanel
          report={report.pvUplift}
          selected={selectedSegment}
          onSelect={setSegmentId}
        />
      ) : (
        <ChannelAttributionPanel report={report.channelAttribution} />
      )}

      <MethodologyDossier report={report} />
    </main>
  );
}

function PvDecisionPanel({
  report,
  selected,
  onSelect,
}: {
  report: PvUpliftReport;
  selected: SegmentDecision;
  onSelect: (segmentId: string) => void;
}) {
  const isHold = selected.decision === "hold";
  const nonControlTreatments = report.treatments.filter(
    (treatment) => treatment.id !== "control",
  );

  return (
    <section className="release-lab-scenario" aria-label="PV 人群触达决策">
      <div className="release-lab-segment-picker" aria-label="选择玩家人群">
        <span>选择观察对象</span>
        <div>
          {report.segments.map((segment) => (
            <button
              type="button"
              key={segment.segmentId}
              className={
                segment.segmentId === selected.segmentId ? "active" : ""
              }
              aria-pressed={segment.segmentId === selected.segmentId}
              onClick={() => onSelect(segment.segmentId)}
            >
              {segment.labelZh}
            </button>
          ))}
        </div>
      </div>

      <article
        className={`release-lab-primary${isHold ? " is-hold" : ""}`}
      >
        <div className="release-lab-primary-index" aria-hidden="true">
          {isHold ? "HOLD" : "01"}
        </div>
        <div className="release-lab-primary-copy">
          <span className="release-lab-decision-label">
            {isHold ? (
              <CircleOff size={16} aria-hidden="true" />
            ) : (
              <BadgeCheck size={16} aria-hidden="true" />
            )}
            {isHold ? "证据不足 · 保留自然行为" : "建议进入小流量验证"}
          </span>
          <h2>
            {isHold ? (
              <>
                对“{selected.labelZh}”<em>暂不触达</em>
              </>
            ) : (
              <>
                向“{selected.labelZh}”投放
                <em>{selected.recommendedTreatmentLabelZh}</em>
              </>
            )}
          </h2>
          <p>
            {isHold
              ? "当前最佳动作的 95% 区间仍跨过业务阈值。与其制造打扰，不如保留对照并继续收集样本。"
              : "该动作相对“不触达”对照组的 D30 留存增量通过了 1 pp 业务阈值，适合先验证、再放量。"}
          </p>
          <div className="release-lab-reasons">
            {selected.reasonCodesZh.map((reason) => (
              <span key={reason}>
                <ChevronRight size={13} aria-hidden="true" />
                {reason}
              </span>
            ))}
          </div>
        </div>

        <aside className="release-lab-primary-metric">
          <small>预计 D30 留存增量</small>
          <strong>
            {isHold
              ? "不触达"
              : signedPoints(selected.recommendedUplift.points)}
          </strong>
          <span>
            95% 区间：
            {interval(
              selected.recommendedUplift.ci95Low,
              selected.recommendedUplift.ci95High,
            )}
          </span>
          <div>
            <ShieldCheck size={15} aria-hidden="true" />
            {Math.round(selected.holdoutRate * 100)}% Holdout
            {isHold ? " 继续学习" : " 验证增量"}
          </div>
        </aside>
      </article>

      <section className="release-lab-matrix-section">
        <header>
          <div>
            <span>DECISION MATRIX</span>
            <h3>PV × 玩家增量矩阵</h3>
          </div>
          <p>每个数字都是相对“不触达”的 D30 留存百分点变化。</p>
        </header>
        <div className="release-lab-table-scroll">
          <table className="release-lab-matrix">
            <thead>
              <tr>
                <th>玩家人群</th>
                {nonControlTreatments.map((treatment) => (
                  <th key={treatment.id}>{treatment.labelZh}</th>
                ))}
                <th>策略</th>
              </tr>
            </thead>
            <tbody>
              {report.segments.map((segment) => (
                <tr
                  key={segment.segmentId}
                  className={
                    segment.segmentId === selected.segmentId ? "active" : ""
                  }
                  onClick={() => onSelect(segment.segmentId)}
                >
                  <th>{segment.labelZh}</th>
                  {nonControlTreatments.map((treatment) => {
                    const estimate = segment.treatments.find(
                      (item) => item.treatmentId === treatment.id,
                    );
                    const value = estimate?.upliftPoints ?? 0;
                    return (
                      <td key={treatment.id}>
                        <span className={pvCellTone(value)}>
                          {signedPoints(value)}
                        </span>
                      </td>
                    );
                  })}
                  <td>
                    <b className={segment.decision}>
                      {segment.decision === "target"
                        ? segment.recommendedTreatmentLabelZh
                        : "不触达"}
                    </b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function ChannelAttributionPanel({
  report,
}: {
  report: ChannelAttributionReport;
}) {
  const result = report.d30Retention;
  return (
    <section
      className="release-lab-scenario"
      aria-label="达人和展会增量归因"
    >
      <article className="release-lab-primary release-lab-attribution-primary">
        <div className="release-lab-primary-index" aria-hidden="true">
          2×2
        </div>
        <div className="release-lab-primary-copy">
          <span className="release-lab-decision-label">
            <BadgeCheck size={16} aria-hidden="true" />
            四组随机分流 · 联合效果可识别
          </span>
          <h2>
            达人与展会共同带来
            <em>{signedPoints(result.jointUpliftPoints)}</em>
          </h2>
          <p>
            基准组 D30 留存 {percent(result.baselineRate)}，联合组{" "}
            {percent(result.jointRate)}。以下只拆联合增量，不是全部留存的来源占比。
          </p>
          <div className="release-lab-reasons">
            <span>
              <ChevronRight size={13} aria-hidden="true" />
              达人和展会分别存在独立变化
            </span>
            <span>
              <ChevronRight size={13} aria-hidden="true" />
              协同项单独报告，不藏进渠道信用
            </span>
          </div>
        </div>
        <aside className="release-lab-primary-metric">
          <small>联合增量 · D30 留存</small>
          <strong>{signedPoints(result.jointUpliftPoints)}</strong>
          <span>
            95% 区间：
            {interval(
              result.jointInterval.ci95Low,
              result.jointInterval.ci95High,
            )}
          </span>
          <div>
            <Activity size={15} aria-hidden="true" />
            协同项 {signedPoints(result.interactionPoints)}
          </div>
        </aside>
      </article>

      <div className="release-lab-allocation">
        <AllocationCard
          index="A"
          title="达人内容"
          allocation={result.influencer}
        />
        <AllocationCard
          index="B"
          title="线下展会"
          allocation={result.expo}
        />
      </div>

      <section className="release-lab-factorial">
        <header>
          <div>
            <span>FACTORIAL EVIDENCE</span>
            <h3>2×2 实验单元</h3>
          </div>
          <p>路径追踪解释“从哪来”，随机对照回答“不做会少多少”。</p>
        </header>
        <div className="release-lab-table-scroll">
          <table>
            <thead>
              <tr>
                <th>实验组</th>
                <th>达人</th>
                <th>展会</th>
                <th>预约</th>
                <th>激活</th>
                <th>D7</th>
                <th>D30</th>
                <th>D30 LTV</th>
              </tr>
            </thead>
            <tbody>
              {report.groups.map((group) => (
                <tr key={group.groupId}>
                  <th>{group.labelZh}</th>
                  <td>{group.influencer ? "✓" : "—"}</td>
                  <td>{group.expo ? "✓" : "—"}</td>
                  <td>{percent(group.reservationRate)}</td>
                  <td>{percent(group.activationRate)}</td>
                  <td>{percent(group.d7RetentionRate)}</td>
                  <td>{percent(group.d30RetentionRate)}</td>
                  <td>¥{group.averageLtv30.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function AllocationCard({
  index,
  title,
  allocation,
}: {
  index: string;
  title: string;
  allocation: ChannelAttributionReport["d30Retention"]["influencer"];
}) {
  return (
    <article>
      <span>{index}</span>
      <div>
        <small>联合增量 Shapley 分摊</small>
        <h3>{title}</h3>
        <p>
          {signedPoints(allocation.shapleyPoints)}
          <strong>{share(allocation.allocationShare)}</strong>
        </p>
        <em>
          95% 区间：
          {interval(allocation.ci95Low, allocation.ci95High)}
        </em>
      </div>
    </article>
  );
}

function MethodologyDossier({ report }: { report: ReleaseLabReport }) {
  return (
    <details className="release-lab-methodology">
      <summary>
        <span>
          <FileSearch size={17} aria-hidden="true" />
          打开方法与证据档案
        </span>
        <small>模型、标签窗口、评估指标与真实接入方案</small>
      </summary>
      <div className="release-lab-methodology-grid">
        <section>
          <span>01 · 决策对象</span>
          <h3>动作，不是人群分数</h3>
          <p>
            对每类玩家比较剧情、角色、玩法 PV 与“不触达”控制，估计
            CATE 后才选择动作。
          </p>
        </section>
        <section>
          <span>02 · 数据边界</span>
          <h3>结果期不会进入特征</h3>
          <p>
            {report.pvUplift.outcome.featureWindowZh}；主标签为
            {report.pvUplift.outcome.labelWindowZh}。
          </p>
        </section>
        <section>
          <span>03 · 模型闸门</span>
          <h3>区间先过 1 pp</h3>
          <p>
            只有 95% 区间下界超过业务阈值才触达，否则 Holdout
            继续学习。
          </p>
        </section>
        <section>
          <span>04 · 离线评估</span>
          <h3>策略价值，不只看 AUC</h3>
          <p>
            测试集 {report.pvUplift.evaluation.testSamples.toLocaleString()}
            人；离线策略相对控制提升{" "}
            {signedPoints(
              report.pvUplift.evaluation.incrementalPolicyValuePoints,
            )}。
          </p>
        </section>
        <section>
          <span>05 · 归因口径</span>
          <h3>增量与协同分开</h3>
          <p>
            Shapley 只分配联合增量；因果证据来自四组随机实验，而不是
            Last-click 信用。
          </p>
        </section>
        <section>
          <span>06 · 真实上线</span>
          <h3>用实验日志替换合成数据</h3>
          <p>
            保留匿名分流、动作、成本和 D7/D30 结果。无法个人随机时改用
            Geo-lift 或分批上线 DID。
          </p>
        </section>
      </div>
      <footer>
        <Gauge size={15} aria-hidden="true" />
        模型：{report.pvUplift.methodology.model}
        <span>·</span>
        <UsersRound size={15} aria-hidden="true" />
        2×2 样本：
        {report.channelAttribution.assignment.sampleSize.toLocaleString()}
        <span>·</span>
        <Sparkles size={15} aria-hidden="true" />
        LLM 只解释结果，不修改数值
      </footer>
    </details>
  );
}
