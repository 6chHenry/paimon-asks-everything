from __future__ import annotations

import argparse
import json
from pathlib import Path

from scripts.release_lab.channel_attribution import (
    build_channel_attribution_report,
)
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
    parser.add_argument(
        "--channel-only",
        action="store_true",
        help="Build only the channel attribution report",
    )
    args = parser.parse_args()
    if args.pv_only and args.channel_only:
        parser.error("--pv-only and --channel-only are mutually exclusive")

    if not args.channel_only:
        pv_path = ARTIFACT_DIRECTORY / "pv-uplift.json"
        _write_json(pv_path, build_pv_uplift_report())
        print(f"Wrote {pv_path}")
    if not args.pv_only:
        channel_path = ARTIFACT_DIRECTORY / "channel-attribution.json"
        _write_json(channel_path, build_channel_attribution_report())
        print(f"Wrote {channel_path}")


if __name__ == "__main__":
    main()
