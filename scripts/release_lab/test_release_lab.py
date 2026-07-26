from __future__ import annotations

import unittest

from scripts.release_lab.pv_uplift import build_pv_uplift_report


class PvUpliftTests(unittest.TestCase):
    def test_report_is_deterministic_and_truthfully_labelled(self) -> None:
        first = build_pv_uplift_report()
        second = build_pv_uplift_report()

        self.assertEqual(first, second)
        self.assertEqual(first["dataMode"], "synthetic_randomized_experiment")
        self.assertEqual(first["outcome"]["primary"], "retained_d30")

    def test_each_segment_keeps_control_and_returns_a_safe_decision(self) -> None:
        report = build_pv_uplift_report()

        for segment in report["segments"]:
            treatment_ids = [row["treatmentId"] for row in segment["treatments"]]
            self.assertIn("control", treatment_ids)
            self.assertIn(segment["decision"], {"target", "hold"})
            if segment["decision"] == "target":
                self.assertGreater(segment["recommendedUplift"]["ci95Low"], 0)
                self.assertNotEqual(segment["recommendedTreatmentId"], "control")
            else:
                self.assertEqual(segment["recommendedTreatmentId"], "control")

    def test_features_are_pre_exposure_only(self) -> None:
        report = build_pv_uplift_report()
        features = set(report["methodology"]["featureColumns"])

        self.assertNotIn("retained_d7", features)
        self.assertNotIn("retained_d30", features)
        self.assertNotIn("ltv_d30", features)
        self.assertNotIn("treatment", features)

    def test_policy_evaluation_is_finite(self) -> None:
        evaluation = build_pv_uplift_report()["evaluation"]

        self.assertGreater(evaluation["testSamples"], 0)
        self.assertGreaterEqual(evaluation["policyValue"], 0)
        self.assertLessEqual(evaluation["policyValue"], 1)
        self.assertGreaterEqual(evaluation["controlValue"], 0)
        self.assertLessEqual(evaluation["controlValue"], 1)

    def test_small_casual_effect_is_held_below_business_threshold(self) -> None:
        report = build_pv_uplift_report()
        casual = next(
            segment
            for segment in report["segments"]
            if segment["segmentId"] == "casual"
        )

        self.assertEqual(casual["decision"], "hold")
        self.assertEqual(casual["recommendedTreatmentId"], "control")


if __name__ == "__main__":
    unittest.main()
