"""Build timeline.json from the measured voice lines.

Every start time is measured audio plus designed pauses, so picture and sound
read one file and cannot drift. Also places the meter keyframes, HUD pips, the
early shutter clicks (section 7.5) and the three near silences.
Writes ../src/timeline.json and out/voiceover_master.wav (48 kHz, 24 bit).
"""
import json
import os

import numpy as np
import soundfile as sf
from scipy import signal
from dsp import declick, limiter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
SR = 48000
FPS = 30
rng = np.random.default_rng(3)

# perceived silence (end of sound to start of sound) BEFORE the given line
PAUSE_BEFORE = {
    "L012": 0.95,  # check the corner
    "L013": 1.25,  # meter punch in, clock tick
    "L015": 0.62,  # zoom lens joke
    "L016": 0.75,
    "L018": 1.35,  # thing one heading
    "L022": 0.55,
    "L025": 0.7,
    "L026": 0.5,
    "L030": 0.6,
    "L031": 1.6,  # thing two heading, meter 18 m
    "L032": 0.5,
    "L033": 0.75,
    "L035": 0.8,
    "L040": 0.6,
    "L041": 0.5,
    "L043": 1.6,  # thing three heading, meter 6 m
    "L047": 0.6,
    "L050": 0.6,
    "L052": 0.6,
    "L053": 0.6,
    "L054": 0.45,  # handwriting appears after the turn over
    "L055": 0.35,
    "L057": 0.62,  # you have done both
    "L059": 1.6,  # thing four heading, meter 1.5 m
    "L062": 0.55,
    "L064": 0.7,
    "L068": 2.3,  # near silence one before the reveal
    "L069": 0.75,
    "L070": 2.35,  # the unit flip, hit, red number
    "L071": 0.6,
    "L072": 0.6,
    "L073": 0.5,
    "L074": 0.8,
    "L076": 0.7,
    "L078": 0.45,
    "L079": 0.6,
    "L080": 0.55,
    "L081": 1.7,  # escape
    "L082": 0.5,
    "L083": 0.6,
    "L085": 0.6,
    "L086": 0.55,
    "L087": 0.6,
    "L091": 0.9,  # check the corner
    "L092": 2.6,  # countdown to zero
    "L093": 0.6,
    "L094": 1.9,  # near silence two after the laugh, the shutter lands
    "L095": 1.9,  # the turn
    "L098": 0.7,  # frame it
    "L099": 0.75,
    "L102": 0.6,
    "L103": 1.0,
    "L105": 0.9,
    "L107": 0.6,
    "L108": 0.8,
}
DEFAULT_PAUSE = 0.36
HEAD = 0.55  # first word lands half a second in, after the paper slide and click
TAIL = 9.8  # lights off, second photograph, near silence three, click, end card

SECTION_STARTS = {"hook": "L001", "thing1": "L018", "thing2": "L031", "thing3": "L043",
                  "thing4": "L059", "reveal": "L068", "escape": "L081", "turn": "L095"}

# early click: (line, word index of the key word, delay seconds)
EARLY_CLICKS = [
    ("L001", 10, 0.40),  # keep it
    ("L026", 6, 0.40),   # ask when
    ("L030", 0, 0.40),   # it was not them
    ("L034", 8, 0.30),   # not yet
    ("L052", 7, 0.20),   # ask when
    ("L066", 0, 0.10),   # keep it where you can see it
    ("L070", 4, 0.08),   # wrong unit
    ("L089", 0, 0.05),   # do not hurry the date
]


def main():
    data = json.load(open(os.path.join(OUT, "voice_lines.json")))
    lines = data["lines"]
    t = HEAD
    prev_sound_end = None
    out = []
    for ln in lines:
        pause = PAUSE_BEFORE.get(ln["id"], DEFAULT_PAUSE + float(rng.uniform(-0.07, 0.07)))
        if ln.get("file"):
            onset, offset = ln["onset"], ln["offset"]
        else:
            onset, offset = 0.0, ln["dur"]
        if prev_sound_end is None:
            start = HEAD - onset
        else:
            start = prev_sound_end + pause - onset
        rec = dict(ln)
        rec["start"] = round(start, 4)
        rec["end"] = round(start + ln["dur"], 4)
        rec["sound_start"] = round(start + onset, 4)
        rec["sound_end"] = round(start + offset, 4)
        rec["pause_before"] = round(pause, 3)
        out.append(rec)
        prev_sound_end = start + offset
    total = prev_sound_end + TAIL
    byid = {l["id"]: l for l in out}

    # word level absolute times
    for l in out:
        l["words_abs"] = [[w[0], round(l["start"] + w[1], 3), round(l["start"] + w[2], 3)] for w in l.get("words", [])]

    meter = [
        {"t": 0.0, "kind": "hidden"},
        {"t": byid["L012"]["sound_start"], "kind": "m", "value": 40},
        {"t": byid["L030"]["sound_end"] + 0.35, "kind": "m", "value": 18},
        {"t": byid["L042"]["sound_end"] + 0.35, "kind": "m", "value": 6},
        {"t": byid["L058"]["sound_end"] + 0.35, "kind": "m", "value": 1.5},
        {"t": byid["L067"]["sound_end"] + 0.35, "kind": "m", "value": 0.3},
        {"t": byid["L069"]["sound_end"] + 0.35, "kind": "days", "value": 412},
        {"t": byid["L087"]["sound_start"], "kind": "count", "from": 412, "to": 38,
         "until": byid["L091"]["sound_start"] - 0.2},
        {"t": byid["L091"]["sound_end"] + 0.15, "kind": "count", "from": 38, "to": 0,
         "until": byid["L091"]["sound_end"] + 2.0},
        {"t": total - 6.5, "kind": "fade"},
    ]
    punches = [byid[i]["sound_start"] for i in ("L012", "L069", "L091")]
    pips = [byid[SECTION_STARTS[s]]["sound_start"] for s in ("thing1", "thing2", "thing3", "thing4")]
    camera_icon = byid["L069"]["sound_end"] + 0.35

    clicks = []
    for lid, wi, d in EARLY_CLICKS:
        w = byid[lid]["words_abs"][wi]
        clicks.append({"line": lid, "word": w[0], "word_t": w[1], "t": round(w[1] - d, 3), "delay": d})

    laugh_t = byid["L093"]["sound_end"] + 0.55  # the visual laugh and the one perfect click
    silences = [
        {"name": "before_reveal", "t0": byid["L067"]["sound_end"] + 0.6, "t1": byid["L068"]["sound_start"] - 0.05},
        {"name": "after_laugh", "t0": laugh_t + 0.05, "t1": byid["L094"]["sound_start"] - 0.05},
        {"name": "before_endcard", "t0": total - 4.6, "t1": total - 2.6},
    ]
    sections = {k: byid[v]["start"] for k, v in SECTION_STARTS.items()}
    tl = {
        "fps": FPS,
        "duration": round(total, 3),
        "frames": int(np.ceil(total * FPS)),
        "lines": out,
        "sections": sections,
        "meter": meter,
        "punches": punches,
        "pips": pips,
        "camera_icon": camera_icon,
        "early_clicks": clicks,
        "laugh_t": round(laugh_t, 3),
        "silences": silences,
    }
    json.dump(tl, open(os.path.join(HERE, "..", "src", "timeline.json"), "w"), indent=1)

    # voiceover master: lines on the timeline, tiny room, faint room tone bed
    n = int(total * SR) + SR
    vo = np.zeros(n)
    for l in out:
        if not l.get("file"):
            continue
        x, sr = sf.read(os.path.join(HERE, l["file"]))
        i = int(round(l["start"] * SR))
        vo[i:i + len(x)] += x
    ir = room_ir(SR, 0.35)
    wet = signal.fftconvolve(vo, ir)[:n]
    vo = vo + 0.09 * wet / (np.max(np.abs(wet)) + 1e-9) * np.max(np.abs(vo))
    bed = pink(n, SR) * 10 ** (-66 / 20)
    sos = signal.butter(2, 900, btype="lowpass", fs=SR, output="sos")
    vo = vo + signal.sosfilt(sos, bed)
    vo = vo[: int(total * SR)]
    # tame vowel onset peaks (speech crest about 20 dB) so the master needs little limiting
    # mouth clicks in the gaps between words (never inside speech)
    words = [(w[1], w[2]) for l in out for w in l.get("words_abs", [])]
    vo, nclick = declick(vo, SR, words)
    print(f"declick: {nclick} click frames attenuated")
    vo, _ = limiter(vo, -6.0, SR, lookahead_ms=4.0, release_ms=90.0)
    sf.write(os.path.join(OUT, "voiceover_master.wav"), vo.astype(np.float32), SR, subtype="PCM_24")
    print(f"duration {total:.2f} s = {int(total // 60)}:{total % 60:05.2f}, lines {len(out)}")
    for k, v in sections.items():
        print(f"  {k:7s} {int(v // 60)}:{v % 60:05.2f}")


def room_ir(sr, rt60):
    n = int(rt60 * sr)
    t = np.arange(n) / sr
    r = np.random.default_rng(11)
    ir = r.standard_normal(n) * np.exp(-6.9 * t / rt60)
    for d, g in ((0.007, 0.5), (0.013, 0.35), (0.021, 0.25)):
        ir[int(d * sr)] += g * 8
    sos = signal.butter(2, [180, 5200], btype="bandpass", fs=sr, output="sos")
    ir = signal.sosfilt(sos, ir)
    ir[: int(0.003 * sr)] = 0
    return ir / np.sqrt(np.sum(ir ** 2))


def pink(n, sr):
    r = np.random.default_rng(5)
    w = r.standard_normal(n)
    f = np.fft.rfftfreq(n, 1 / sr)
    s = np.fft.rfft(w) / np.sqrt(np.maximum(f, 20))
    x = np.fft.irfft(s, n)
    return x / np.max(np.abs(x))


if __name__ == "__main__":
    main()
