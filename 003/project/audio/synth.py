"""Procedural sound generators for Notice 003 (numpy and scipy only).

Every function returns float32 mono or stereo arrays at 48 kHz. Randomness is
seeded so the mix renders the same every time.
"""
import numpy as np
from scipy import signal

SR = 48000


def rng(seed):
    return np.random.default_rng(seed)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def adsr(n, a, d, s, r):
    a_, d_, r_ = int(a * SR), int(d * SR), int(r * SR)
    e = np.ones(n) * s
    if a_:
        e[:a_] = np.linspace(0, 1, a_)
    e[a_:a_ + d_] = np.linspace(1, s, max(1, min(d_, n - a_)))[: max(0, min(d_, n - a_))]
    if r_:
        e[-r_:] *= np.linspace(1, 0, r_)
    return e


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="bandpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    sos = signal.butter(order, f, btype="lowpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    sos = signal.butter(order, f, btype="highpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def sweep(x, fc, btype="lowpass", order=2, blk=512):
    """time varying filter: fc is a per sample cutoff array (or (lo, hi) arrays for a
    band pass); the filter state is carried across blocks so there are no seams"""
    out = np.zeros(len(x))
    zi = None
    for i in range(0, len(x), blk):
        if btype == "bandpass":
            w = [max(30.0, fc[0][i]), min(SR / 2 - 100, fc[1][i])]
        else:
            w = min(SR / 2 - 100, max(20.0, fc[i]))
        sos = signal.butter(order, w, btype=btype, fs=SR, output="sos")
        if zi is None or zi.shape[0] != sos.shape[0]:
            zi = np.zeros((sos.shape[0], 2))
        out[i:i + blk], zi = signal.sosfilt(sos, x[i:i + blk], zi=zi)
    return out


def noise(n, seed):
    return rng(seed).standard_normal(n)


def pink(n, seed):
    w = noise(n, seed)
    f = np.fft.rfftfreq(n, 1 / SR)
    s = np.fft.rfft(w) / np.sqrt(np.maximum(f, 15))
    x = np.fft.irfft(s, n)
    return x / (np.max(np.abs(x)) + 1e-9)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-12
    return x * (peak / m)


def stereo(x, pan=0.0, width=0.0, seed=0):
    """pan -1..1 equal power; width adds a tiny decorrelation (Haas under 0.4 ms)."""
    a = (pan + 1) * np.pi / 4
    left = x * np.cos(a)
    right = x * np.sin(a)
    if width > 0:
        d = int(0.0003 * SR * width)
        right = np.concatenate([np.zeros(d), right[: len(right) - d]]) if d else right
    return np.stack([left, right], axis=1).astype(np.float32)


# ---------------- shutter family ----------------
def shutter(strength=1.0, seed=1, advance=True):
    """mechanical shutter: mirror flap tick, curtain tick 28 ms later, a soft thump,
    then a short film advance whirr."""
    n = int(0.42 * SR)
    out = np.zeros(n)
    for k, (off, amp) in enumerate([(0.0, 1.0), (0.028, 0.7)]):
        i = int(off * SR)
        m = int(0.006 * SR)
        b = bp(noise(m, seed + k), 1800, 7000) * env_exp(m, 0.0012)
        out[i:i + m] += amp * norm(b)
    th = int(0.06 * SR)
    tt = np.arange(th) / SR
    out[:th] += 0.45 * strength * np.sin(2 * np.pi * (90 - 300 * tt) * tt) * env_exp(th, 0.015)
    if advance:
        i = int(0.07 * SR)
        m = int(0.2 * SR)
        tt = np.arange(m) / SR
        buzz = signal.sawtooth(2 * np.pi * 118 * tt) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 38 * tt)))
        buzz = bp(buzz + 0.3 * noise(m, seed + 7), 300, 3500) * adsr(m, 0.01, 0.05, 0.6, 0.06)
        out[i:i + m] += 0.18 * norm(buzz)
    return norm(out, 0.9 * strength)


def early_click(seed=3):
    """band limited, faint: the future arriving a little early"""
    m = int(0.012 * SR)
    b = bp(noise(m, seed), 1000, 4200, 3) * env_exp(m, 0.0016)
    tail = bp(noise(int(0.05 * SR), seed + 1), 900, 2500) * env_exp(int(0.05 * SR), 0.008) * 0.15
    x = np.concatenate([norm(b), np.zeros(int(0.004 * SR))])
    x = np.concatenate([x, tail])
    return lp(x, 3800)


# ---------------- transitions ----------------
def whoosh(dur=0.7, f0=250, f1=3200, seed=5, rev=False):
    n = int(dur * SR)
    x = noise(n, seed)
    t = np.arange(n) / n
    c = f0 * (f1 / f0) ** t
    out = sweep(x, (np.maximum(60, c * 0.6), np.minimum(18000, c * 1.6)), "bandpass", 1)
    e = np.sin(np.pi * t) ** 1.6
    y = norm(out * e)
    return y[::-1].copy() if rev else y


def reverse_swell(dur=1.2, seed=9, tone=110):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = lp(noise(n, seed), 2500) * 0.5 + np.sin(2 * np.pi * tone * t) * 0.6 + np.sin(2 * np.pi * tone * 1.5 * t) * 0.25
    e = (np.arange(n) / n) ** 2.6
    return norm(x * e)


def riser(dur=2.0, seed=11):
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = t / dur
    f = 180 * (8 ** k)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) * 0.35 + np.sin(ph * 1.5) * 0.15
    nz = hp(noise(n, seed), 800) * 0.4
    x = (tone + nz * k) * (k ** 2.2)
    return norm(x)


def sub_drop(dur=1.1, f0=95, f1=28):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * 0.35))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return norm(np.tanh(1.6 * np.sin(ph)) * env_exp(n, dur * 0.45))


def low_hit(dur=2.5, seed=13, ring=False):
    n = int(dur * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (52 - 14 * np.minimum(t / 0.2, 1)) * t) * env_exp(n, 0.35)
    trans = bp(noise(int(0.03 * SR), seed), 300, 5000) * env_exp(int(0.03 * SR), 0.004)
    x = body * 0.9
    x[: len(trans)] += 0.6 * norm(trans)
    if ring:
        # the ring of the unit flip: a few inharmonic partials, long tail
        for p, a in [(311.1, 0.18), (523.0, 0.12), (742.0, 0.08), (1187.0, 0.05)]:
            x += a * np.sin(2 * np.pi * p * t + 0.3) * env_exp(n, dur * 0.42)
    return norm(np.tanh(1.3 * x))


def paper_slide(dur=1.2, seed=15, speed=1.0):
    n = int(dur * SR)
    x = bp(noise(n, seed), 900, 6500)
    fric = 0.6 + 0.4 * np.abs(signal.sosfilt(signal.butter(1, 18 * speed, fs=SR, output="sos"), noise(n, seed + 1)))
    e = adsr(n, 0.08, 0.1, 0.8, 0.25)
    return norm(x * fric * e)


def paper_snap(seed=17):
    n = int(0.18 * SR)
    x = hp(noise(n, seed), 1500) * env_exp(n, 0.02)
    t = np.arange(n) / SR
    x += 0.4 * np.sin(2 * np.pi * 2400 * t) * env_exp(n, 0.008)
    return norm(x)


def paper_flip(seed=19):
    n = int(0.35 * SR)
    x = norm(bp(noise(n, seed), 500, 5000) * adsr(n, 0.02, 0.1, 0.4, 0.15))
    snap = paper_snap(seed + 1)
    i = int(0.12 * SR)
    x[i:i + len(snap)] += 0.5 * snap[: n - i]
    return norm(x)


def thump(seed=21, f=70, dur=0.25):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * env_exp(n, 0.05) + 0.3 * lp(noise(n, seed), 400) * env_exp(n, 0.02)
    return norm(x)


def cloth(dur=0.4, seed=23):
    n = int(dur * SR)
    x = bp(noise(n, seed), 400, 4000) * adsr(n, 0.05, 0.1, 0.5, 0.2)
    x *= 0.6 + 0.4 * np.abs(lp(noise(n, seed + 1), 30))
    return norm(x)


def glitch_zap(dur=0.18, seed=25):
    n = int(dur * SR)
    r = rng(seed)
    out = np.zeros(n)
    i = 0
    while i < n:
        seg = int(r.uniform(0.008, 0.03) * SR)
        f = r.choice([180, 360, 720, 1440, 2880])
        t = np.arange(min(seg, n - i)) / SR
        sq = np.sign(np.sin(2 * np.pi * f * t))
        out[i:i + len(t)] = sq * r.uniform(0.3, 1.0)
        i += seg
    out = np.round(out * 6) / 6
    return norm(bp(out, 150, 9000) * adsr(n, 0.002, 0.02, 0.8, 0.03))


def flicker_buzz(dur=0.25, seed=27):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = signal.square(2 * np.pi * 100 * t) * 0.4 + np.sin(2 * np.pi * 200 * t) * 0.3 + bp(noise(n, seed), 2000, 6000) * 0.2
    pat = np.interp(np.arange(n), np.linspace(0, n, 7), [1, 0.2, 1, 0.3, 1, 0.6, 0])
    return norm(lp(x, 5000) * pat)


def clock_tick(seed=29):
    n = int(0.08 * SR)
    x = bp(noise(n, seed), 1800, 3200) * env_exp(n, 0.004)
    t = np.arange(n) / SR
    x += 0.5 * np.sin(2 * np.pi * 1250 * t) * env_exp(n, 0.006)
    return norm(x)


def ping(f=1000, dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return norm((np.sin(2 * np.pi * f * t) + 0.08 * np.sin(2 * np.pi * 2 * f * t)) * env_exp(n, dur * 0.3) * (1 - np.exp(-t / 0.004)))


def heartbeat(seed=31):
    """lub dub, low and soft: felt more than heard"""
    n = int(0.55 * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for off, a in [(0.0, 1.0), (0.19, 0.65)]:
        i = int(off * SR)
        m = int(0.16 * SR)
        tt = np.arange(m) / SR
        out[i:i + m] += a * np.sin(2 * np.pi * (58 - 18 * tt / 0.16) * tt) * env_exp(m, 0.04)
    return norm(lp(out, 180))


def footstep(seed=33, surface="floor"):
    n = int(0.16 * SR)
    lo = thump(seed, 85 if surface == "floor" else 110, 0.16) * 0.7
    hi = bp(noise(n, seed + 1), 1500 if surface != "wet" else 900, 6000) * env_exp(n, 0.012) * (0.25 if surface != "wet" else 0.5)
    return norm(lo[:n] + hi)


def rain(dur, seed=35, heavy=0.5):
    n = int(dur * SR)
    bed = bp(pink(n, seed), 400, 9000) * 0.5
    r = rng(seed + 1)
    drops = np.zeros(n)
    k = int(dur * 60 * (0.5 + heavy))
    pos = r.integers(0, max(1, n - 400), k)
    for p in pos:
        m = 300
        drops[p:p + m] += r.uniform(0.2, 1.0) * bp(noise(m, int(p) % 9999), 2000, 8000) * env_exp(m, 0.002)
    return norm(bed + drops * 0.6)


def kettle(dur, seed=37):
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = np.clip(t / dur, 0, 1)
    rumble = sweep(noise(n, seed), 300 + 900 * k) * (0.3 + 0.7 * k)
    bubbles = bp(noise(n, seed + 1), 600, 2500) * (np.abs(lp(noise(n, seed + 2), 12)) * 3) * k
    hiss = hp(noise(n, seed + 3), 4000) * k ** 3 * 0.4
    return norm(rumble + bubbles + hiss)


def switch_click(seed=39):
    n = int(0.12 * SR)
    x = np.zeros(n)
    for off in (0.0, 0.035):
        i = int(off * SR)
        m = int(0.01 * SR)
        x[i:i + m] += bp(noise(m, seed + i), 1500, 6000) * env_exp(m, 0.0015)
    return norm(x)


def key_lock(dur=1.5, seed=41):
    n = int(dur * SR)
    out = np.zeros(n)
    m = int(0.35 * SR)
    scrape = bp(noise(m, seed), 2500, 9000) * adsr(m, 0.02, 0.05, 0.7, 0.1)
    out[int(0.15 * SR):int(0.15 * SR) + m] += 0.6 * norm(scrape)
    cl = thump(seed + 2, 140, 0.2) * 0.8 + 0.6 * np.concatenate([bp(noise(int(0.02 * SR), seed + 3), 1500, 5000) * env_exp(int(0.02 * SR), 0.003), np.zeros(int(0.18 * SR))])
    i = int(0.9 * SR)
    out[i:i + len(cl)] += cl[: n - i]
    return norm(out)


def drawer(dur=0.8, seed=43):
    n = int(dur * SR)
    x = lp(noise(n, seed), 900) * adsr(n, 0.05, 0.1, 0.8, 0.15)
    x *= 0.7 + 0.3 * np.abs(lp(noise(n, seed + 1), 40)) * 2
    end = thump(seed + 2, 120, 0.15)
    x[-len(end):] += 0.8 * end
    return norm(x)


def pen_scratch(dur, seed=45):
    n = int(dur * SR)
    t = np.arange(n) / SR
    strokes = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 3.2 * t + np.sin(2 * np.pi * 0.7 * t) * 2))
    x = bp(noise(n, seed), 2500, 8000) * lp(strokes, 30)
    return norm(x)


def stamp_hit(seed=47):
    return norm(0.8 * thump(seed, 95, 0.3) + 0.6 * np.pad(paper_snap(seed + 1), (0, int(0.3 * SR) - len(paper_snap(seed + 1))))[: int(0.3 * SR)])


def flash_pop(seed=49):
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    whine = np.sin(2 * np.pi * (1800 + 3500 * t / 0.45) * t) * np.clip(t / 0.45, 0, 1) * (t < 0.45) * 0.15
    pop = np.zeros(n)
    i = int(0.45 * SR)
    m = int(0.05 * SR)
    pop[i:i + m] = bp(noise(m, seed), 400, 8000) * env_exp(m, 0.006)
    return norm(whine + pop)


def booth_whirr(dur, seed=51):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = signal.sawtooth(2 * np.pi * 95 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 6 * t)) + 0.3 * bp(noise(n, seed), 300, 2000)
    return norm(lp(x, 1500) * adsr(n, 0.1, 0.1, 0.8, 0.2))


def body_thud(seed=53):
    n = int(0.5 * SR)
    x = thump(seed, 60, 0.5) * 1.0
    clatter = bp(noise(int(0.15 * SR), seed + 1), 800, 5000) * env_exp(int(0.15 * SR), 0.03)
    x[int(0.04 * SR):int(0.04 * SR) + len(clatter)] += 0.35 * clatter
    return norm(x)


def bell(f=880, dur=2.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * r * t) * env_exp(n, dur * d) for r, a, d in [(1, 1, 0.35), (2.76, 0.4, 0.15), (5.4, 0.2, 0.08), (0.5, 0.25, 0.4)])
    return norm(x * (1 - np.exp(-t / 0.002)))


def keyboard_typing(dur, seed=55):
    n = int(dur * SR)
    out = np.zeros(n)
    r = rng(seed)
    tt = 0.0
    while tt < dur - 0.05:
        i = int(tt * SR)
        m = int(0.03 * SR)
        out[i:i + m] += r.uniform(0.4, 1) * bp(noise(m, int(tt * 1000)), 1500, 6000) * env_exp(m, 0.004)
        tt += r.uniform(0.06, 0.22)
    return norm(out)


def traffic(dur, seed=57):
    n = int(dur * SR)
    x = lp(pink(n, seed), 600)
    sweeps = 0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * np.arange(n) / SR)
    return norm(x * sweeps)


def bus_pass(dur=4.0, seed=59):
    n = int(dur * SR)
    t = np.arange(n) / SR
    eng = signal.sawtooth(2 * np.pi * (48 + 6 * t) * t) * 0.5 + lp(noise(n, seed), 300) * 0.6
    e = np.exp(-((t - dur * 0.35) / (dur * 0.3)) ** 2)
    x = sweep(eng, 200 + 900 * e)
    return norm(x * e)


# ---------------- musical voices ----------------
def note_freq(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    p, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[p] + 12 * (o - 4) - 9) / 12)


def pizz(f, dur=1.4, seed=61):
    n = int(dur * SR)
    t = np.arange(n) / SR
    fdrop = f * (1 + 0.02 * np.exp(-t / 0.03))
    ph = 2 * np.pi * np.cumsum(fdrop) / SR
    x = np.sin(ph) * 0.8 + 0.25 * signal.sawtooth(ph, 0.5)
    x *= env_exp(n, 0.32)
    pl = bp(noise(int(0.01 * SR), seed), 200, 2000) * env_exp(int(0.01 * SR), 0.002)
    x[: len(pl)] += 0.3 * pl
    return norm(lp(x, 1200))


def epiano(f, dur=2.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    idx = 2.2 * np.exp(-t / 0.25)
    mod = np.sin(2 * np.pi * f * t) * idx
    x = np.sin(2 * np.pi * f * t + mod) * env_exp(n, 0.9) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * env_exp(n, 0.3)
    tine = np.sin(2 * np.pi * f * 7.1 * t) * env_exp(n, 0.02) * 0.08
    return norm((x + tine) * (1 - np.exp(-t / 0.003)))


def piano(f, dur=3.6, seed=63):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, a in [(1, 1.0), (2, 0.45), (3, 0.22), (4, 0.12), (5, 0.06)]:
        fk = f * k * (1 + 0.0004 * k * k)
        x += a * np.sin(2 * np.pi * fk * t) * env_exp(n, 1.6 / (1 + 0.6 * k))
    ham = lp(noise(int(0.02 * SR), seed), 3000) * env_exp(int(0.02 * SR), 0.003)
    x[: len(ham)] += 0.08 * ham
    return norm(lp(x, 4500) * (1 - np.exp(-t / 0.002)))


def string_pad(freqs, dur, seed=65):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    r = rng(seed)
    for f in freqs:
        for det in (-0.004, 0.0, 0.005):
            ph = r.uniform(0, 1)
            x += signal.sawtooth(2 * np.pi * f * (1 + det) * t + ph * 6.28) * 0.3
    x = lp(x, 1400)
    return norm(x * adsr(n, 1.2, 0.5, 0.85, 1.5))


def brush(seed=67):
    n = int(0.22 * SR)
    return norm(bp(noise(n, seed), 2500, 9000) * adsr(n, 0.03, 0.05, 0.5, 0.12))


def saw_cluster(freqs, dur, seed=69):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for det in (-0.003, 0.002):
            x += signal.sawtooth(2 * np.pi * f * (1 + det) * t + rng(seed).uniform(0, 6.28))
    return x


# ---------------- additions for the hook, Thing 3 and the turn ----------------
def page_flick(seed=71, bright=1.0):
    """one calendar page flicking past: a short airy snap"""
    n = int(0.05 * SR)
    lo, hi = 900 * bright, min(15000, 6500 * bright)
    return norm(bp(noise(n, seed), lo, hi) * env_exp(n, 0.008) * (1 - np.exp(-np.arange(n) / (0.0015 * SR))))


def blip(f=900, dur=0.05, drop=0.3):
    """soft pop: a sine with a fast pitch drop"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    ff = f * (1 + drop * np.exp(-t / 0.01))
    return norm(np.sin(2 * np.pi * np.cumsum(ff) / SR) * env_exp(n, dur * 0.3) * (1 - np.exp(-t / 0.001)))


def beep(f=2400, dur=0.07):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return norm(np.sin(2 * np.pi * f * t) * adsr(n, 0.003, 0.01, 0.9, 0.015))


def tape_rewind(dur=0.45, seed=73):
    """playback: a fast chirp down with tape hiss"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 2600 * (0.12 ** (t / dur))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = signal.sawtooth(ph) * 0.4 * (0.6 + 0.4 * np.sin(2 * np.pi * 31 * t)) + bp(noise(n, seed), 2000, 8000) * 0.3
    return norm(lp(x, 6000) * adsr(n, 0.01, 0.05, 0.8, 0.08))


def clink(seed=75):
    """cup set down on a saucer"""
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * t) * env_exp(n, d) for f, a, d in [(2650, 1, 0.05), (4130, 0.6, 0.03), (6020, 0.3, 0.02), (1870, 0.3, 0.07)])
    x[: int(0.004 * SR)] += bp(noise(int(0.004 * SR), seed), 2000, 9000) * 0.5
    return norm(x)


def digital_tick(f=3200):
    n = int(0.025 * SR)
    t = np.arange(n) / SR
    return norm(np.sign(np.sin(2 * np.pi * f * t)) * env_exp(n, 0.003))


def pulse_beat(seed=77):
    """the low pulse: felt more than heard, one beat (not a heartbeat lub dub)"""
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 42 + 14 * np.exp(-t / 0.05)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    x *= (1 - np.exp(-t / 0.008)) * env_exp(n, 0.13)
    return norm(np.tanh(1.4 * x))


def braam(dur=2.2, seed=79):
    """a trailer horn hit, low and brassy, for COMING SOON"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = saw_cluster([note_freq("A1"), note_freq("E2"), note_freq("A2"), note_freq("C3")], dur, seed)
    sw = 300 + 1800 * np.exp(-t / 0.35)
    out = sweep(x, sw)
    return norm(np.tanh(1.5 * out) * adsr(n, 0.02, 0.3, 0.7, 0.9))


def warm_hum(dur, seed=81):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * t + p) for f, a, p in [(55, 1, 0), (110, 0.45, 1), (165, 0.18, 2), (220, 0.08, 0.5)])
    x = x * (0.85 + 0.15 * np.sin(2 * np.pi * 0.7 * t)) + 0.1 * lp(noise(n, seed), 300)
    return norm(x * adsr(n, 0.4, 0.1, 1.0, 0.6))


def phone_buzz(seed=83):
    n = int(1.0 * SR)
    t = np.arange(n) / SR
    gate = ((t % 0.5) < 0.32).astype(float)
    x = signal.square(2 * np.pi * 170 * t) * 0.6 + np.sin(2 * np.pi * 340 * t) * 0.3
    x = lp(x, 1800) * lp(gate, 60)
    return norm(x + 0.15 * bp(noise(n, seed), 2000, 6000) * gate)


def sip(seed=85):
    n = int(0.35 * SR)
    x = bp(noise(n, seed), 700, 3200) * adsr(n, 0.05, 0.08, 0.6, 0.12)
    x *= 0.6 + 0.4 * np.abs(lp(noise(n, seed + 1), 25)) * 2
    return norm(x)


def vowel_burst(f0, dur, formants, seed, breath=0.25, h=0.04):
    """a voiced syllable through formant resonators, with an h onset"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = rng(seed)
    jit = 1 + 0.012 * lp(r.standard_normal(n), 25) * 6
    f = f0 * jit * (1 + 0.07 * np.exp(-t / 0.04)) * (1 - 0.08 * t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    hmax = int(4500 / f0)
    src = sum(np.sin(k * ph) / k ** 1.15 for k in range(1, hmax))
    src = src + breath * noise(n, seed + 1)
    out = np.zeros(n)
    for fc, bw, g in formants:
        out += g * bp(src, max(60, fc - bw), fc + bw, 2)
    asp = bp(noise(n, seed + 2), 600, 6000) * np.exp(-t / h) * 0.6
    e = np.minimum(1, t / (h * 1.5 + 0.005)) * env_exp(n, dur * 0.5)
    return asp * np.exp(-t / h) + out * e


def formant_laugh(n_syl=4, f0=225, seed=87):
    """a short, dry ha ha ha"""
    parts = []
    r = rng(seed)
    A = [(780, 90, 1.0), (1220, 110, 0.55), (2600, 170, 0.22)]
    for k in range(n_syl):
        d = 0.12 + 0.02 * r.uniform()
        parts.append(vowel_burst(f0 * (1 - 0.05 * k), d, A, seed + k * 7) * (1 - 0.12 * k))
        parts.append(np.zeros(int((0.06 + 0.02 * r.uniform()) * SR)))
    return norm(np.concatenate(parts))


def murmur(dur, seed=89):
    """someone beside you saying something small, heard through your own laugh: no words"""
    r = rng(seed)
    parts = []
    tt = 0.0
    vowels = [[(700, 90, 1), (1150, 110, 0.5)], [(400, 70, 1), (2000, 150, 0.4)], [(550, 80, 1), (900, 90, 0.6)], [(300, 60, 1), (2300, 160, 0.3)]]
    while tt < dur:
        d = r.uniform(0.09, 0.2)
        parts.append(vowel_burst(r.uniform(120, 150), d, vowels[r.integers(0, 4)], int(r.integers(1, 9999)), breath=0.15, h=0.02))
        g = r.uniform(0.02, 0.09)
        parts.append(np.zeros(int(g * SR)))
        tt += d + g
    x = np.concatenate(parts)[: int(dur * SR)]
    return norm(lp(x, 900))


def early_shutter(seed=91):
    """the signature: a faint, band limited shutter that arrives early, two blades and
    a breath of mechanism, nothing like a mouth sound"""
    n = int(0.09 * SR)
    out = np.zeros(n)
    for k, (off, amp) in enumerate([(0.0, 1.0), (0.026, 0.75)]):
        i = int(off * SR)
        m = int(0.005 * SR)
        out[i:i + m] += amp * norm(bp(noise(m, seed + k), 2200, 6500, 2)) * env_exp(m, 0.0011)
    tt = np.arange(int(0.03 * SR)) / SR
    out[: len(tt)] += 0.25 * np.sin(2 * np.pi * 160 * tt) * env_exp(len(tt), 0.008)
    mech = bp(noise(n, seed + 5), 900, 3000) * adsr(n, 0.005, 0.02, 0.25, 0.04) * 0.15
    return norm(lp(out + mech, 7000))


def ks_bass(f, dur=1.6, seed=93, damp=0.996, bright=0.5):
    """upright bass pizzicato: Karplus Strong plucked string with a woody body"""
    n = int(dur * SR)
    P = int(round(SR / f))
    exc = lp(noise(P, seed), 900 + 1800 * bright)
    exc = exc - exc.mean()
    x = np.zeros(n)
    x[:P] = exc
    a = np.zeros(P + 2)
    a[0] = 1.0
    a[P] = -damp * 0.5
    a[P + 1] = -damp * 0.5
    y = signal.lfilter([1.0], a, x)
    body = bp(y, 70, 900, 1) * 0.6 + lp(y, 260) * 0.8
    t = np.arange(n) / SR
    thumb = lp(noise(int(0.012 * SR), seed + 1), 600) * env_exp(int(0.012 * SR), 0.003)
    body[: len(thumb)] += 0.2 * norm(thumb)
    return norm(body * env_exp(n, dur * 0.42) * (1 - np.exp(-t / 0.002)))


def relay(seed=95):
    """a soft mechanical relay or counter flap"""
    n = int(0.06 * SR)
    x = np.zeros(n)
    for off, amp in ((0.0, 1.0), (0.012, 0.45)):
        i = int(off * SR)
        m = int(0.006 * SR)
        x[i:i + m] += amp * bp(noise(m, seed + i), 700, 3500) * env_exp(m, 0.0015)
    tt = np.arange(int(0.025 * SR)) / SR
    x[: len(tt)] += 0.3 * np.sin(2 * np.pi * 230 * tt) * env_exp(len(tt), 0.006)
    return norm(lp(x, 4000))


def puff(seed=97, f=1400, dur=0.07):
    """a breathy little puff of air (a laugh escaping, a bubble appearing)"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp(noise(n, seed), f * 0.6, f * 1.8, 1) * (1 - np.exp(-t / 0.004)) * env_exp(n, dur * 0.35)
    return norm(lp(x, 5000))


def wood_tok(f=620, seed=99):
    """a soft wooden tok"""
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * env_exp(n, 0.025) + 0.4 * np.sin(2 * np.pi * f * 2.7 * t) * env_exp(n, 0.008)
    x[: int(0.003 * SR)] += bp(noise(int(0.003 * SR), seed), 1000, 5000) * 0.3
    return norm(lp(x, 3500))


def play_clunk(seed=101):
    """a cassette play key: two clunks and a short motor settle"""
    n = int(0.35 * SR)
    x = np.zeros(n)
    for off, amp, f in ((0.0, 1.0, 140), (0.07, 0.6, 180)):
        i = int(off * SR)
        th = thump(seed + i, f, 0.12)
        x[i:i + len(th)] += amp * th
        m = int(0.008 * SR)
        x[i:i + m] += amp * 0.5 * bp(noise(m, seed + 3 + i), 800, 4000) * env_exp(m, 0.002)
    tt = np.arange(n) / SR
    motor = lp(signal.sawtooth(2 * np.pi * (52 + 8 * np.exp(-tt / 0.08)) * tt), 300) * adsr(n, 0.05, 0.05, 0.6, 0.15) * 0.25
    return norm(x + motor)
