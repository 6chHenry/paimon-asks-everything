from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from scripts.release_lab.synthetic import (
    CHANNEL_GROUPS,
    DEFAULT_SEED,
    generate_channel_experiment,
)

GROUP_ORDER = ("control", "influencer_only", "expo_only", "both")


def _round(value: float, digits: int = 4) -> float:
    return float(round(float(value), digits))


def _cell_means(frame: pd.DataFrame, column: str) -> dict[str, float]:
    return {
        group_id: float(frame.loc[frame["group_id"] == group_id, column].mean())
        for group_id in GROUP_ORDER
    }


def _effects(means: dict[str, float]) -> dict[str, float]:
    mu00 = means["control"]
    mu10 = means["influencer_only"]
    mu01 = means["expo_only"]
    mu11 = means["both"]
    influencer_shapley = 0.5 * ((mu10 - mu00) + (mu11 - mu01))
    expo_shapley = 0.5 * ((mu01 - mu00) + (mu11 - mu10))
    return {
        "influencer_direct": mu10 - mu00,
        "influencer_with_expo": mu11 - mu01,
        "expo_direct": mu01 - mu00,
        "expo_with_influencer": mu11 - mu10,
        "influencer_shapley": influencer_shapley,
        "expo_shapley": expo_shapley,
        "interaction": mu11 - mu10 - mu01 + mu00,
        "joint": mu11 - mu00,
    }


def _bootstrap_effects(
    frame: pd.DataFrame,
    column: str,
    seed: int,
    draws: int = 600,
) -> dict[str, tuple[float, float]]:
    rng = np.random.default_rng(seed)
    grouped = {
        group_id: frame.loc[frame["group_id"] == group_id, column].to_numpy()
        for group_id in GROUP_ORDER
    }
    samples: dict[str, list[float]] = {
        key: []
        for key in (
            "influencer_shapley",
            "expo_shapley",
            "interaction",
            "joint",
        )
    }
    for _ in range(draws):
        means = {
            group_id: float(
                rng.choice(values, size=len(values), replace=True).mean()
            )
            for group_id, values in grouped.items()
        }
        effects = _effects(means)
        for key in samples:
            samples[key].append(effects[key])
    return {
        key: (
            float(np.quantile(values, 0.025)),
            float(np.quantile(values, 0.975)),
        )
        for key, values in samples.items()
    }


def _interval_points(
    intervals: dict[str, tuple[float, float]],
    key: str,
) -> dict[str, float]:
    low, high = intervals[key]
    return {
        "ci95Low": _round(low * 100, 2),
        "ci95High": _round(high * 100, 2),
    }


def _rate(value: float) -> float:
    return _round(value, 4)


def _group_rows(frame: pd.DataFrame) -> list[dict[str, Any]]:
    metadata = {str(item["id"]): item for item in CHANNEL_GROUPS}
    rows = []
    for group_id in GROUP_ORDER:
        group = frame[frame["group_id"] == group_id]
        item = metadata[group_id]
        rows.append(
            {
                "groupId": group_id,
                "labelZh": item["labelZh"],
                "influencer": item["influencer"],
                "expo": item["expo"],
                "sampleSize": int(len(group)),
                "reservationRate": _rate(group["reservation"].mean()),
                "activationRate": _rate(group["activation"].mean()),
                "d7RetentionRate": _rate(group["retained_d7"].mean()),
                "d30RetentionRate": _rate(group["retained_d30"].mean()),
                "averageLtv30": _round(group["ltv_d30"].mean(), 2),
            }
        )
    return rows


def _retention_decomposition(
    frame: pd.DataFrame,
    seed: int,
) -> dict[str, Any]:
    means = _cell_means(frame, "retained_d30")
    effects = _effects(means)
    intervals = _bootstrap_effects(frame, "retained_d30", seed)

    joint_points = _round(effects["joint"] * 100, 4)
    influencer_points = _round(effects["influencer_shapley"] * 100, 4)
    expo_points = _round(joint_points - influencer_points, 4)
    if joint_points > 0:
        influencer_share = _round(influencer_points / joint_points, 6)
        expo_share = _round(1.0 - influencer_share, 6)
    else:
        influencer_share = 0.0
        expo_share = 0.0

    return {
        "baselineRate": _rate(means["control"]),
        "jointRate": _rate(means["both"]),
        "jointUpliftPoints": joint_points,
        "jointInterval": _interval_points(intervals, "joint"),
        "interactionPoints": _round(effects["interaction"] * 100, 4),
        "interactionInterval": _interval_points(intervals, "interaction"),
        "shareDenominator": "joint_incremental_uplift",
        "allocationDisclosureZh": "以下占比仅分配达人×展会相对对照组的联合增量，不是全部留存的来源占比。",
        "influencer": {
            "directPoints": _round(effects["influencer_direct"] * 100, 4),
            "marginalWithOtherPoints": _round(
                effects["influencer_with_expo"] * 100,
                4,
            ),
            "shapleyPoints": influencer_points,
            "allocationShare": influencer_share,
            **_interval_points(intervals, "influencer_shapley"),
        },
        "expo": {
            "directPoints": _round(effects["expo_direct"] * 100, 4),
            "marginalWithOtherPoints": _round(
                effects["expo_with_influencer"] * 100,
                4,
            ),
            "shapleyPoints": expo_points,
            "allocationShare": expo_share,
            **_interval_points(intervals, "expo_shapley"),
        },
    }


def build_channel_attribution_report(
    seed: int = DEFAULT_SEED,
) -> dict[str, Any]:
    frame = generate_channel_experiment(seed=seed)
    return {
        "schemaVersion": "release-lab.channel-attribution.v1",
        "experimentVersion": "synthetic-factorial-2x2-v1",
        "dataMode": "synthetic_randomized_experiment",
        "evidenceStrength": "randomized_demo",
        "disclosureZh": "本页使用合成 2×2 随机实验演示归因方法，不代表真实达人或展会效果。",
        "estimand": "incremental effect relative to no influencer and no expo",
        "assignment": {
            "method": "randomized_factorial",
            "cellPropensity": 0.25,
            "sampleSize": int(len(frame)),
        },
        "groups": _group_rows(frame),
        "d30Retention": _retention_decomposition(frame, seed + 701),
        "methodology": {
            "mainEffectZh": "分别比较有/无某动作时的平均变化",
            "interactionZh": "两种动作同时出现是否超过各自单独效果之和",
            "allocationZh": "用 Shapley 平均边际贡献分配联合增量",
            "confidenceInterval": "stratified bootstrap percentile interval",
            "productionFallbackZh": "个人随机不可行时，使用匹配城市的 Geo-lift 或分批上线 DID。",
        },
    }
