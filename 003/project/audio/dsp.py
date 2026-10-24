"""Shared offline DSP for the voice and the master (numpy and scipy only)."""
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d


def _release(gr, a, block=4800):
    """y[n] = max(gr[n], a * y[n-1]) without a Python loop over samples."""
    y = np.empty_like(gr)
    carry = 0.0
    for s in range(0, len(gr), block):
        g = gr[s:s + block]
        k = np.arange(len(g))
        ak = a ** k
        run = np.maximum.accumulate(np.maximum(g / ak, 0))
        yy = np.maximum(run * ak, carry * a ** (k + 1))
        y[s:s + block] = yy
        carry = yy[-1]
    return y


def limiter(x, ceiling_db=-1.0, sr=48000, lookahead_ms=3.0, release_ms=80.0, oversample=4):
    """Look-ahead peak limiter, linked across channels. Peaks are measured on a 4x
    oversampled signal so the ceiling holds for true peak too."""
    x2 = x[:, None] if x.ndim == 1 else x
    n = len(x2)
    if oversample > 1:
        up = signal.resample_poly(x2, oversample, 1, axis=0)
        a = np.abs(up).max(axis=1)[: n * oversample]
        a = np.pad(a, (0, n * oversample - len(a))).reshape(n, oversample).max(axis=1)
    else:
        a = np.abs(x2).max(axis=1)
    thr = 10 ** (ceiling_db / 20)
    req = np.minimum(1.0, thr / np.maximum(a, 1e-12))
    L = max(2, int(lookahead_ms * 1e-3 * sr))
    g = minimum_filter1d(req, size=2 * L + 1, mode="nearest")
    g = uniform_filter1d(g, size=L, mode="nearest")
    gr = -20 * np.log10(np.maximum(g, 1e-6))
    gr = _release(gr, np.exp(-1.0 / (release_ms * 1e-3 * sr)))
    gain = 10 ** (-gr / 20)
    y = x2 * gain[:, None]
    return (y[:, 0] if x.ndim == 1 else y), gr


def true_peak_db(x, oversample=4):
    x2 = x[:, None] if x.ndim == 1 else x
    up = signal.resample_poly(x2, oversample, 1, axis=0)
    return 20 * np.log10(np.abs(up).max() + 1e-12)


def declick(x, sr, words, margin=0.025, crest_db=14.0, floor_db=-46.0, depth_db=-20.0):
    """Attenuate mouth clicks between words. A click is a 1 ms high band peak far
    above its local median, at least `margin` seconds away from any aligned word."""
    from scipy.ndimage import median_filter
    hp = signal.sosfilt(signal.butter(4, 2500, btype="highpass", fs=sr, output="sos"), x)
    w = int(0.001 * sr)
    env = np.abs(hp)
    starts = np.arange(0, len(env), w)
    pk = np.maximum.reduceat(env, starts)
    med = median_filter(pk, size=41)
    crest = 20 * np.log10((pk + 1e-9) / (med + 1e-9))
    lvl = 20 * np.log10(pk + 1e-9)
    hit = (crest > crest_db) & (lvl > floor_db)
    ws = np.array(sorted(words))
    t = starts / sr
    inside = np.zeros(len(t), bool)
    if len(ws):
        j = np.searchsorted(ws[:, 0], t + margin, side="right") - 1
        ok = j >= 0
        inside[ok] = t[ok] <= ws[j[ok], 1] + margin
        # also the next word starting within the margin
        j2 = np.clip(j + 1, 0, len(ws) - 1)
        inside |= np.abs(ws[j2, 0] - t) < margin
    hit &= ~inside
    gain_db = np.zeros(len(x))
    events = 0
    for i in np.where(hit)[0]:
        a = max(0, starts[i] - int(0.004 * sr))
        b = min(len(x), starts[i] + int(0.008 * sr))
        gain_db[a:b] = depth_db
        events += 1
    # 2 ms ramps
    gain_db = uniform_filter1d(gain_db, int(0.002 * sr))
    return x * 10 ** (gain_db / 20), events
