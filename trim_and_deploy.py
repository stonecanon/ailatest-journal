#!/usr/bin/env python3
"""Compatibility no-op for legacy Cloudflare Pages build settings.

Production serves ``data/journals.json.gz`` directly. The former trimmed JSON
copy was unused, stale, and added roughly 25 MB to the repository.
"""

print("data/journals.json.gz is the production bundle; no trim step is required.")
