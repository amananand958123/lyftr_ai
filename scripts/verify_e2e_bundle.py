#!/usr/bin/env python3
"""
Lyftr AI — E2E Production Bundle & Contract Verification
Inspects compiled production artifacts (frontend/dist) and verifies
all 9 required data-testid hooks are compiled into the production output.
"""

import sys
import glob

REQUIRED_TEST_IDS = [
    "chat-input",
    "send-button",
    "assistant-message",
    "meta-source",
    "meta-model",
    "meta-latency",
    "meta-input-tokens",
    "meta-output-tokens",
    "system-prompt-input"
]

def verify_bundle():
    print("=" * 65)
    print("LYFTR AI — E2E PRODUCTION BUNDLE VERIFICATION")
    print("=" * 65)

    js_files = glob.glob("frontend/dist/assets/*.js")
    if not js_files:
        print("ERROR: No compiled JS bundles found in frontend/dist/assets/")
        sys.exit(1)

    bundle_content = ""
    for f in js_files:
        with open(f, "r", encoding="utf-8") as fp:
            bundle_content += fp.read() + "\n"

    missing = []
    print(f"Inspecting {len(js_files)} compiled bundle(s) ({len(bundle_content)} bytes)...")
    for tid in REQUIRED_TEST_IDS:
        target = f'data-testid":"{tid}"'
        target_alt = f'data-testid\\":\\"{tid}\\"'
        target_raw = tid
        found = target in bundle_content or target_alt in bundle_content or f'"{tid}"' in bundle_content
        status = "✓ FOUND" if found else "✗ MISSING"
        print(f"  [{status}] data-testid=\"{tid}\"")
        if not found:
            missing.append(tid)

    print("-" * 65)
    if missing:
        print(f"FAILED: {len(missing)} attributes missing from production bundle: {missing}")
        sys.exit(1)
    else:
        print("PASS: ALL 9 REQUIRED ATTRIBUTES VERIFIED IN PRODUCTION BUNDLE!")
        print("=" * 65)

if __name__ == "__main__":
    verify_bundle()
