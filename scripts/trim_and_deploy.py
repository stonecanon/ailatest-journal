#!/usr/bin/env python3
"""Compatibility entrypoint for legacy Cloudflare Pages build settings.

The deployed site serves ``data/journals.json.gz`` directly, so no trimming
step is required.  Keep this script because older Pages settings may still
invoke ``python scripts/trim_and_deploy.py``.
"""


def main() -> None:
    print("data/journals.json.gz is the production bundle; no trim step is required.")


if __name__ == "__main__":
    main()
