from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from scripts.release_lab.synthetic import (
    CATEGORICAL_FEATURES,
    DEFAULT_SEED,
    FEATURE_COLUMNS,
    NUMERIC_FEATURES,
    PV_TREATMENTS,
    SEGMENTS,
    TREATMENT_IDS,
    generate_pv_experiment,
)

OUTCOME_COLUMN = "retained_d30"


def _round(value: float, digits: int = 4) -> float:
    return float(round(float(value), digits))


def _model(seed: int) -> Pipeline:
    preprocess = ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore"),
                list(CATEGORICAL_FEATURES),
            ),
            (
                "numeric",
                StandardScaler(),
                list(NUMERIC_FEATURES),
            ),
        ]
    )
    return Pipeline(
        steps=[
            ("preprocess", preprocess),
            (
                "classifier",
                LogisticRegression(
                    max_iter=2_000,
                    random_state=seed,
                ),
            ),
        ]
    )


def _fit_t_learner(
    train: pd.DataFrame,
    seed: int,
) -> dict[str, Pipeline]:
    models: dict[str, Pipeline] = {}
    for offset, treatment_id in enumerate(TREATMENT_IDS):
        treatment_rows = train[train["treatment"] == treatment_id]
        model = _model(seed + offset)
        model.fit(treatment_rows[list(FEATURE_COLUMNS)], treatment_rows[OUTCOME_COLUMN])
        models[treatment_id] = model
    return models


def _predict_potential_outcomes(
    models: dict[str, Pipeline],
    frame: pd.DataFrame,
) -> dict[str, np.ndarray]:
    features = frame[list(FEATURE_COLUMNS)]
    return {
        treatment_id: model.predict_proba(features)[:, 1]
        for treatment_id, model in models.items()
    }


def _randomized_cell_interval(
    experiment: pd.DataFrame,
    segment_id: str,
    treatment_id: str,
    model_estimate: float,
) -> tuple[float, float]:
    segment_rows = experiment[experiment["segment"] == segment_id]
    treated = segment_rows[segment_rows["treatment"] == treatment_id][OUTCOME_COLUMN]
    control = segment_rows[segment_rows["treatment"] == "control"][OUTCOME_COLUMN]
    treated_rate = float(treated.mean())
    control_rate = float(control.mean())
    standard_error = np.sqrt(
        treated_rate * (1 - treated_rate) / len(treated)
        + control_rate * (1 - control_rate) / len(control)
    )
    margin = 1.96 * float(standard_error)
    return model_estimate - margin, model_estimate + margin


def _auuc(
    frame: pd.DataFrame,
    predicted_uplift: np.ndarray,
    treatment_id: str,
) -> float:
    eligible = frame["treatment"].isin(["control", treatment_id]).to_numpy()
    subset = frame.loc[eligible, ["treatment", OUTCOME_COLUMN]].copy()
    subset["score"] = predicted_uplift[eligible]
    subset = subset.sort_values("score", ascending=False)

    fractions = [0.0]
    gains = [0.0]
    for fraction in np.linspace(0.05, 1.0, 20):
        prefix = subset.iloc[: max(1, int(len(subset) * fraction))]
        treated = prefix[prefix["treatment"] == treatment_id][OUTCOME_COLUMN]
        control = prefix[prefix["treatment"] == "control"][OUTCOME_COLUMN]
        if treated.empty or control.empty:
            continue
        fractions.append(float(fraction))
        gains.append(float((treated.mean() - control.mean()) * fraction))
    return _round(np.trapezoid(gains, fractions), 5)


def _self_normalized_policy_value(
    assigned: np.ndarray,
    outcomes: np.ndarray,
    policy: np.ndarray,
    propensity: float,
) -> float:
    weights = (assigned == policy).astype(float) / propensity
    denominator = weights.sum()
    if denominator == 0:
        return 0.0
    return float(np.dot(weights, outcomes) / denominator)


def _treatment_metadata(treatment_id: str) -> dict[str, str]:
    return next(item for item in PV_TREATMENTS if item["id"] == treatment_id)


def build_pv_uplift_report(seed: int = DEFAULT_SEED) -> dict[str, Any]:
    frame = generate_pv_experiment(seed=seed)
    strata = frame["segment"].astype(str) + ":" + frame["treatment"].astype(str)
    train, test = train_test_split(
        frame,
        test_size=0.32,
        random_state=seed,
        stratify=strata,
    )
    train = train.reset_index(drop=True)
    test = test.reset_index(drop=True)

    models = _fit_t_learner(train, seed)
    predictions = _predict_potential_outcomes(models, test)
    control_probability = predictions["control"]
    uplift_predictions = {
        treatment_id: predictions[treatment_id] - control_probability
        for treatment_id in TREATMENT_IDS
        if treatment_id != "control"
    }

    segments: list[dict[str, Any]] = []
    for segment in SEGMENTS:
        mask = test["segment"].to_numpy() == segment.id
        segment_count = int(mask.sum())
        treatments: list[dict[str, Any]] = [
            {
                "treatmentId": "control",
                "labelZh": _treatment_metadata("control")["labelZh"],
                "expectedD30Rate": _round(control_probability[mask].mean()),
                "upliftPoints": 0.0,
                "ci95Low": 0.0,
                "ci95High": 0.0,
            }
        ]
        non_control_estimates: list[dict[str, Any]] = []

        for treatment_id in TREATMENT_IDS[1:]:
            uplift = uplift_predictions[treatment_id][mask]
            mean_uplift = float(uplift.mean())
            low, high = _randomized_cell_interval(
                frame,
                segment.id,
                treatment_id,
                mean_uplift,
            )
            treatment_metadata = _treatment_metadata(treatment_id)
            estimate = {
                "treatmentId": treatment_id,
                "labelZh": treatment_metadata["labelZh"],
                "expectedD30Rate": _round(predictions[treatment_id][mask].mean()),
                "upliftPoints": _round(mean_uplift * 100, 2),
                "ci95Low": _round(low * 100, 2),
                "ci95High": _round(high * 100, 2),
            }
            treatments.append(estimate)
            non_control_estimates.append(estimate)

        best = max(non_control_estimates, key=lambda row: row["upliftPoints"])
        should_target = best["ci95Low"] >= 1.0 and best["upliftPoints"] > 1.0
        recommended_treatment_id = (
            str(best["treatmentId"]) if should_target else "control"
        )
        recommended_uplift = (
            {
                "points": best["upliftPoints"],
                "ci95Low": best["ci95Low"],
                "ci95High": best["ci95High"],
            }
            if should_target
            else {
                "points": 0.0,
                "ci95Low": min(0.0, float(best["ci95Low"])),
                "ci95High": max(0.0, float(best["ci95High"])),
            }
        )

        segments.append(
            {
                "segmentId": segment.id,
                "labelZh": segment.label_zh,
                "labelEn": segment.label_en,
                "testSamples": segment_count,
                "decision": "target" if should_target else "hold",
                "recommendedTreatmentId": recommended_treatment_id,
                "recommendedTreatmentLabelZh": _treatment_metadata(
                    recommended_treatment_id
                )["labelZh"],
                "recommendedUplift": recommended_uplift,
                "holdoutRate": 0.10,
                "reasonCodesZh": list(segment.reason_codes_zh),
                "treatments": treatments,
            }
        )

    treatment_order = np.array(TREATMENT_IDS)
    stacked_probabilities = np.column_stack(
        [predictions[treatment_id] for treatment_id in TREATMENT_IDS]
    )
    best_action_indices = np.argmax(stacked_probabilities, axis=1)
    policy = treatment_order[best_action_indices]
    best_increment = (
        stacked_probabilities[np.arange(len(test)), best_action_indices]
        - control_probability
    )
    policy = np.where(best_increment >= 0.01, policy, "control")
    assigned = test["treatment"].to_numpy()
    outcomes = test[OUTCOME_COLUMN].to_numpy(dtype=float)
    propensity = 1.0 / len(TREATMENT_IDS)
    policy_value = _self_normalized_policy_value(
        assigned,
        outcomes,
        policy,
        propensity,
    )
    control_policy = np.full(len(test), "control", dtype=object)
    control_value = _self_normalized_policy_value(
        assigned,
        outcomes,
        control_policy,
        propensity,
    )

    treatment_metrics = []
    for treatment_id in TREATMENT_IDS[1:]:
        treatment_metrics.append(
            {
                "treatmentId": treatment_id,
                "labelZh": _treatment_metadata(treatment_id)["labelZh"],
                "auuc": _auuc(
                    test,
                    uplift_predictions[treatment_id],
                    treatment_id,
                ),
            }
        )

    return {
        "schemaVersion": "release-lab.pv-uplift.v1",
        "modelVersion": "synthetic-t-learner-logistic-v1",
        "dataMode": "synthetic_randomized_experiment",
        "disclosureZh": "本页使用固定随机种子的合成随机实验，仅验证方法与产品闭环，不代表真实业务效果。",
        "outcome": {
            "primary": "retained_d30",
            "supporting": ["retained_d7", "ltv_d30"],
            "featureWindowZh": "仅使用触达前 14 天行为",
            "labelWindowZh": "观察触达后第 30 天是否留存",
        },
        "methodology": {
            "estimand": "CATE: action versus no-contact control",
            "model": "Multi-treatment T-Learner with logistic regression",
            "assignment": "equal-propensity randomized",
            "featureColumns": list(FEATURE_COLUMNS),
            "confidenceInterval": "model estimate with randomized-cell 95% interval",
            "decisionThresholdPoints": 1.0,
        },
        "treatments": [dict(item) for item in PV_TREATMENTS],
        "segments": segments,
        "evaluation": {
            "trainSamples": int(len(train)),
            "testSamples": int(len(test)),
            "randomizedPropensity": propensity,
            "policyValue": _round(policy_value),
            "controlValue": _round(control_value),
            "incrementalPolicyValuePoints": _round(
                (policy_value - control_value) * 100,
                2,
            ),
            "treatmentMetrics": treatment_metrics,
        },
    }
