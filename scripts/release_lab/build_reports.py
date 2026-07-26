from __future__ import annotations

import argparse
import json
from pathlib import Path

from scripts.release_lab.pv_uplift import build_pv_uplift_report

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIRECTORY = REPOSITORY_ROOT / "artifacts" / "release-lab"


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(
        payload,
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    )
    path.write_text(f"{serialized}\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build release lab artifacts")
    parser.add_argument(
        "--pv-only",
        action="store_true",
        help="Build only the PV uplift report",
    )
    args = parser.parse_args()

    _write_json(
        ARTIFACT_DIRECTORY / "pv-uplift.json",
        build_pv_uplift_report(),
    )
    if not args.pv_only:
        print("PV uplift report built; channel attribution is added in Task 2.")
    print(f"Wrote {ARTIFACT_DIRECTORY / 'pv-uplift.json'}")


if __name__ == "__main__":
    main()
