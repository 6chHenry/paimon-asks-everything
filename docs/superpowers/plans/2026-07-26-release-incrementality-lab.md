# Release Incrementality Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend PAIMON with an interview-ready release incrementality lab that recommends which promotional video to show each player segment and separates influencer/expo incremental retention effects.

**Architecture:** A deterministic Python pipeline generates clearly labelled synthetic randomized experiments, fits interpretable uplift baselines, and writes versioned JSON artifacts. A Zod-validated Next.js server boundary exposes those artifacts to a focused client page; the LLM may explain model output but never changes numeric estimates. Existing question/preheat signals remain evidence for audience interest, not causal outcome labels.

**Tech Stack:** Python 3.12, pandas, NumPy, scikit-learn, Next.js 16, React 19, TypeScript, Zod, Vitest.

## Global Constraints

- Work on branch `codex/release-incrementality-lab`.
- Mark every modeled result as `synthetic_randomized_experiment`; never present it as real PAIMON business performance.
- Use only pre-exposure features in model inputs.
- Treat `control` as an explicit action and recommend `hold` when estimated uplift is non-positive or uncertain.
- Primary outcome is D30 retention; D7 retention and D30 LTV are supporting outcomes.
- Preserve the existing focused release-insights hierarchy: one primary decision card, compact supporting comparisons, and collapsed methodology evidence.
- Use current PAIMON semantic theme variables and lore-consistent “发行作战档案” language.
- Commit each independently testable feature separately, then run full validation and push once.

---

## File Map

- `scripts/release_lab/synthetic.py`: deterministic synthetic randomized datasets and canonical segment/treatment definitions.
- `scripts/release_lab/pv_uplift.py`: multi-treatment T-Learner, held-out policy evaluation, per-segment uplift and confidence intervals.
- `scripts/release_lab/channel_attribution.py`: 2×2 influencer/expo experiment, main/joint/interaction effects and Shapley allocation.
- `scripts/release_lab/build_reports.py`: CLI that writes stable versioned artifacts.
- `scripts/release_lab/test_release_lab.py`: Python contract, determinism, leakage and arithmetic tests.
- `artifacts/release-lab/pv-uplift.json`: committed PV decision artifact.
- `artifacts/release-lab/channel-attribution.json`: committed channel attribution artifact.
- `lib/release-lab.ts`: Zod schemas, types, artifact loader and combined report contract.
- `app/api/release-lab/route.ts`: read-only API for the combined report.
- `app/release-lab/page.tsx`: server page.
- `components/release-incrementality-lab.tsx`: focused two-scenario interview UI.
- `app/globals.css`: release-lab visual system and responsive layout.
- `components/app-shell.tsx`: navigation entry.
- `tests/release-lab.test.ts`: artifact validation and model-policy invariants.
- `tests/release-lab-ui.test.ts`: page structure, truthful labelling and navigation source checks.
- `docs/release-incrementality-interview-guide.md`: five-minute demo script, metric definitions and evidence boundaries.
- `README.md`: local generation, testing and demo commands.

---

### Task 1: PV-to-player uplift pipeline

**Files:**
- Create: `scripts/release_lab/__init__.py`
- Create: `scripts/release_lab/synthetic.py`
- Create: `scripts/release_lab/pv_uplift.py`
- Create: `scripts/release_lab/build_reports.py`
- Create: `scripts/release_lab/test_release_lab.py`
- Create: `requirements-release-lab.txt`
- Create: `artifacts/release-lab/pv-uplift.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: deterministic seed `20260726`, player segment definitions, four actions (`control`, `story_pv`, `character_pv`, `gameplay_pv`).
- Produces: `build_pv_uplift_report(seed: int = 20260726) -> dict` and a `pv-uplift.json` artifact with schema version, synthetic-data disclosure, segment recommendations, treatment estimates, held-out policy value and per-treatment AUUC.

- [ ] **Step 1: Write failing Python tests**

```python
class PvUpliftTests(unittest.TestCase):
    def test_report_is_deterministic_and_truthfully_labelled(self):
        first = build_pv_uplift_report()
        second = build_pv_uplift_report()
        self.assertEqual(first, second)
        self.assertEqual(first["dataMode"], "synthetic_randomized_experiment")

    def test_each_segment_keeps_control_and_returns_a_safe_decision(self):
        report = build_pv_uplift_report()
        for segment in report["segments"]:
            self.assertIn("control", [row["treatmentId"] for row in segment["treatments"]])
            self.assertIn(segment["decision"], {"target", "hold"})
            if segment["decision"] == "target":
                self.assertGreater(segment["recommendedUplift"]["ci95Low"], 0)
```

- [ ] **Step 2: Run tests and verify failure**

Run: `python -m unittest scripts.release_lab.test_release_lab -v`

Expected: FAIL because `synthetic` and `pv_uplift` modules do not exist.

- [ ] **Step 3: Implement deterministic randomized data and T-Learner**

Use a seeded synthetic generator with pre-exposure columns:

```python
FEATURE_COLUMNS = [
    "segment", "language", "progress_index", "days_since_login",
    "sessions_14d", "story_affinity", "character_affinity",
    "gameplay_affinity", "prior_pv_completion", "negative_feedback_30d",
]
TREATMENTS = ("control", "story_pv", "character_pv", "gameplay_pv")
```

Randomly assign treatments with equal propensity, split train/test with stratification, and fit one `LogisticRegression` pipeline per treatment. Compute `CATE_a(x) = P(Y=1|A=a,X=x) - P(Y=1|A=control,X=x)`. Bootstrap segment estimates using deterministic resamples. Set `decision="target"` only when the best non-control estimate has `ci95Low > 0`; otherwise return `control` with `decision="hold"`.

- [ ] **Step 4: Add held-out evaluation**

Compute:

```python
policy_value = mean((assigned == policy) * retained_d30 / propensity)
control_value = mean((assigned == "control") * retained_d30 / propensity)
incremental_policy_value = policy_value - control_value
```

Also report per-treatment AUUC, test sample count, randomized propensity and feature list. Never include post-exposure fields in `featureColumns`.

- [ ] **Step 5: Generate stable artifact and verify tests**

Run:

```powershell
python -m scripts.release_lab.build_reports --pv-only
python -m unittest scripts.release_lab.test_release_lab -v
```

Expected: artifact is written and all PV tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json requirements-release-lab.txt scripts/release_lab artifacts/release-lab/pv-uplift.json
git commit -m "feat: add PV uplift modeling pipeline"
```

---

### Task 2: Influencer-versus-expo causal contribution

**Files:**
- Modify: `scripts/release_lab/synthetic.py`
- Create: `scripts/release_lab/channel_attribution.py`
- Modify: `scripts/release_lab/build_reports.py`
- Modify: `scripts/release_lab/test_release_lab.py`
- Create: `artifacts/release-lab/channel-attribution.json`

**Interfaces:**
- Consumes: a randomized 2×2 dataset with `influencer_exposed` and `expo_exposed`.
- Produces: `build_channel_attribution_report(seed: int = 20260726) -> dict`, four cell summaries, D30 main/joint/interaction effects, bootstrap intervals, and Shapley allocation whose components sum to the joint uplift.

- [ ] **Step 1: Write failing contribution tests**

```python
class ChannelAttributionTests(unittest.TestCase):
    def test_has_all_four_randomized_cells(self):
        report = build_channel_attribution_report()
        self.assertEqual(
            {row["groupId"] for row in report["groups"]},
            {"control", "influencer_only", "expo_only", "both"},
        )

    def test_shapley_components_sum_to_joint_uplift(self):
        result = build_channel_attribution_report()["d30Retention"]
        allocated = result["influencer"]["shapleyPoints"] + result["expo"]["shapleyPoints"]
        self.assertAlmostEqual(allocated, result["jointUpliftPoints"], places=6)
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `python -m unittest scripts.release_lab.test_release_lab.ChannelAttributionTests -v`

Expected: FAIL because `channel_attribution` does not exist.

- [ ] **Step 3: Implement 2×2 estimates**

For cell means `mu00`, `mu10`, `mu01`, `mu11`, compute:

```python
influencer_shapley = 0.5 * ((mu10 - mu00) + (mu11 - mu01))
expo_shapley = 0.5 * ((mu01 - mu00) + (mu11 - mu10))
interaction = mu11 - mu10 - mu01 + mu00
joint = mu11 - mu00
```

Bootstrap the four-cell sample with a fixed seed and report percentile 95% intervals. Calculate percentage shares only when joint uplift is positive; label them as allocation shares, not total-retention attribution.

- [ ] **Step 4: Add funnel and evidence-strength output**

Include reservation, activation, D7 retention, D30 retention and D30 LTV for each cell. Set:

```json
{
  "dataMode": "synthetic_randomized_experiment",
  "evidenceStrength": "randomized_demo",
  "estimand": "incremental effect relative to no influencer and no expo"
}
```

- [ ] **Step 5: Generate and test**

Run:

```powershell
python -m scripts.release_lab.build_reports --channel-only
python -m unittest scripts.release_lab.test_release_lab -v
```

Expected: all Python tests PASS and Shapley components equal the joint uplift.

- [ ] **Step 6: Commit**

```powershell
git add scripts/release_lab artifacts/release-lab/channel-attribution.json
git commit -m "feat: add influencer and expo attribution model"
```

---

### Task 3: Validated Next.js report boundary

**Files:**
- Create: `lib/release-lab.ts`
- Create: `app/api/release-lab/route.ts`
- Create: `tests/release-lab.test.ts`

**Interfaces:**
- Consumes: `artifacts/release-lab/pv-uplift.json` and `channel-attribution.json`.
- Produces: `loadReleaseLabReport(): ReleaseLabReport` and `GET /api/release-lab`.

- [ ] **Step 1: Write failing Vitest contract tests**

```ts
it("loads synthetic reports with safe targeting decisions", () => {
  const report = loadReleaseLabReport();
  expect(report.pvUplift.dataMode).toBe("synthetic_randomized_experiment");
  expect(report.channelAttribution.groups).toHaveLength(4);
  for (const segment of report.pvUplift.segments) {
    if (segment.decision === "target") {
      expect(segment.recommendedUplift.ci95Low).toBeGreaterThan(0);
    }
  }
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run: `npm test -- tests/release-lab.test.ts`

Expected: FAIL because `@/lib/release-lab` does not exist.

- [ ] **Step 3: Implement Zod schemas and loader**

Define strict schemas for metadata, treatment estimates, segment decisions, evaluation, 2×2 groups and Shapley results. Parse both JSON imports at module load and return:

```ts
export interface ReleaseLabReport {
  pvUplift: PvUpliftReport;
  channelAttribution: ChannelAttributionReport;
}
```

- [ ] **Step 4: Add read-only API route**

Return `NextResponse.json(loadReleaseLabReport())`; do not invoke Python or mutate artifacts at request time.

- [ ] **Step 5: Test and commit**

Run:

```powershell
npm test -- tests/release-lab.test.ts
npm run typecheck
git add lib/release-lab.ts app/api/release-lab/route.ts tests/release-lab.test.ts
git commit -m "feat: expose validated release lab reports"
```

Expected: focused test and typecheck PASS.

---

### Task 4: Interview-focused release lab UI

**Files:**
- Create: `app/release-lab/page.tsx`
- Create: `components/release-incrementality-lab.tsx`
- Modify: `components/app-shell.tsx`
- Modify: `app/globals.css`
- Create: `tests/release-lab-ui.test.ts`

**Interfaces:**
- Consumes: `ReleaseLabReport`.
- Produces: `/release-lab` with `pv` and `attribution` scenario tabs, segment selection, one primary recommendation, compact matrices and a collapsed evidence dossier.

- [ ] **Step 1: Write failing UI source tests**

```ts
it("keeps synthetic evidence and control language visible", () => {
  const source = readFileSync("components/release-incrementality-lab.tsx", "utf8");
  expect(source).toContain("合成随机实验");
  expect(source).toContain("不触达");
  expect(source).toContain("95% 区间");
  expect(source).toContain("Holdout");
});

it("adds the release lab to navigation", () => {
  const shell = readFileSync("components/app-shell.tsx", "utf8");
  expect(shell).toContain('href: "/release-lab"');
});
```

- [ ] **Step 2: Run focused UI test and verify failure**

Run: `npm test -- tests/release-lab-ui.test.ts`

Expected: FAIL because page and component do not exist.

- [ ] **Step 3: Implement the page and primary PV decision**

Use a refined “发行作战档案” direction: parchment-dark navy layers, gold decision marks, restrained data red/green, numbered evidence stamps and a single dominant recommendation card. The card must show selected segment, recommended action or hold, estimated D30 uplift, 95% interval, reason codes and a 10% holdout instruction.

- [ ] **Step 4: Implement PV matrix and channel scenario**

The PV matrix displays each segment against each non-control PV with signed percentage-point uplift. The channel tab displays joint uplift first, then influencer/expo Shapley shares and the four experimental cells. Copy explicitly distinguishes “联合增量分摊” from “全部留存占比”.

- [ ] **Step 5: Add collapsed methodology dossier and responsive CSS**

The closed-by-default dossier shows data mode, feature window, model, test size, policy-value estimate, four-cell formulas and real-production replacement steps. Respect reduced motion and support 360px mobile width.

- [ ] **Step 6: Add navigation, run checks and commit**

Run:

```powershell
npm test -- tests/release-lab-ui.test.ts tests/release-lab.test.ts
npm run typecheck
npm run build
git add app/release-lab components/release-incrementality-lab.tsx components/app-shell.tsx app/globals.css tests/release-lab-ui.test.ts
git commit -m "feat: add release incrementality interview lab"
```

Expected: focused tests, typecheck and production build PASS.

---

### Task 5: Interview guide and final verification

**Files:**
- Create: `docs/release-incrementality-interview-guide.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the completed model artifacts and UI.
- Produces: exact five-minute demonstration order, 60-second attribution answer, limitations, local commands and metric glossary.

- [ ] **Step 1: Write the guide**

Document:

1. PAIMON interest signal versus causal outcome distinction.
2. PV segment-selection demo.
3. Hold/control behavior.
4. Influencer/expo 2×2 decomposition and Shapley wording.
5. Synthetic-data disclosure and real rollout plan.
6. Defensive answers for response prediction versus uplift, no-randomization fallback, confidence intervals and why the LLM does not produce numeric effects.

- [ ] **Step 2: Update README commands**

Add:

```powershell
python -m pip install -r requirements-release-lab.txt
npm run report:release-lab
npm run test:release-lab
npm run dev
```

Link `/release-lab` and the interview guide.

- [ ] **Step 3: Run final validation**

Run:

```powershell
npm run report:release-lab
npm run test:release-lab
npm test
npm run typecheck
npm run build
git diff --check
git status --short
```

Expected: reports regenerate without drift; all Python and Vitest tests, typecheck and build PASS; only intended files remain.

- [ ] **Step 4: Commit**

```powershell
git add README.md docs/release-incrementality-interview-guide.md
git commit -m "docs: add release lab interview walkthrough"
```

- [ ] **Step 5: Push once**

```powershell
git push -u origin codex/release-incrementality-lab
```

Expected: remote tracking branch is created and local HEAD equals `origin/codex/release-incrementality-lab`.

