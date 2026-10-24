"""Voice consistency metrics for the 7.4 gate.

median F0 (pyin), F0 range (p10 to p90, semitones), speaking rate (words per
minute over voiced speech only), spectral centroid of speech frames, integrated
loudness, and a glitch scan (clipping, octave jumps inside voiced runs, long
silence gaps, buzzy segments with high spectral flatness).
"""
import numpy as np
import soundfile as sf
import librosa
import pyloudnorm as pyln


def load(path, sr=24000):
    x, s = sf.read(path, always_2d=False)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if s != sr:
        x = librosa.resample(x, orig_sr=s, target_sr=sr)
    return x.astype(np.float64), sr


def speech_mask(x, sr, hop=240, thresh_db=-35.0):
    rms = librosa.feature.rms(y=x, frame_length=hop * 4, hop_length=hop)[0]
    db = 20 * np.log10(rms + 1e-9)
    ref = np.percentile(db, 95)
    return db > ref + thresh_db, hop


def silences(x, sr, min_len=0.25, rel_db=-38.0, hop=120):
    """Return list of (start, end) seconds of pauses."""
    rms = librosa.feature.rms(y=x, frame_length=hop * 4, hop_length=hop, center=True)[0]
    db = 20 * np.log10(rms + 1e-9)
    ref = np.percentile(db, 95)
    quiet = db < ref + rel_db
    out = []
    i = 0
    n = len(quiet)
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            s, e = i * hop / sr, j * hop / sr
            if e - s >= min_len:
                out.append((s, e))
            i = j
        else:
            i += 1
    return out


def metrics(path, n_words):
    x, sr = load(path)
    mask, hop = speech_mask(x, sr)
    speech_sec = mask.sum() * hop / sr
    f0, vflag, vprob = librosa.pyin(x, fmin=55, fmax=300, sr=sr, frame_length=1024, hop_length=240)
    f0v = f0[vflag & ~np.isnan(f0)]
    med_f0 = float(np.median(f0v)) if len(f0v) else 0.0
    rng = float(12 * np.log2(np.percentile(f0v, 90) / np.percentile(f0v, 10))) if len(f0v) > 10 else 0.0
    S = np.abs(librosa.stft(x, n_fft=1024, hop_length=240))
    cent = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
    flat = librosa.feature.spectral_flatness(S=S)[0]
    m = min(len(cent), len(mask))
    sp = mask[:m]
    centroid = float(np.median(cent[:m][sp])) if sp.any() else 0.0
    meter = pyln.Meter(sr)
    lufs = float(meter.integrated_loudness(x)) if len(x) > sr * 0.5 else -70.0
    wpm = n_words / (speech_sec / 60.0) if speech_sec > 0 else 0.0
    # glitch scan
    flags = []
    if np.max(np.abs(x)) >= 0.999:
        flags.append("clipping")
    # octave jumps between consecutive voiced frames
    jumps = 0
    prev = None
    for v in f0:
        if np.isnan(v):
            prev = None
            continue
        if prev is not None and abs(np.log2(v / prev)) > 0.9:
            jumps += 1
        prev = v
    if jumps > 2:
        flags.append(f"pitch_jumps:{jumps}")
    gaps = [e - s for s, e in silences(x, sr)]
    if gaps and max(gaps) > 2.0:
        flags.append(f"long_gap:{max(gaps):.2f}")
    fl = flat[:m][sp]
    buzzy = float(np.mean(fl > 0.35)) if len(fl) else 0.0
    if buzzy > 0.08:
        flags.append(f"buzzy:{buzzy:.2f}")
    return {
        "f0": round(med_f0, 1), "f0_range_st": round(rng, 2), "wpm": round(wpm, 1),
        "centroid": round(centroid, 0), "lufs": round(lufs, 2), "dur": round(len(x) / sr, 2),
        "speech_sec": round(speech_sec, 2), "flags": flags,
    }


def gate(rows, keys=("f0", "wpm", "centroid"), tol=None):
    tol = tol or {"f0": 0.10, "wpm": 0.15, "centroid": 0.15}
    med = {k: float(np.median([r[k] for r in rows])) for k in keys}
    out = []
    for r in rows:
        fails = []
        for k in keys:
            dev = abs(r[k] - med[k]) / med[k] if med[k] else 0
            r[f"{k}_dev"] = round(dev, 3)
            if dev > tol[k]:
                fails.append(f"{k}:{dev:.0%}")
        fails += r.get("flags", [])
        r["pass"] = not fails
        r["fails"] = fails
        out.append(r)
    return med, out
