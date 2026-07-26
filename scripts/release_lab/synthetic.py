from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

DEFAULT_SEED = 20260726


@dataclass(frozen=True)
class SegmentDefinition:
    id: str
    label_zh: str
    label_en: str
    weight: float
    reason_codes_zh: tuple[str, ...]


SEGMENTS: tuple[SegmentDefinition, ...] = (
    SegmentDefinition(
        "new",
        "新入坑玩家",
        "New players",
        0.22,
        ("尚未形成稳定内容偏好", "需要尽快体验核心玩法价值"),
    ),
    SegmentDefinition(
        "returning",
        "回流玩家",
        "Returning players",
        0.23,
        ("近期登录间隔拉长", "需要低门槛重新接入版本内容"),
    ),
    SegmentDefinition(
        "story",
        "剧情考据玩家",
        "Story-focused players",
        0.24,
        ("剧情与关系图互动集中", "对悬念和角色动机更敏感"),
    ),
    SegmentDefinition(
        "exploration",
        "探索玩法玩家",
        "Exploration players",
        0.19,
        ("地图与玩法互动集中", "更关注可操作的新机制"),
    ),
    SegmentDefinition(
        "casual",
        "轻度休闲玩家",
        "Casual players",
        0.12,
        ("活跃频次较低", "重复触达更容易造成疲劳"),
    ),
)

SEGMENT_BY_ID = {segment.id: segment for segment in SEGMENTS}

PV_TREATMENTS: tuple[dict[str, str], ...] = (
    {
        "id": "control",
        "labelZh": "不触达",
        "labelEn": "No contact",
        "creativeAngleZh": "保留自然行为作为反事实",
    },
    {
        "id": "story_pv",
        "labelZh": "剧情悬念 PV",
        "labelEn": "Story suspense PV",
        "creativeAngleZh": "用已确认线索建立悬念，不提前揭示答案",
    },
    {
        "id": "character_pv",
        "labelZh": "角色情感 PV",
        "labelEn": "Character emotion PV",
        "creativeAngleZh": "突出角色关系、情绪冲突与共鸣时刻",
    },
    {
        "id": "gameplay_pv",
        "labelZh": "玩法战斗 PV",
        "labelEn": "Gameplay combat PV",
        "creativeAngleZh": "突出战斗机制、探索反馈和可操作卖点",
    },
)

TREATMENT_IDS = tuple(item["id"] for item in PV_TREATMENTS)

CHANNEL_GROUPS: tuple[dict[str, object], ...] = (
    {
        "id": "control",
        "labelZh": "对照组",
        "influencer": False,
        "expo": False,
    },
    {
        "id": "influencer_only",
        "labelZh": "仅达人",
        "influencer": True,
        "expo": False,
    },
    {
        "id": "expo_only",
        "labelZh": "仅展会",
        "influencer": False,
        "expo": True,
    },
    {
        "id": "both",
        "labelZh": "达人 × 展会",
        "influencer": True,
        "expo": True,
    },
)

FEATURE_COLUMNS = (
    "segment",
    "language",
    "progress_index",
    "days_since_login",
    "sessions_14d",
    "story_affinity",
    "character_affinity",
    "gameplay_affinity",
    "prior_pv_completion",
    "negative_feedback_30d",
)

CATEGORICAL_FEATURES = ("segment", "language")
NUMERIC_FEATURES = tuple(
    column for column in FEATURE_COLUMNS if column not in CATEGORICAL_FEATURES
)


def _sigmoid(values: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-values))


def _segment_mask(segments: np.ndarray, segment_id: str) -> np.ndarray:
    return (segments == segment_id).astype(float)


def generate_pv_experiment(
    seed: int = DEFAULT_SEED,
    sample_size: int = 20_000,
) -> pd.DataFrame:
    """Create a deterministic randomized PV experiment with known heterogeneity."""

    rng = np.random.default_rng(seed)
    segment_ids = np.array([segment.id for segment in SEGMENTS])
    segment_weights = np.array([segment.weight for segment in SEGMENTS])
    segments = rng.choice(segment_ids, size=sample_size, p=segment_weights)

    language = rng.choice(
        np.array(["zh-CN", "en"]),
        size=sample_size,
        p=np.array([0.72, 0.28]),
    )
    progress_index = np.clip(
        rng.normal(
            loc=np.select(
                [
                    segments == "new",
                    segments == "returning",
                    segments == "story",
                    segments == "exploration",
                ],
                [1.8, 5.5, 6.2, 5.8],
                default=3.8,
            ),
            scale=1.4,
        ),
        0,
        7,
    )
    days_since_login = np.clip(
        rng.gamma(
            shape=2.1,
            scale=np.select(
                [segments == "returning", segments == "casual"],
                [4.8, 3.8],
                default=1.7,
            ),
        ),
        0,
        45,
    )
    sessions_14d = np.clip(
        rng.poisson(
            lam=np.select(
                [
                    segments == "story",
                    segments == "exploration",
                    segments == "casual",
                    segments == "returning",
                ],
                [10.0, 9.0, 3.2, 4.6],
                default=6.0,
            ),
        ),
        0,
        30,
    )

    story_affinity = np.clip(
        rng.beta(2.2, 2.2, sample_size)
        + 0.32 * _segment_mask(segments, "story")
        + 0.12 * _segment_mask(segments, "returning")
        - 0.16 * _segment_mask(segments, "exploration"),
        0,
        1,
    )
    character_affinity = np.clip(
        rng.beta(2.0, 2.4, sample_size)
        + 0.22 * _segment_mask(segments, "story")
        + 0.10 * _segment_mask(segments, "casual"),
        0,
        1,
    )
    gameplay_affinity = np.clip(
        rng.beta(2.1, 2.1, sample_size)
        + 0.34 * _segment_mask(segments, "exploration")
        + 0.15 * _segment_mask(segments, "new")
        - 0.14 * _segment_mask(segments, "story"),
        0,
        1,
    )
    prior_pv_completion = np.clip(
        0.14
        + 0.54
        * np.maximum.reduce(
            [story_affinity, character_affinity, gameplay_affinity]
        )
        + rng.normal(0, 0.11, sample_size),
        0,
        1,
    )
    negative_feedback_30d = np.clip(
        rng.poisson(
            lam=0.10
            + 0.35 * _segment_mask(segments, "casual")
            + 0.06 * (days_since_login > 14),
        ),
        0,
        4,
    )

    treatment = rng.choice(np.array(TREATMENT_IDS), size=sample_size)

    baseline_logit = (
        -1.18
        + 0.075 * sessions_14d
        - 0.032 * days_since_login
        + 0.18 * prior_pv_completion
        + 0.20 * _segment_mask(segments, "story")
        + 0.13 * _segment_mask(segments, "exploration")
        - 0.14 * _segment_mask(segments, "casual")
    )

    story_effect = (
        -0.18
        + 0.68 * story_affinity
        + 0.22 * _segment_mask(segments, "returning")
        + 0.18 * _segment_mask(segments, "story")
        - 0.16 * _segment_mask(segments, "exploration")
        - 0.34 * _segment_mask(segments, "casual")
        - 0.22 * negative_feedback_30d
    )
    character_effect = (
        -0.16
        + 0.62 * character_affinity
        + 0.16 * _segment_mask(segments, "story")
        + 0.08 * _segment_mask(segments, "returning")
        - 0.30 * _segment_mask(segments, "casual")
        - 0.24 * negative_feedback_30d
    )
    gameplay_effect = (
        -0.20
        + 0.66 * gameplay_affinity
        + 0.20 * _segment_mask(segments, "new")
        + 0.23 * _segment_mask(segments, "exploration")
        - 0.18 * _segment_mask(segments, "story")
        - 0.32 * _segment_mask(segments, "casual")
        - 0.20 * negative_feedback_30d
    )

    potential_logits = {
        "control": baseline_logit,
        "story_pv": baseline_logit + story_effect,
        "character_pv": baseline_logit + character_effect,
        "gameplay_pv": baseline_logit + gameplay_effect,
    }
    potential_probabilities = {
        action: _sigmoid(logits)
        for action, logits in potential_logits.items()
    }
    observed_probability = np.choose(
        pd.Categorical(treatment, categories=TREATMENT_IDS).codes,
        [potential_probabilities[action] for action in TREATMENT_IDS],
    )
    retained_d30 = rng.binomial(1, observed_probability)

    d7_probability = np.clip(0.25 + 0.72 * observed_probability, 0, 0.94)
    retained_d7 = rng.binomial(1, d7_probability)
    ltv_d30 = np.where(
        retained_d30 == 1,
        rng.gamma(shape=1.8, scale=10.0 + 8.0 * prior_pv_completion),
        rng.gamma(shape=0.7, scale=1.2),
    )

    frame = pd.DataFrame(
        {
            "anonymous_user_id": [f"syn-pv-{index:05d}" for index in range(sample_size)],
            "segment": segments,
            "language": language,
            "progress_index": progress_index.round(4),
            "days_since_login": days_since_login.round(4),
            "sessions_14d": sessions_14d,
            "story_affinity": story_affinity.round(4),
            "character_affinity": character_affinity.round(4),
            "gameplay_affinity": gameplay_affinity.round(4),
            "prior_pv_completion": prior_pv_completion.round(4),
            "negative_feedback_30d": negative_feedback_30d,
            "treatment": treatment,
            "assignment_method": "randomized",
            "propensity": 1.0 / len(TREATMENT_IDS),
            "retained_d7": retained_d7,
            "retained_d30": retained_d30,
            "ltv_d30": ltv_d30.round(2),
        }
    )

    for action, probability in potential_probabilities.items():
        frame[f"true_probability_{action}"] = probability.round(8)

    return frame


def generate_channel_experiment(
    seed: int = DEFAULT_SEED,
    sample_size: int = 16_000,
) -> pd.DataFrame:
    """Create a deterministic randomized 2×2 influencer/expo experiment."""

    rng = np.random.default_rng(seed + 41)
    segment_ids = np.array([segment.id for segment in SEGMENTS])
    segment_weights = np.array([segment.weight for segment in SEGMENTS])
    segments = rng.choice(segment_ids, size=sample_size, p=segment_weights)

    influencer = rng.binomial(1, 0.5, sample_size)
    expo = rng.binomial(1, 0.5, sample_size)
    interaction = influencer * expo
    group_id = np.select(
        [
            (influencer == 0) & (expo == 0),
            (influencer == 1) & (expo == 0),
            (influencer == 0) & (expo == 1),
        ],
        ["control", "influencer_only", "expo_only"],
        default="both",
    )

    baseline_engagement = np.clip(
        rng.beta(2.2, 2.0, sample_size)
        + 0.16 * _segment_mask(segments, "story")
        + 0.14 * _segment_mask(segments, "exploration")
        - 0.18 * _segment_mask(segments, "casual"),
        0,
        1,
    )
    prior_value = np.clip(
        rng.gamma(shape=1.5, scale=0.28, size=sample_size)
        + 0.18 * _segment_mask(segments, "returning"),
        0,
        1.5,
    )

    reservation_probability = _sigmoid(
        -1.18
        + 1.15 * baseline_engagement
        + 0.34 * influencer
        + 0.22 * expo
        + 0.10 * interaction
    )
    reservation = rng.binomial(1, reservation_probability)

    activation_probability = _sigmoid(
        -0.70
        + 0.82 * baseline_engagement
        + 0.42 * reservation
        + 0.25 * influencer
        + 0.18 * expo
        + 0.10 * interaction
    )
    activation = rng.binomial(1, activation_probability)

    d7_conditional_probability = _sigmoid(
        0.18
        + 0.72 * baseline_engagement
        + 0.22 * prior_value
        + 0.18 * influencer
        + 0.12 * expo
        + 0.08 * interaction
        - 0.28 * _segment_mask(segments, "casual")
    )
    retained_d7 = activation * rng.binomial(1, d7_conditional_probability)

    d30_conditional_probability = _sigmoid(
        -0.48
        + 0.76 * baseline_engagement
        + 0.32 * prior_value
        + 0.22 * influencer
        + 0.15 * expo
        + 0.10 * interaction
        - 0.22 * _segment_mask(segments, "casual")
    )
    retained_d30 = retained_d7 * rng.binomial(1, d30_conditional_probability)

    ltv_d30 = np.where(
        retained_d30 == 1,
        rng.gamma(shape=1.9, scale=12.0 + 8.0 * prior_value),
        rng.gamma(shape=0.65, scale=1.1),
    )

    return pd.DataFrame(
        {
            "anonymous_user_id": [
                f"syn-channel-{index:05d}" for index in range(sample_size)
            ],
            "segment": segments,
            "influencer_exposed": influencer,
            "expo_exposed": expo,
            "group_id": group_id,
            "assignment_method": "randomized_factorial",
            "propensity": 0.25,
            "reservation": reservation,
            "activation": activation,
            "retained_d7": retained_d7,
            "retained_d30": retained_d30,
            "ltv_d30": ltv_d30.round(2),
        }
    )
