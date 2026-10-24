"""Generate the narrator beats with Gemini TTS (voice lock: one model, one voice,
one style header, one calibration line, fixed seed and temperature).

Usage: GEMINI_API_KEY=... python3 make_voice.py [--takes B03:1,B07:2]
The key is read from the environment only. Clips are cached in cache/ by a hash of
text, voice, model, style header, calibration line, seed and temperature, so a re-run
never spends quota twice. Then run voice_build.py to gate, split and process.
"""
import json
import os
import sys

import gemini_tts as g

MODEL = "gemini-3.8-flash-tts"
VOICE = "Iapetus"
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")


def main():
    beats = json.load(open(os.path.join(HERE, "script.json")))
    takes = {}
    if "--takes" in sys.argv:
        for kv in sys.argv[sys.argv.index("--takes") + 1].split(","):
            b, t = kv.split(":")
            takes.setdefault(b, []).append(int(t))
    only = set(takes) if takes else None
    for b in beats:
        if only and b["id"] not in only:
            continue
        for t in takes.get(b["id"], [0]):
            p = g.synth(b["text"], VOICE, MODEL, CACHE, take=t)
            print(b["id"], t, os.path.relpath(p, HERE), flush=True)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
