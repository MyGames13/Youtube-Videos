"""Step 1 of the voice build: align every beat, measure it, run the 7.4 gate.

For each beat take in cache/ it force aligns calibration line + beat text
(pocketsphinx, bundled en-us model), measures the beat body only (calibration
trimmed), and writes gate.json with per-beat metrics, pass or fail, and word
timings that voice_build.py uses to cut lines.

Usage: python3 voice_gate.py [--pick B03:1,...]   (choose which take each beat uses)
"""
import json
import os
import sys

import numpy as np
import soundfile as sf

import align
import gemini_tts as g
import voice_metrics as vm
from make_voice import MODEL, VOICE

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")


def beat_takes(beat):
    key = g.cache_key(beat["text"], VOICE, MODEL)
    takes = []
    for t in range(10):
        p = os.path.join(CACHE, f"{key}_t{t}.wav")
        if os.path.exists(p):
            takes.append((t, p))
    return takes


def analyse(beat, path):
    calib_words = align.norm_words(g.CALIBRATION)
    words = align.align(path, g.CALIBRATION + " " + beat["text"])
    names = [w[0].split("(")[0] for w in words]
    expect = calib_words + align.norm_words(beat["text"])
    ok_align = names == expect
    body = words[len(calib_words):]
    x, sr = vm.load(path)
    start = max(0.0, body[0][1] - 0.15)
    seg = x[int(start * sr):int((body[-1][2] + 0.25) * sr)]
    tmp = path[:-4] + "_body.wav"
    sf.write(tmp, seg, sr)
    m = vm.metrics(tmp, len(expect) - len(calib_words))
    # creak: share of voiced frames below 75 Hz (vocal fry)
    import librosa
    f0, vf, _ = librosa.pyin(seg, fmin=50, fmax=300, sr=sr, frame_length=1024, hop_length=240)
    v = f0[~np.isnan(f0)]
    m["creak"] = round(float(np.mean(v < 75)) if len(v) else 0.0, 3)
    os.remove(tmp)
    calib_last = words[len(calib_words) - 1]
    return {"path": os.path.relpath(path, HERE), "aligned": ok_align, "body_start": start,
            "calib_last": [calib_last[0].split("(")[0], round(calib_last[1], 3), round(calib_last[2], 3)],
            "words": [[w[0].split("(")[0], round(w[1], 3), round(w[2], 3)] for w in body], **m}


def main():
    beats = json.load(open(os.path.join(HERE, "script.json")))
    pick = {}
    if "--pick" in sys.argv:
        for kv in sys.argv[sys.argv.index("--pick") + 1].split(","):
            b, t = kv.split(":")
            pick[b] = int(t)
    old = {}
    gp = os.path.join(HERE, "gate.json")
    if os.path.exists(gp):
        old = {(r["beat"], r["take"]): r for r in json.load(open(gp))["all"]}
    rows_all = []
    for b in beats:
        for t, p in beat_takes(b):
            r = old.get((b["id"], t))
            if r is None or r.get("path") != os.path.relpath(p, HERE) or "calib_last" not in r:
                r = analyse(b, p)
                r.update({"beat": b["id"], "take": t})
            rows_all.append(r)
            print(b["id"], t, {k: r[k] for k in ("f0", "wpm", "centroid", "lufs", "creak", "aligned", "flags")}, flush=True)
    # chosen take per beat: explicit --pick wins; otherwise search every combination
    # of takes for the set where all beats pass with the smallest total deviation
    import itertools
    per = []
    for b in beats:
        cand = [r for r in rows_all if r["beat"] == b["id"] and r["aligned"] and not r["flags"]]
        if b["id"] in pick:
            cand = [r for r in cand if r["take"] == pick[b["id"]]] or cand
        per.append(cand)
    best, best_cost = None, None
    for combo in itertools.product(*per):
        med_ = {k: float(np.median([r[k] for r in combo])) for k in ("f0", "wpm", "centroid")}
        devs = [abs(r[k] - med_[k]) / med_[k] for r in combo for k in ("f0", "wpm", "centroid")]
        lim = {"f0": 0.10, "wpm": 0.15, "centroid": 0.15}
        fails = sum(1 for r in combo for k in lim if abs(r[k] - med_[k]) / med_[k] > lim[k])
        cost = fails * 10 + sum(d * d for d in devs) + 0.5 * sum(r["creak"] for r in combo) / len(combo)
        if best_cost is None or cost < best_cost:
            best, best_cost = combo, cost
    chosen = [dict(r) for r in best]
    med, gated = vm.gate(chosen)
    cmed = float(np.median([r["creak"] for r in gated]))
    for r in gated:
        if r["creak"] > max(0.12, cmed * 2.5):
            r["fails"].append(f"creak:{r['creak']}")
            r["pass"] = False
        if not r["aligned"]:
            r["fails"].append("alignment")
            r["pass"] = False
    json.dump({"median": med, "chosen": gated, "all": rows_all}, open(gp, "w"), indent=1)
    print("median", med, "creak median", cmed)
    for r in gated:
        print(f"{r['beat']} take{r['take']} f0 {r['f0']} ({r['f0_dev']:.1%}) wpm {r['wpm']} ({r['wpm_dev']:.1%}) "
              f"centroid {r['centroid']} ({r['centroid_dev']:.1%}) creak {r['creak']} {'PASS' if r['pass'] else 'FAIL ' + str(r['fails'])}")


if __name__ == "__main__":
    main()
