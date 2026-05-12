#!/usr/bin/env python3
"""Encrypt 学校自编目录 using AES-GCM with a user-defined unlock code.

用法:
    python scripts/encrypt_locked.py zju_city school-a-149684

效果:
    - 读取 data/domestic.json 中 zju_city.records
    - 用 code 通过 PBKDF2 派生 AES-256 密钥
    - AES-GCM 加密 → data/locked/zju_city.enc.json
    - 原 domestic.json 中 zju_city.records 清空（只留 source）

前端用 Web Crypto API 的 PBKDF2 + AES-GCM 解密，参数必须与本脚本一致。
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

ROOT = Path(__file__).resolve().parent.parent
DOMESTIC = ROOT / "data" / "domestic.json"
LOCKED_DIR = ROOT / "data" / "locked"

# 必须与前端 js 保持一致
PBKDF2_ITERATIONS = 100_000
SALT_BYTES = 16
IV_BYTES = 12
KEY_BYTES = 32  # AES-256


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def derive_key(code: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=KEY_BYTES,
        salt=salt,
        iterations=PBKDF2_ITERATIONS,
    )
    return kdf.derive(code.encode("utf-8"))


def encrypt(source_key: str, code: str) -> None:
    domestic = json.loads(DOMESTIC.read_text(encoding="utf-8"))
    if source_key not in domestic:
        sys.exit(f"Source {source_key} not in domestic.json")

    src = domestic[source_key]
    records = src.get("records", [])
    if not records:
        sys.exit(f"{source_key} has no records to encrypt")

    plaintext = json.dumps(records, ensure_ascii=False).encode("utf-8")

    salt = secrets.token_bytes(SALT_BYTES)
    iv = secrets.token_bytes(IV_BYTES)
    key = derive_key(code, salt)
    ciphertext = AESGCM(key).encrypt(iv, plaintext, None)

    # 指纹 = code 的 SHA256 前 8 字节（hex），方便前端快速判错码
    code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()[:16]

    blob = {
        "version": 1,
        "algo": "AES-GCM",
        "kdf": "PBKDF2-SHA256",
        "iterations": PBKDF2_ITERATIONS,
        "salt": b64(salt),
        "iv": b64(iv),
        "ciphertext": b64(ciphertext),
        "code_fingerprint": code_hash,
        "count": len(records),
        "source": src.get("source", source_key),
    }

    LOCKED_DIR.mkdir(parents=True, exist_ok=True)
    out = LOCKED_DIR / f"{source_key}.enc.json"
    out.write_text(json.dumps(blob, ensure_ascii=False, indent=2), encoding="utf-8")

    # 清空原 records，保留 source 说明
    domestic[source_key] = {
        "source": src.get("source", source_key),
        "locked": True,
        "count": len(records),
        "records": [],
    }
    DOMESTIC.write_text(
        json.dumps(domestic, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"✓ 加密 {len(records)} 条记录 → {out.relative_to(ROOT)}")
    print(f"✓ domestic.json 中 {source_key}.records 已清空")
    print(f"✓ code 指纹: {code_hash}")
    print(f"✓ 解锁码: {code}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(f"用法: python {sys.argv[0]} <source_key> <code>\n 例: python {sys.argv[0]} zju_city school-a-149684")
    encrypt(sys.argv[1], sys.argv[2])
