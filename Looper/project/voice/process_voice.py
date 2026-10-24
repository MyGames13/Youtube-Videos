"""Voice processing (sections 7.3 and 7.4).

1. trim any leaked lead in (trims.json, from the transcript check)
2. find line boundaries by aligning detected pauses to the script
3. identical processing chain on every beat, spectral match to the median beat
4. re time pauses by design, assemble the narration at 48 kHz
5. consistency gate, write voice_report.json and lines.json
"""
import json
import os
import sys

import librosa
import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SR_IN = 24000
SR = 48000
RNG = np.random.default_rng(1414)

S = json.load(open(os.path.join(HERE, 'script.json')))
BEATS = json.load(open(os.path.join(HERE, 'beats.json')))
TRIMS = json.load(open(os.path.join(HERE, 'trims.json'))) if os.path.exists(os.path.join(HERE, 'trims.json')) else {}


def env_db(y, sr, hop=0.005):
    h = int(sr * hop)
    rms = librosa.feature.rms(y=y, frame_length=h * 4, hop_length=h, center=True)[0]
    return 20 * np.log10(rms + 1e-9), hop


def speech_runs(y, sr, thr=-46.0, min_gap=0.09):
    db, hop = env_db(y, sr)
    m = db > thr
    runs = []
    start = None
    last = 0
    g = int(min_gap / hop)
    for i, v in enumerate(m):
        if v:
            if start is None:
                start = i
            last = i
        elif start is not None and i - last > g:
            runs.append([start * hop, (last + 1) * hop])
            start = None
    if start is not None:
        runs.append([start * hop, (last + 1) * hop])
    return [r for r in runs if r[1] - r[0] > 0.05]


def align_lines(runs, lines):
    """Choose line boundaries among gaps (DP), durations ~ proportional to text length."""
    gaps = [(runs[i][1], runs[i + 1][0]) for i in range(len(runs) - 1)]
    K = len(lines) - 1
    if K == 0:
        return [(runs[0][0], runs[-1][1])]
    t0, t1 = runs[0][0], runs[-1][1]
    w = np.array([len(l) + 6 for l in lines], float)
    speech = t1 - t0
    exp_cum = np.cumsum(w)[:-1] / w.sum() * speech + t0
    G = len(gaps)
    INF = 1e18
    # cost[k][g]: best cost placing boundary k at gap g
    cost = np.full((K, G), INF)
    back = np.zeros((K, G), int)
    def gc(k, g):
        a, b = gaps[g]
        mid = (a + b) / 2
        glen = b - a
        return ((mid - exp_cum[k]) / max(speech * 0.08, 0.6)) ** 2 + 1.2 / (glen + 0.05)
    for g in range(G):
        cost[0][g] = gc(0, g)
    for k in range(1, K):
        best = INF
        bi = -1
        for g in range(G):
            if g - 1 >= 0 and cost[k - 1][g - 1] < best:
                best = cost[k - 1][g - 1]
                bi = g - 1
            if bi >= 0:
                cost[k][g] = best + gc(k, g)
                back[k][g] = bi
    g = int(np.argmin(cost[K - 1]))
    chosen = [g]
    for k in range(K - 1, 0, -1):
        g = back[k][g]
        chosen.append(g)
    chosen = chosen[::-1]
    bounds = []
    s = t0
    for g in chosen:
        bounds.append((s, gaps[g][0]))
        s = gaps[g][1]
    bounds.append((s, t1))
    return bounds


# ---------- processing chain (identical on every beat) ----------
def biquad_shelf(f0, gain_db, sr, kind='low', q=0.707):
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / sr
    alpha = np.sin(w0) / (2 * q)
    cw = np.cos(w0)
    if kind == 'low':
        b0 = A * ((A + 1) - (A - 1) * cw + 2 * np.sqrt(A) * alpha)
        b1 = 2 * A * ((A - 1) - (A + 1) * cw)
        b2 = A * ((A + 1) - (A - 1) * cw - 2 * np.sqrt(A) * alpha)
        a0 = (A + 1) + (A - 1) * cw + 2 * np.sqrt(A) * alpha
        a1 = -2 * ((A - 1) + (A + 1) * cw)
        a2 = (A + 1) + (A - 1) * cw - 2 * np.sqrt(A) * alpha
    else:
        b0 = A * ((A + 1) + (A - 1) * cw + 2 * np.sqrt(A) * alpha)
        b1 = -2 * A * ((A - 1) + (A + 1) * cw)
        b2 = A * ((A + 1) + (A - 1) * cw - 2 * np.sqrt(A) * alpha)
        a0 = (A + 1) - (A - 1) * cw + 2 * np.sqrt(A) * alpha
        a1 = 2 * ((A - 1) - (A + 1) * cw)
        a2 = (A + 1) - (A - 1) * cw - 2 * np.sqrt(A) * alpha
    return np.array([b0, b1, b2]) / a0, np.array([1, a1 / a0, a2 / a0])


def peak(f0, gain_db, q, sr):
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / sr
    alpha = np.sin(w0) / (2 * q)
    cw = np.cos(w0)
    b = np.array([1 + alpha * A, -2 * cw, 1 - alpha * A])
    a = np.array([1 + alpha / A, -2 * cw, 1 - alpha / A])
    return b / a[0], a / a[0]


def compress(y, sr, thr_db=-24, ratio=3.0, att=0.006, rel=0.12, makeup=0.0):
    env = np.abs(y)
    a_a = np.exp(-1 / (att * sr))
    a_r = np.exp(-1 / (rel * sr))
    e = signal.lfilter([1 - a_r], [1, -a_r], env)  # smooth
    e = np.maximum(e, 1e-6)
    db = 20 * np.log10(e)
    over = np.maximum(0, db - thr_db)
    gr = -over * (1 - 1 / ratio)
    g = 10 ** ((gr + makeup) / 20)
    g = signal.lfilter([1 - a_a], [1, -a_a], g)
    return y * g


def deess(y, sr, f=6500, thr_db=-34, ratio=4):
    b, a = signal.butter(2, f / (sr / 2), 'high')
    hi = signal.lfilter(b, a, y)
    env = signal.lfilter([0.01], [1, -0.99], np.abs(hi))
    db = 20 * np.log10(env + 1e-9)
    gr = -np.maximum(0, db - thr_db) * (1 - 1 / ratio)
    g = 10 ** (gr / 20)
    return y - hi + hi * g


def chain(y, sr):
    b, a = signal.butter(2, 80 / (sr / 2), 'high')
    y = signal.lfilter(b, a, y)
    y = deess(y, sr)
    b, a = biquad_shelf(140, 1.5, sr, 'low')  # proximity
    y = signal.lfilter(b, a, y)
    b, a = peak(200, 1.5, 0.9, sr)  # warmth
    y = signal.lfilter(b, a, y)
    b, a = biquad_shelf(9000, -1.0, sr, 'high')
    y = signal.lfilter(b, a, y)
    y = compress(y, sr, thr_db=-26, ratio=3.0)
    return y


def ltas(y, sr):
    f, p = signal.welch(y, sr, nperseg=4096)
    return f, 10 * np.log10(p + 1e-14)


BANDS = [100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000]


def band_levels(y, sr):
    f, p = ltas(y, sr)
    out = []
    for i, c in enumerate(BANDS):
        lo, hi = c / 1.41, c * 1.41
        m = (f >= lo) & (f < hi)
        out.append(p[m].mean())
    return np.array(out)


def match_eq(y, sr, target, own):
    diff = np.clip(target - own, -3, 3)
    diff -= diff.mean()
    freqs = [0] + BANDS + [sr / 2]
    gains = [diff[0]] + list(diff) + [diff[-1]]
    taps = signal.firwin2(1023, np.array(freqs) / (sr / 2), 10 ** (np.array(gains) / 20))
    return signal.fftconvolve(y, taps, mode='same')


def f0_stats(y, sr):
    f0, vf, _ = librosa.pyin(y, fmin=60, fmax=300, sr=sr, frame_length=2048, hop_length=512)
    f = f0[~np.isnan(f0)]
    jumps = 0
    if len(f) > 2:
        r = np.abs(np.diff(np.log2(f0)))
        jumps = int(np.nansum(r > 1.0))
    return (float(np.median(f)) if len(f) else 0.0, float(np.percentile(f, 95) - np.percentile(f, 5)) if len(f) else 0.0, jumps)


# key line pauses (before, after) in seconds; default sentence gap below
PAUSE_BEFORE = {
    'Time travel is useless.': 1.05,
    'Nobody came.': 0.7,
    'You want her.': 0.55,
    'And you sit.': 0.6,
    'Pick up.': 0.95,
    "It's a rule.": 0.35,
    'The math says no.': 0.45,
    'Remember that.': 0.45,
}
PAUSE_AFTER = {
    'And you sit.': 1.55,
    'Remember that.': 0.75,
    "It's a rule.": 0.75,
    'Give me three minutes, and I\'ll prove it.': 0.75,
    'Attempt two hundred and fifteen. You just go.': 0.8,
    'You were the part nobody could explain.': 0.85,
    'The math says no.': 0.45,
}
FAST_ACTS = {2}


def main():
    meter = pyln.Meter(SR)
    beats = []
    for b in S['beats']:
        y, sr = sf.read(BEATS[b['id']])
        if y.ndim > 1:
            y = y.mean(1)
        cut = TRIMS.get(b['id'], 0.0)
        y = y[int(cut * sr):]
        y = librosa.resample(y, orig_sr=sr, target_sr=SR, res_type='soxr_hq')
        runs = speech_runs(y, SR)
        bounds = align_lines(runs, b['lines'])
        # clipping in the source: runs of 3+ consecutive samples at full scale
        hot = np.abs(y) > 0.995
        raw_runs = int(np.sum(hot[2:] & hot[1:-1] & hot[:-2]))
        beats.append(dict(b=b, y=y, runs=runs, bounds=bounds, raw_peak_runs=raw_runs))

    # processing chain then beat loudness normalise
    for B in beats:
        y = chain(B['y'], SR)
        speech = np.concatenate([y[int(a * SR):int(c * SR)] for a, c in B['bounds']])
        g = 10 ** ((-20 - meter.integrated_loudness(speech)) / 20)
        B['y'] = y * g
    # spectral matching to the median beat
    levels = np.array([band_levels(np.concatenate([B['y'][int(a * SR):int(c * SR)] for a, c in B['bounds']]), SR) for B in beats])
    med = np.median(levels, axis=0)
    for B, lv in zip(beats, levels):
        B['y'] = match_eq(B['y'], SR, med, lv)
        B['eq'] = np.round(np.clip(med - lv, -3, 3), 2).tolist()

    # assemble with designed pauses
    out = []
    lines = []
    t = 0.0
    lead = 1.1  # breath and glow before the first line
    out.append(np.zeros(int(lead * SR)))
    t = lead
    prev_text = None
    for bi, B in enumerate(beats):
        act = B['b']['act']
        for li, (text, (a, c)) in enumerate(zip(B['b']['lines'], B['bounds'])):
            a0 = max(0, a - 0.03)
            c0 = c + 0.06
            seg = B['y'][int(a0 * SR):int(c0 * SR)].copy()
            # compress long internal pauses (> 0.42 s) to 0.36 s
            inner = [r for r in B['runs'] if r[0] >= a - 1e-3 and r[1] <= c + 1e-3]
            out_runs = []
            if len(inner) > 1:
                parts = []
                for k, r in enumerate(inner):
                    s0 = int((r[0] - a0) * SR)
                    s1 = int((r[1] - a0) * SR)
                    if k == 0:
                        s0 = 0
                    if k == len(inner) - 1:
                        s1 = len(seg)
                    pos0 = sum(len(x) for x in parts) / SR
                    out_runs.append([pos0 + (0 if k == 0 else 0), pos0 + (s1 - s0) / SR])
                    parts.append(seg[s0:s1])
                    if k < len(inner) - 1:
                        gap = inner[k + 1][0] - r[1]
                        keep = min(gap, 0.3 if act not in FAST_ACTS else 0.22)
                        g0 = int((r[1] - a0) * SR)
                        parts.append(seg[g0:g0 + int(keep * SR)])
                seg = np.concatenate(parts)
            # 10 ms fades
            f = int(0.01 * SR)
            seg[:f] *= np.linspace(0, 1, f)
            seg[-f:] *= np.linspace(1, 0, f)
            # pause before this line
            if prev_text is not None:
                base = 0.2 if act in FAST_ACTS else 0.28
                if li == 0:
                    base = 0.48  # new beat or act
                pause = max(base, PAUSE_AFTER.get(prev_text, 0), PAUSE_BEFORE.get(text, 0))
                pause += float(RNG.uniform(-0.05, 0.05))
                out.append(np.zeros(int(pause * SR)))
                t += pause
            start = t
            out.append(seg)
            t += len(seg) / SR
            if not out_runs:
                out_runs = [[0.03, len(seg) / SR - 0.06]]
            lines.append(dict(id=f"{B['b']['id']}.{li + 1}", beat=B['b']['id'], act=act, text=text, start=round(start + 0.03, 3), end=round(t - 0.06, 3),
                              runs=[[round(start + x, 3), round(start + y, 3)] for x, y in out_runs]))
            prev_text = text
    out.append(np.zeros(int(0.5 * SR)))
    voice = np.concatenate(out)

    # consistency gate per beat
    rep = []
    for B in beats:
        sp = np.concatenate([B['y'][int(a * SR):int(c * SR)] for a, c in B['bounds']])
        words = len(' '.join(B['b']['lines']).split())
        dur = sum(c - a for a, c in B['bounds'])
        f0m, f0r, jumps = f0_stats(librosa.resample(sp, orig_sr=SR, target_sr=16000), 16000)
        rmsf = librosa.feature.rms(y=sp, frame_length=2048, hop_length=512)[0]
        act = 20 * np.log10(rmsf + 1e-9) > 20 * np.log10(rmsf.max() + 1e-9) - 22
        centf = librosa.feature.spectral_centroid(y=sp, sr=SR, n_fft=2048, hop_length=512)[0]
        cent = float(np.median(centf[act[:len(centf)]]))
        flatf = librosa.feature.spectral_flatness(y=sp, n_fft=2048, hop_length=512)[0]
        flat = float(np.percentile(flatf[act[:len(flatf)]], 95))
        raw = B['raw_peak_runs']
        clip = int(raw)
        rep.append(dict(beat=B['b']['id'], f0=round(f0m, 1), f0_range=round(f0r, 1), wpm=round(words / dur * 60, 1), centroid=round(cent),
                        lufs=round(meter.integrated_loudness(sp), 2), flat95=round(flat, 3), jumps=jumps, clip=clip, eq=B['eq']))
    keys = ['f0', 'wpm', 'centroid', 'lufs']
    med = {k: float(np.median([r[k] for r in rep])) for k in keys}
    lim = {'f0': 0.10, 'wpm': 0.15, 'centroid': 0.15}
    worst = {}
    for r in rep:
        fails = []
        for k in ('f0', 'wpm', 'centroid'):
            d = abs(r[k] - med[k]) / med[k]
            r[f'd_{k}'] = round(d * 100, 1)
            worst[k] = max(worst.get(k, 0), d * 100)
            if d > lim[k]:
                fails.append(k)
        dl = abs(r['lufs'] - med['lufs'])
        r['d_lufs'] = round(dl, 2)
        worst['lufs'] = max(worst.get('lufs', 0), dl)
        if dl > 1.5:
            fails.append('lufs')
        if r['clip'] > 40 or r['flat95'] > 0.5 or r['jumps'] > 6:
            fails.append('glitch')
        r['pass'] = not fails
        r['fails'] = fails
    json.dump(dict(median=med, worst={k: round(v, 2) for k, v in worst.items()}, beats=rep), open(os.path.join(HERE, 'voice_report.json'), 'w'), indent=1)
    # uniform pitch preserving tempo lift (rubberband), timings scale with it
    TEMPO = 1.045
    tmp_in = os.path.join(HERE, '_pre_tempo.wav')
    tmp_out = os.path.join(HERE, '_post_tempo.wav')
    sf.write(tmp_in, voice, SR, subtype='FLOAT')
    os.system(f'ffmpeg -y -loglevel error -i "{tmp_in}" -af "rubberband=tempo={TEMPO}:pitchq=quality:transients=smooth" -ar {SR} -c:a pcm_f32le "{tmp_out}"')
    voice, _ = sf.read(tmp_out)
    os.remove(tmp_in)
    os.remove(tmp_out)
    for L in lines:
        L['start'] = round(L['start'] / TEMPO, 3)
        L['end'] = round(L['end'] / TEMPO, 3)
        L['runs'] = [[round(a / TEMPO, 3), round(b / TEMPO, 3)] for a, b in L['runs']]
    peakv = np.abs(voice).max()
    voice = voice / max(peakv, 1e-6) * 0.89 if peakv > 0.89 else voice
    sf.write(os.path.join(HERE, 'narration_48k.wav'), voice, SR, subtype='PCM_24')
    json.dump(dict(duration=round(len(voice) / SR, 3), lines=lines), open(os.path.join(HERE, 'lines.json'), 'w'), indent=1)
    for r in rep:
        print(r['beat'], 'PASS' if r['pass'] else 'FAIL ' + ','.join(r['fails']), {k: r[k] for k in ('f0', 'wpm', 'centroid', 'flat95', 'clip', 'jumps', 'd_f0', 'd_wpm', 'd_centroid', 'd_lufs')})
    print('narration', round(len(voice) / SR, 2), 's', 'worst', worst)


if __name__ == '__main__':
    main()
