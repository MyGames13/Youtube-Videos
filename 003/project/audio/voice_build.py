"""Step 2 of the voice build: cut the gated beats into lines and run the one
processing chain (identical on every line).

chain: resample 24k to 48k, high pass 80 Hz, spectral match to the median beat
(max 3 dB per band), warmth +1.5 dB at 200 Hz, proximity low shelf, de-ess
6 to 8 kHz, 3:1 compression, normalise each line to -20 LUFS, 10 ms fades.
Writes out/lines/*.wav (48 kHz float) and out/voice_lines.json with word times.
"""
import json
import os

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import signal

import align
import voice_metrics as vm

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
SR = 48000


def biquad(kind, f0, sr, gain_db=0.0, q=0.707):
    a_ = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / sr
    al = np.sin(w0) / (2 * q)
    cw = np.cos(w0)
    if kind == "peak":
        b = [1 + al * a_, -2 * cw, 1 - al * a_]
        a = [1 + al / a_, -2 * cw, 1 - al / a_]
    elif kind == "lowshelf":
        sq = 2 * np.sqrt(a_) * al
        b = [a_ * ((a_ + 1) - (a_ - 1) * cw + sq), 2 * a_ * ((a_ - 1) - (a_ + 1) * cw), a_ * ((a_ + 1) - (a_ - 1) * cw - sq)]
        a = [(a_ + 1) + (a_ - 1) * cw + sq, -2 * ((a_ - 1) + (a_ + 1) * cw), (a_ + 1) + (a_ - 1) * cw - sq]
    else:
        raise ValueError(kind)
    return np.array(b) / a[0], np.array(a) / a[0]


def env_follow(x, sr, att_ms, rel_ms):
    a_att = np.exp(-1.0 / (sr * att_ms / 1000))
    a_rel = np.exp(-1.0 / (sr * rel_ms / 1000))
    # vectorised enough for our sizes: process in python over a decimated envelope
    hop = 48
    rect = np.sqrt(np.convolve(x * x, np.ones(hop) / hop, mode="same"))[::hop]
    out = np.zeros_like(rect)
    g = 0.0
    aa, ar = a_att ** hop, a_rel ** hop
    for i, v in enumerate(rect):
        c = aa if v > g else ar
        g = c * g + (1 - c) * v
        out[i] = g
    return np.repeat(out, hop)[: len(x)]


def compress(x, sr, thresh_db=-26.0, ratio=3.0, att=8, rel=120):
    env = env_follow(x, sr, att, rel)
    lvl = 20 * np.log10(env + 1e-9)
    over = np.maximum(0, lvl - thresh_db)
    gain_db = -over * (1 - 1 / ratio)
    return x * 10 ** (gain_db / 20)


def deess(x, sr, lo=5600, hi=8800, thresh_rel_db=-12.0, max_red=8.0):
    sos = signal.butter(4, [lo, hi], btype="bandpass", fs=sr, output="sos")
    band = signal.sosfiltfilt(sos, x)
    eb = env_follow(band, sr, 2, 60)
    ef = env_follow(x, sr, 5, 120)
    rel = 20 * np.log10((eb + 1e-9) / (ef + 1e-9))
    red = np.clip(rel - thresh_rel_db, 0, max_red)
    g = 10 ** (-red / 20)
    return x - band + band * g


def ltas(x, sr):
    f, p = signal.welch(x, fs=sr, nperseg=4096)
    return f, 10 * np.log10(p + 1e-14)


def third_octave_curve(f, diff_db):
    centers = 1000 * 2 ** (np.arange(-17, 14) / 3)
    centers = centers[(centers > 60) & (centers < 11000)]
    vals = []
    for c in centers:
        m = (f >= c / 2 ** (1 / 6)) & (f < c * 2 ** (1 / 6))
        vals.append(np.median(diff_db[m]) if m.any() else 0.0)
    vals = np.clip(np.array(vals), -3, 3)
    # smooth across neighbouring bands
    vals = np.convolve(np.pad(vals, 1, mode="edge"), [0.25, 0.5, 0.25], mode="valid")
    return centers, vals


def eq_fir(curve_f, curve_db, sr, ntaps=1025):
    freqs = np.concatenate([[0], curve_f, [sr / 2]])
    gains = np.concatenate([[curve_db[0]], curve_db, [curve_db[-1]]])
    return signal.firwin2(ntaps, freqs / (sr / 2), 10 ** (gains / 20))


def frame_db(x, sr, win=0.03, hop=0.005):
    w, h = int(win * sr), int(hop * sr)
    n = max(1, (len(x) - w) // h)
    idx = np.arange(n) * h
    e = np.array([np.mean(x[i:i + w] ** 2) for i in idx])
    return idx, 10 * np.log10(e + 1e-12)


def boundaries(x, sr, spans, calib_last):
    """Cut points between lines at the quietest 30 ms between the middle of one line's
    last word and the middle of the next line's first word."""
    idx, db = frame_db(x, sr)
    t = idx / sr + 0.015
    cuts = []
    fw = spans[0][1][0]
    a = (calib_last[1] + calib_last[2]) / 2
    b = (fw[1] + fw[2]) / 2
    m = (t > a) & (t < b)
    cuts.append(float(t[m][np.argmin(db[m])]) if m.any() else (calib_last[2] + fw[1]) / 2)
    for k in range(len(spans) - 1):
        lw = spans[k][1][-1]
        fw = spans[k + 1][1][0]
        a = (lw[1] + lw[2]) / 2
        b = (fw[1] + fw[2]) / 2
        m = (t > a) & (t < b)
        cuts.append(float(t[m][np.argmin(db[m])]) if m.any() else (lw[2] + fw[1]) / 2)
    cuts.append(min(len(x) / sr, spans[-1][1][-1][2] + 0.45))
    return cuts


def trim_silence(x, sr, a, b, w0, w1):
    """Keep at most 220 ms before the first sound (breath onset) and 300 ms after the last."""
    seg = x[int(a * sr):int(b * sr)]
    idx, db = frame_db(seg, sr, 0.02, 0.005)
    ref = np.percentile(db, 98)
    loud = np.where(db > ref - 32)[0]
    if len(loud) == 0:
        return a, b
    first = a + idx[loud[0]] / sr
    last = a + (idx[loud[-1]] + int(0.02 * sr)) / sr
    return max(a, first - 0.22), min(b, last + 0.3)


def main():
    os.makedirs(os.path.join(OUT, "lines"), exist_ok=True)
    gate = json.load(open(os.path.join(HERE, "gate.json")))
    beats = {b["id"]: b for b in json.load(open(os.path.join(HERE, "script.json")))}
    meter = pyln.Meter(SR)

    # load beats, resample to 48k, high pass
    hp = signal.butter(2, 80, btype="highpass", fs=SR, output="sos")
    beat_audio = {}
    for r in gate["chosen"]:
        x, sr = sf.read(os.path.join(HERE, r["path"]))
        x = signal.resample_poly(x, 2, 1) if sr == 24000 else x
        beat_audio[r["beat"]] = signal.sosfilt(hp, x)

    # spectral matching: each beat's long term spectrum toward the median beat
    specs = {}
    for r in gate["chosen"]:
        x = beat_audio[r["beat"]]
        a, b = int(r["body_start"] * SR), int((r["words"][-1][2] + 0.2) * SR)
        f, L = ltas(x[a:b], SR)
        specs[r["beat"]] = L - np.mean(L[(f > 200) & (f < 4000)])
    med = np.median(np.array(list(specs.values())), axis=0)
    eq_report = {}
    for bid, L in specs.items():
        cf, cv = third_octave_curve(f, med - L)
        h = eq_fir(cf, cv, SR)
        beat_audio[bid] = signal.fftconvolve(beat_audio[bid], h, mode="same")
        eq_report[bid] = [round(float(v), 2) for v in cv]

    b_warm, a_warm = biquad("peak", 200, SR, 1.5, 0.9)
    b_prox, a_prox = biquad("lowshelf", 130, SR, 1.5, 0.7)

    lines_out = []
    for r in gate["chosen"]:
        beat = beats[r["beat"]]
        x = beat_audio[r["beat"]]
        x = signal.lfilter(b_warm, a_warm, x)
        x = signal.lfilter(b_prox, a_prox, x)
        x = deess(x, SR)
        x = compress(x, SR)
        words = r["words"]
        wi = 0
        voiced = [ln for ln in beat["lines"] if ln["speaker"] == "N"]
        spans = []
        for ln in voiced:
            n = len(align.norm_words(ln["text"]))
            ws = words[wi:wi + n]
            wi += n
            spans.append((ln, ws))
        cuts = boundaries(x, SR, spans, r["calib_last"])
        for k, (ln, ws) in enumerate(spans):
            s, e = trim_silence(x, SR, cuts[k], cuts[k + 1], ws[0][1], ws[-1][2])
            seg = x[int(s * SR):int(e * SR)].copy()
            # shorten over long internal pauses (keep natural ones, cap at 0.5 s)
            seg, keep = cap_pauses(seg, SR, 0.5)
            kept = np.concatenate([[0], np.cumsum(keep)])
            loud = meter.integrated_loudness(seg) if len(seg) > 0.45 * SR else None
            if loud is None or not np.isfinite(loud):
                rms = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)
                loud = rms + 3.0
            seg = seg * 10 ** ((-20.0 - loud) / 20)
            fade = int(0.01 * SR)
            seg[:fade] *= np.linspace(0, 1, fade)
            seg[-fade:] *= np.linspace(1, 0, fade)
            path = os.path.join(OUT, "lines", f"{ln['id']}.wav")
            sf.write(path, seg.astype(np.float32), SR, subtype="FLOAT")
            lines_out.append({
                "id": ln["id"], "beat": r["beat"], "section": ln["section"], "text": ln["text"],
                "dur": round(len(seg) / SR, 4), "file": os.path.relpath(path, HERE),
                "words": [[w[0], remap(kept, w[1] - s), remap(kept, w[2] - s)] for w in ws],
                "onset": onset_offset(seg, SR)[0], "offset": onset_offset(seg, SR)[1],
            })
    # handwritten lines carry no audio
    order = [ln["id"] for b in beats.values() for ln in b["lines"]]
    byid = {l["id"]: l for l in lines_out}
    final = []
    for b in beats.values():
        for ln in b["lines"]:
            if ln["speaker"] == "N":
                final.append(byid[ln["id"]])
            else:
                final.append({"id": ln["id"], "beat": b["id"], "section": ln["section"], "text": ln["text"],
                              "speaker": ln["speaker"], "dur": 1.8, "file": None, "words": []})
    assert [l["id"] for l in final] == order
    json.dump({"lines": final, "eq_match_db": eq_report}, open(os.path.join(OUT, "voice_lines.json"), "w"), indent=1)
    tot = sum(l["dur"] for l in final if l.get("file"))
    print(f"{len(final)} lines, speech {tot:.1f} s")


def cap_pauses(seg, sr, cap):
    hop = int(0.01 * sr)
    n = len(seg) // hop
    if n < 3:
        return seg, np.ones(len(seg), bool)
    rms = np.array([np.sqrt(np.mean(seg[i * hop:(i + 1) * hop] ** 2)) for i in range(n)])
    db = 20 * np.log10(rms + 1e-9)
    quiet = db < np.percentile(db, 95) - 40
    keep = np.ones(len(seg), bool)
    i = 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            run = (j - i) * hop / sr
            if run > cap and i > 0 and j < n:
                cut = int((run - cap) * sr)
                mid = (i * hop + j * hop) // 2
                keep[mid - cut // 2: mid - cut // 2 + cut] = False
            i = j
        else:
            i += 1
    return seg[keep], keep


def onset_offset(seg, sr):
    idx, db = frame_db(seg, sr, 0.02, 0.005)
    loud = np.where(db > np.percentile(db, 98) - 30)[0]
    if len(loud) == 0:
        return 0.0, round(len(seg) / sr, 3)
    return round(idx[loud[0]] / sr, 3), round((idx[loud[-1]] + int(0.02 * sr)) / sr, 3)


def remap(kept, t):
    """time in the uncut segment to time after pause capping"""
    i = int(round(t * SR))
    i = min(max(i, 0), len(kept) - 1)
    return round(kept[i] / SR, 3)


if __name__ == "__main__":
    main()
