#!/usr/bin/env python3
"""Compatibility entrypoint for Cloudflare Pages build settings.

Older Pages settings may still run `python scripts/trim_and_deploy.py`.
The deployed site now serves `data/journals.json.gz` directly, so the trim step
is optional and should never fail a static deployment.
"""
from __future__ import annotations

import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
runpy.run_path(str(ROOT / "trim_and_deploy.py"), run_name="__main__")
