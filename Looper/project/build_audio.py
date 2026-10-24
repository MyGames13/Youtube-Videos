"""Procedural sound design and mix for Loophole 001 (section 8).
Reads src/timeline.json (the same file the picture uses) and voice/narration_48k.wav.
Everything is synthesised here with numpy and scipy: no samples, no third party audio.
Writes output/audio_mix.wav (48 kHz, 24 bit) and output/voiceover_master.wav.
"""
import json
import os

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'output')
os.makedirs(OUT, exist_ok=True)
SR = 48000
TL = json.load(open(os.path.join(HERE, 'src', 'timeline.json')))
DUR = TL['duration']
N = int(DUR * SR) + SR
RNG = np.random.default_rng(1414)

BPM = 72.0
BEAT = 60.0 / BPM  # Loop Motif beat length, also the loop note echo delay
A4 = 440.0


def hz(note):
    """note name like A4, C#5"""
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}
    n = note[:-1]
    o = int(note[-1])
    return A4 * 2 ** ((names[n] + (o - 4) * 12) / 12)


def tt(d):
    return np.arange(int(d * SR)) / SR


def env_ad(n, a, d, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) * curve / max(d, 1e-4))
    return e


def lp(x, f, order=2):
    b, a = signal.butter(order, min(0.99, f / (SR / 2)), 'low')
    return signal.lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = signal.butter(order, max(1e-4, f / (SR / 2)), 'high')
    return signal.lfilter(b, a, x)


def bp(x, f1, f2, order=2):
    b, a = signal.butter(order, [f1 / (SR / 2), min(0.99, f2 / (SR / 2))], 'band')
    return signal.lfilter(b, a, x)


def noise(d, seed=None):
    r = np.random.default_rng(seed) if seed is not None else RNG
    return r.standard_normal(int(d * SR))


def pink(d, seed=None):
    w = noise(d, seed)
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w) * 3


def reson(x, f, q=30, gain=1.0):
    b, a = signal.iirpeak(min(f, SR / 2 - 100) / (SR / 2), q)
    return signal.lfilter(b, a, x) * gain


def stereo(m, pan=0.0, width=0.0):
    pan = np.clip(pan, -1, 1)
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    out = np.vstack([m * l, m * r])
    if width > 0:
        d = int(0.011 * SR)
        out[1] = (1 - width) * out[1] + width * np.concatenate([np.zeros(d), out[1][:-d]])
    return out


_ir_cache = {}


def ir(decay, seed=7, damp=5000):
    key = (decay, seed, damp)
    if key in _ir_cache:
        return _ir_cache[key]
    n = int(decay * SR * 1.2)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    e = np.exp(-t * 6.9 / decay)
    L = lp(r.standard_normal(n), damp) * e
    R = lp(r.standard_normal(n), damp) * e
    L[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    R[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    L /= np.sqrt(np.sum(L ** 2))
    R /= np.sqrt(np.sum(R ** 2))
    _ir_cache[key] = (L, R)
    return L, R


def reverb(st, decay=1.6, wet=0.3, damp=5000, seed=7):
    L, R = ir(decay, seed, damp)
    if st.ndim == 1:
        st = np.vstack([st, st])
    wl = signal.fftconvolve(st[0], L)[: st.shape[1]]
    wr = signal.fftconvolve(st[1], R)[: st.shape[1]]
    return st * (1 - wet) + np.vstack([wl, wr]) * wet * 1.2


def db(x):
    return 10 ** (x / 20)


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N))

    def add(self, sig, t, gain_db=0.0):
        if sig.ndim == 1:
            sig = np.vstack([sig, sig])
        i = int(t * SR)
        if i >= N:
            return
        j = min(N, i + sig.shape[1])
        if i < 0:
            sig = sig[:, -i:]
            j = min(N, sig.shape[1])
            i = 0
        self.x[:, i:j] += sig[:, : j - i] * db(gain_db)


voice_fx = Bus()  # foley and hits
beds = Bus()
music = Bus()
sub = Bus()

# ---------------- sound library ----------------

def s_click(f=3000, d=0.03, q=12):
    x = noise(d) * env_ad(int(d * SR), 0.0005, d * 0.3, 6)
    return reson(x, f, q, 1.0) + x * 0.2


def s_brass_click():
    x = noise(0.25) * env_ad(int(0.25 * SR), 0.0004, 0.01, 8)
    y = sum(reson(x, f, 60, g) for f, g in [(2350, 1.0), (4150, 0.7), (6720, 0.5), (1180, 0.4)])
    y += np.sin(2 * np.pi * 3100 * tt(0.25)) * env_ad(int(0.25 * SR), 0.0005, 0.12, 5) * 0.15
    return y


def s_crown_turn():
    out = np.zeros(int(0.45 * SR))
    for k in range(7):
        c = s_click(3800 + k * 120, 0.02, 20) * 0.6
        i = int(k * 0.055 * SR)
        out[i : i + len(c)] += c
    return out


def s_tick(pitch=1.0):
    x = noise(0.06) * env_ad(int(0.06 * SR), 0.0003, 0.004, 8)
    y = reson(x, 4300 * pitch, 50, 1.0) + reson(x, 7100 * pitch, 60, 0.6) + reson(x, 1900 * pitch, 30, 0.3)
    y += np.sin(2 * np.pi * 5200 * pitch * tt(0.06)) * env_ad(int(0.06 * SR), 0.0003, 0.03, 6) * 0.08
    return y


def s_buzz(d, dist=0.0):
    t = tt(d)
    car = signal.sawtooth(2 * np.pi * 172 * t) * 0.6 + np.sin(2 * np.pi * 344 * t) * 0.3
    gate = ((t % 0.6) < 0.38).astype(float)
    gate = lp(gate, 40)
    x = car * gate
    x = bp(x, 120, 2400) + reson(x, 640, 4, 0.4)
    if dist > 0:
        x = lp(x, 2400 - dist * 1600)
    return x * 0.7


def s_ring(d, warm=True):
    """warm, slightly old fashioned two tone ring"""
    t = tt(d)
    trill = (np.sign(np.sin(2 * np.pi * 18 * t)) + 1) / 2
    f = np.where(trill > 0.5, 740, 932)
    ph = np.cumsum(2 * np.pi * f / SR)
    x = np.sin(ph) * 0.6 + np.sin(2 * ph) * 0.2 + np.sin(3 * ph) * 0.08
    cad = ((t % 2.4) < 1.0).astype(float)
    cad = lp(cad, 30)
    x *= cad
    x = bp(x, 420, 3400)
    return x * 0.5


def s_ringback(d):
    t = tt(d)
    x = (np.sin(2 * np.pi * 425 * t) + np.sin(2 * np.pi * 450 * t)) * 0.5
    cad = ((t % 3.0) < 1.0).astype(float)
    return bp(x * lp(cad, 30), 300, 2400) * 0.35


def s_hit(big=0):
    d = 1.6 if big else 1.0
    t = tt(d)
    f = 58 * np.exp(-t * 3) + 36
    ph = np.cumsum(2 * np.pi * f / SR)
    body = np.sin(ph) * env_ad(len(t), 0.002, 0.6 if big else 0.4, 4)
    click = lp(noise(d), 3000) * env_ad(len(t), 0.0005, 0.02, 8) * 0.5
    thump = lp(noise(d), 180) * env_ad(len(t), 0.001, 0.12, 6) * 2.0
    y = body * 1.2 + click + thump + np.tanh(body * 3) * 0.25
    return y


def s_sub_drop():
    t = tt(1.4)
    f = 65 * np.exp(-t * 1.6) + 28
    ph = np.cumsum(2 * np.pi * f / SR)
    return np.sin(ph) * env_ad(len(t), 0.01, 1.0, 3) * 1.1


def s_reverse_swell(d=1.0):
    x = bp(noise(d), 200, 6000) * 0.4 + np.sin(2 * np.pi * hz('A3') * tt(d)) * 0.2 + np.sin(2 * np.pi * hz('E4') * tt(d)) * 0.15
    x *= np.linspace(0, 1, len(x)) ** 2.5
    x[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return x


def s_whoosh(d=0.6, f0=300, f1=4000, glass=True):
    n = int(d * SR)
    x = noise(d)
    out = np.zeros(n)
    seg = 512
    for i in range(0, n, seg):
        k = i / n
        f = f0 * (f1 / f0) ** k
        out[i : i + seg] = x[i : i + seg]
    y = bp(out, max(40, f0 * 0.5), min(18000, f1 * 1.3))
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
    y *= e
    if glass:
        y += np.sin(2 * np.pi * np.linspace(f1 * 0.4, f1 * 0.7, n) * np.arange(n) / SR) * e * 0.04
    return lp(y, 6500)


def s_tape_suck(d=0.35):
    t = tt(d)
    f = 900 * (1 - t / d) ** 2 + 60
    ph = np.cumsum(2 * np.pi * f / SR)
    return np.sin(ph) * np.linspace(0, 1, len(t)) ** 1.5 * 0.25 + bp(noise(d), 300, 3000) * np.linspace(0, 1, len(t)) * 0.2


def s_shepard(d, up=True):
    t = tt(d)
    out = np.zeros(len(t))
    for k in range(6):
        base = 55 * 2 ** k
        oct_pos = (k + (t / d) * 1.5 * (1 if up else -1)) % 6
        f = 55 * 2 ** oct_pos
        amp = np.exp(-((oct_pos - 3) ** 2) / 2.0)
        ph = np.cumsum(2 * np.pi * f / SR)
        out += np.sin(ph) * amp
    out *= np.minimum(1, t / 0.2) * np.minimum(1, (d - t) / 0.1)
    return out * 0.25


def s_thunk(short=0):
    d = 0.22 if short else 0.45
    t = tt(d)
    f = 82.4 * (1 + 0.6 * np.exp(-t * 40))
    ph = np.cumsum(2 * np.pi * f / SR)
    body = np.sin(ph) * env_ad(len(t), 0.002, d * 0.6, 5)
    knock = lp(noise(d), 900) * env_ad(len(t), 0.001, 0.03, 8) * 0.7
    return body + knock + np.sin(2 * ph) * env_ad(len(t), 0.002, 0.08, 5) * 0.3


def s_glitch():
    d = 0.24
    n = int(d * SR)
    x = noise(d) * 0.5
    x = np.round(x * 6) / 6
    step = 12
    x = np.repeat(x[::step], step)[:n]
    t = tt(d)
    chirp = np.sin(2 * np.pi * (2000 + 6000 * ((t * 23) % 1)) * t) * 0.25
    gate = ((t * 40) % 1 < 0.6).astype(float)
    return lp((bp(x, 300, 7000) + chirp * 0.6) * gate * np.linspace(1, 0.3, n), 6500)


def s_board_flip():
    out = np.zeros(int(0.8 * SR))
    for k in range(16):
        c = s_click(1800 + (k % 4) * 300, 0.025, 8) * (0.8 - k * 0.03)
        i = int((k * 0.04 + RNG.uniform(0, 0.01)) * SR)
        out[i : i + len(c)] += c
    return out


def s_chime(notes, d=1.6, decay=1.0, bell=True):
    t = tt(d)
    out = np.zeros(len(t))
    for k, n in enumerate(notes):
        f = hz(n)
        i = int(k * 0.12 * SR)
        e = env_ad(len(t) - i, 0.003, decay, 4)
        tone = np.sin(2 * np.pi * f * t[: len(t) - i]) + (0.4 * np.sin(2 * np.pi * f * 2.76 * t[: len(t) - i]) * np.exp(-t[: len(t) - i] * 6) if bell else 0)
        out[i:] += tone * e * 0.35
    return out


def s_zip_jam():
    out = np.zeros(int(0.9 * SR))
    for k in range(14):
        c = bp(noise(0.012), 2500 + k * 120, 7000) * env_ad(int(0.012 * SR), 0.0005, 0.005, 6) * 0.6
        i = int((k * 0.018) * SR)
        out[i : i + len(c)] += c
    for k in range(3):
        c = bp(noise(0.05), 700, 2500) * env_ad(int(0.05 * SR), 0.001, 0.02, 5) * 0.9
        i = int((0.35 + k * 0.13) * SR)
        out[i : i + len(c)] += c
    return out


def s_taxi(d):
    t = tt(d)
    f = 42 + 6 * np.sin(2 * np.pi * 0.3 * t) + 10 * np.minimum(1, t / 1.0)
    ph = np.cumsum(2 * np.pi * f / SR)
    eng = signal.sawtooth(ph) * 0.4 + np.sin(2 * ph) * 0.3
    eng = lp(eng, 400) * 0.7
    ind = np.zeros(len(t))
    for k in range(int(d * 1.6)):
        c = s_click(2200 if k % 2 else 1700, 0.03, 10) * 0.25
        i = int(k / 1.6 * SR)
        ind[i : i + len(c)] += c[: len(ind) - i]
    horn = np.zeros(len(t))
    hs = int((d - 0.6) * SR)
    if hs > 0:
        ht = tt(0.22)
        hn = (signal.square(2 * np.pi * 392 * ht) + signal.square(2 * np.pi * 494 * ht)) * 0.15
        hn = lp(hn, 2500) * env_ad(len(ht), 0.01, 0.2, 2)
        horn[hs : hs + len(hn)] += hn[: len(horn) - hs]
    e = np.minimum(1, t / 0.2) * np.minimum(1, (d - t) / 0.3)
    return eng * e + ind + horn


def s_breath(d=0.7, inhale=True):
    x = bp(noise(d), 300, 3000) * 0.4 + bp(noise(d), 3000, 8000) * 0.15
    t = np.linspace(0, 1, len(x))
    e = np.sin(np.pi * t) ** (1.2 if inhale else 0.8)
    if not inhale:
        e = e * np.linspace(1.2, 0.6, len(x))
    return x * e


def s_footstep(surface='stairs'):
    d = 0.25
    body = lp(noise(d), 300 if surface == 'stairs' else 1500) * env_ad(int(d * SR), 0.002, 0.06, 6) * 1.4
    tap = bp(noise(d), 800, 4000) * env_ad(int(d * SR), 0.001, 0.02, 8) * 0.4
    if surface == 'stairs':
        body += reson(body, 180, 6, 0.3)
    return body + tap


def s_creak(d=1.0):
    t = tt(d)
    f = 180 + 120 * np.sin(2 * np.pi * 1.3 * t) + 60 * t
    ph = np.cumsum(2 * np.pi * f / SR)
    x = signal.sawtooth(ph) * (0.5 + 0.5 * np.sin(2 * np.pi * 23 * t))
    x = bp(x, 300, 2500) * np.sin(np.pi * t / d) * 0.3
    return x


def s_scrape(d=0.7, f1=500, f2=3000):
    x = bp(noise(d), f1, f2) * 0.35
    t = np.linspace(0, 1, len(x))
    return x * np.sin(np.pi * t) * (0.7 + 0.3 * np.sin(2 * np.pi * 9 * t * d))


def s_clink(f=2600):
    x = noise(0.6) * env_ad(int(0.6 * SR), 0.0003, 0.004, 8)
    return reson(x, f, 80, 1.0) + reson(x, f * 2.3, 90, 0.6) + reson(x, f * 3.9, 100, 0.3)


def s_knock_glass(soft=0):
    x = noise(0.5) * env_ad(int(0.5 * SR), 0.0003, 0.003, 8)
    y = reson(x, 2480, 70, 1.0) + reson(x, 5200, 80, 0.5) + reson(x, 1100, 25, 0.5)
    y += lp(noise(0.5), 1200) * env_ad(int(0.5 * SR), 0.0005, 0.01, 8) * 0.4
    return y * (0.5 if soft else 1.0)


def s_hum(d, f=70, airy=0.2):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t) * 0.5 + np.sin(2 * np.pi * f * 2 * t + 0.3) * 0.25 + np.sin(2 * np.pi * f * 3.01 * t) * 0.1
    x *= 0.8 + 0.2 * np.sin(2 * np.pi * 0.37 * t)
    x += bp(noise(d), 2000, 8000) * airy * 0.1
    e = np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.4)
    return x * e


def s_beeps(n=2, f=2400):
    out = np.zeros(int(0.5 * SR))
    for k in range(n):
        b = np.sin(2 * np.pi * f * tt(0.07)) * env_ad(int(0.07 * SR), 0.002, 0.05, 2) * 0.4
        i = int(k * 0.14 * SR)
        out[i : i + len(b)] += b
    return out


def s_squeak():
    t = tt(0.25)
    f = 900 + 500 * np.sin(2 * np.pi * 7 * t) + 400 * t
    ph = np.cumsum(2 * np.pi * f / SR)
    return np.sin(ph + 2 * np.sin(ph * 1.5)) * np.sin(np.pi * t / 0.25) * 0.25


def s_flutter(d):
    out = np.zeros(int(d * SR))
    k = 0
    tpos = 0.0
    while tpos < d - 0.05:
        c = bp(noise(0.04), 1500, 7000) * env_ad(int(0.04 * SR), 0.002, 0.015, 6) * (0.3 + 0.2 * np.sin(k))
        i = int(tpos * SR)
        out[i : i + len(c)] += c[: len(out) - i]
        tpos += 0.03 + 0.04 * abs(np.sin(k * 1.7))
        k += 1
    return out


def s_stamp():
    return s_hit(0)[: int(0.5 * SR)] * 0.6 + bp(noise(0.5), 600, 4000) * env_ad(int(0.5 * SR), 0.0005, 0.03, 8) * 0.8


def s_tape_stop(d=0.8, f0=110):
    t = tt(d)
    f = f0 * (1 - t / d) ** 1.5 + 5
    ph = np.cumsum(2 * np.pi * f / SR)
    x = signal.sawtooth(ph) * 0.3 + np.sin(ph) * 0.4
    return lp(x, 900) * (1 - t / d) ** 0.5


def s_chalk(d):
    out = np.zeros(int(d * SR))
    for k in range(int(d * 4)):
        sd = 0.18
        c = bp(noise(sd), 1500, 7000) * np.sin(np.pi * np.linspace(0, 1, int(sd * SR))) * 0.18
        c *= 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 60 * tt(sd)))
        i = int(k * 0.25 * SR)
        out[i : i + len(c)] += c[: len(out) - i]
    return out


def s_projector(d):
    t = tt(d)
    clicks = ((t * 24) % 1 < 0.08).astype(float)
    x = bp(noise(d), 1000, 6000) * clicks * 0.2 + np.sin(2 * np.pi * 100 * t) * 0.05
    return x * np.minimum(1, t / 0.2) * np.minimum(1, (d - t) / 0.2)


def s_heartbeat():
    out = np.zeros(int(0.6 * SR))
    for k, (off, g) in enumerate([(0, 1.0), (0.18, 0.6)]):
        t = tt(0.3)
        f = 48 * np.exp(-t * 8) + 32
        ph = np.cumsum(2 * np.pi * f / SR)
        b = np.sin(ph) * env_ad(len(t), 0.004, 0.12, 5) * g
        i = int(off * SR)
        out[i : i + len(b)] += b
    return out


def s_footprint_tap(k=0):
    t = tt(0.6)
    f = hz('A4') * 2 ** (([0, 3, 7, 10, 12, 15, 19][k % 7]) / 12)
    tone = np.sin(2 * np.pi * f * t) * env_ad(len(t), 0.002, 0.35, 4) * 0.25
    tap = lp(noise(0.6), 400) * env_ad(len(t), 0.001, 0.03, 8) * 0.6
    return tone + tap


def s_music_box_note(f, d=1.8, bright=1.0):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2) + 0.35 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t * 6) * bright + 0.15 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 11) * bright
    x[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return x * 0.3


def s_piano(f, d=3.0, vel=0.8):
    t = tt(d)
    x = np.zeros(len(t))
    for h, (g, dec) in enumerate([(1.0, 1.2), (0.5, 1.8), (0.28, 2.6), (0.16, 3.4), (0.08, 4.5), (0.04, 6)], start=1):
        inh = 1 + 0.0004 * h * h
        x += g * np.sin(2 * np.pi * f * h * inh * t) * np.exp(-t * dec * (0.6 + 0.4 * vel))
    ham = lp(noise(d), 2500) * env_ad(len(t), 0.0005, 0.008, 8) * 0.08
    x = x * env_ad(len(t), 0.004, d, 0.9) + ham
    return x * 0.22 * vel


def s_pad(freqs, d, bright=800, detune=0.004, vol=0.2):
    t = tt(d)
    x = np.zeros(len(t))
    for f in freqs:
        for dt in (-detune, 0, detune):
            x += signal.sawtooth(2 * np.pi * f * (1 + dt) * t + RNG.uniform(0, 6.28)) * 0.3
    x = lp(x, bright, 2)
    x *= np.minimum(1, t / 1.2) * np.minimum(1, (d - t) / 1.2)
    return x * vol / max(1, len(freqs))


def s_pizz(f, d=0.9):
    t = tt(d)
    x = (np.sin(2 * np.pi * f * t) * 0.7 + signal.sawtooth(2 * np.pi * f * t) * 0.15) * np.exp(-t * 7)
    x[: int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    return lp(x, 1200) * 0.5


def s_arp_note(f, d=0.22):
    t = tt(d)
    x = (signal.sawtooth(2 * np.pi * f * 2 * t, 0.5) * 0.6 + signal.sawtooth(2 * np.pi * f * 2 * t) * 0.2) * np.exp(-t * 14)
    return np.tanh(lp(x, 4000) * 1.5) * 0.18


# ---------------- cue dispatch ----------------
def place(bus, sig, t, g=0.0, pan=0.0, wet=0.0, decay=1.2, width=0.0):
    st = sig if sig.ndim == 2 else stereo(sig, pan, width)
    if wet > 0:
        st = reverb(st, decay, wet)
    bus.add(st, t, g)


def cue_sfx(c):
    k = c['kind']
    t = c['t']
    if k == 'breath_in':
        place(voice_fx, s_breath(0.75, True), t, -20)
    elif k == 'brass_click':
        place(voice_fx, s_brass_click(), t, -20, 0.1, 0.12)
    elif k == 'crown_turn':
        place(voice_fx, s_crown_turn(), t, -22, 0.15, 0.1)
    elif k == 'phone_buzz':
        place(voice_fx, s_buzz(c['dur'], c.get('dist', 0)), t, -24, c.get('pan', 0), 0.1 + c.get('dist', 0) * 0.25, 1.0)
    elif k == 'phone_flip':
        place(voice_fx, s_clink(1700) * 0.5 + np.pad(lp(noise(0.3), 500) * env_ad(int(0.3 * SR), 0.001, 0.05, 6), (0, int(0.3 * SR))), t, -22, 0.2, 0.2)
    elif k == 'light_off':
        place(voice_fx, s_click(1500, 0.04, 6), t, -24, 0, 0.3)
        place(sub, s_sub_drop() * 0.4, t + 0.05, -14)
    elif k == 'ping_1k':
        x = np.sin(2 * np.pi * 1000 * tt(1.6)) * env_ad(int(1.6 * SR), 0.004, 1.2, 4) * 0.3
        place(voice_fx, x, t, -27, 0, 0.35, 1.8)
    elif k == 'glitch':
        place(voice_fx, s_glitch(), t, -25, 0, 0.2, 0.8, 0.6)
    elif k == 'machine_charge':
        d = max(0.5, c['dur'])
        tt_ = tt(d)
        f = 70 + 520 * (tt_ / d) ** 1.6
        ph = np.cumsum(2 * np.pi * f / SR)
        x = (signal.sawtooth(ph) * 0.2 + np.sin(ph * 2) * 0.15) * (tt_ / d) ** 0.7
        crack = bp(noise(d), 2000, 9000) * (RNG.random(int(d * SR)) > 0.995) * 3
        place(voice_fx, lp(x, 3000) + lp(crack, 6000) * 0.2, t, -26, 0.25, 0.3, 1.4, 0.4)
        place(sub, np.sin(np.cumsum(2 * np.pi * (40 + 30 * tt_ / d) / SR)) * (tt_ / d), t, -16)
    elif k == 'power_cut':
        place(voice_fx, s_tape_stop(0.5, 260), t, -18, 0.2, 0.2)
        place(voice_fx, lp(s_click(3500, 0.05, 4), 6000) * 0.7, t, -25, 0, 0.3)
    elif k == 'hit_low':
        big = c.get('big', 0)
        place(sub, s_hit(big), t, -11 if big else -14, 0, 0.3 if big else 0.25, 2.4)
    elif k == 'reverse_swell':
        place(music, s_reverse_swell(1.0), t - 1.0 + 0.02, -18, 0, 0.3, 2.0, 0.5)
    elif k == 'sub_drop':
        place(sub, s_sub_drop(), t, -14)
        place(music, s_reverse_swell(0.8), t - 0.8, -25, 0, 0.35, 2.0, 0.5)
    elif k == 'board_flip':
        place(voice_fx, lp(s_board_flip(), 6000), t, -23, 0.1, 0.4, 1.6)
    elif k == 'train_chime':
        place(voice_fx, s_chime(['E5', 'C5'], 1.6, 0.9, False), t, -26, -0.3, 0.55, 2.2, 0.4)
    elif k == 'thunk':
        place(voice_fx, s_thunk(c.get('short', 0)), t, -17 if not c.get('short') else -21, 0, 0.2)
    elif k == 'coral_click':
        place(voice_fx, s_click(3200, 0.02, 25), t, -24, 0.45)
    elif k == 'zip_jam':
        place(voice_fx, s_zip_jam(), t, -16, 0, 0.05)
    elif k == 'taxi':
        place(voice_fx, s_taxi(c['dur']), t, -18, 0, 0.12, 1.0, 0.4)
    elif k == 'phone_ring_short':
        place(voice_fx, s_ring(0.9), t, -26, -0.3, 0.3, 0.8)
    elif k == 'hangup_click':
        place(voice_fx, s_click(1400, 0.05, 5) + np.pad(s_click(2600, 0.03, 8), (int(0.06 * SR), 0))[: int(0.05 * SR) + int(0.06 * SR)][: int(0.05 * SR)], t, -16, c.get('pan', 0.4), 0.05)
        place(voice_fx, s_beeps(3, 480) * 0.6, t + 0.15, -28, 0.4)
    elif k == 'shepard':
        place(music, s_shepard(c['dur'] + 0.3), t, -16, 0, 0.25, 1.6, 0.6)
    elif k == 'chalk':
        place(voice_fx, s_chalk(c['dur']), t, -24, -0.2, 0.2)
    elif k == 'projector':
        place(voice_fx, s_projector(c['dur']), t, -26, 0.2, 0.15)
    elif k == 'scissor_snip':
        place(voice_fx, s_clink(3400) * 0.5, t, -20, 0.3)
        place(voice_fx, s_clink(2100), t + 0.33, -16, 0.1, 0.25)
    elif k == 'billiard_knock':
        place(voice_fx, s_knock_glass(c.get('soft', 0)), t, -19, 0.05, 0.4, 1.4)
    elif k == 'billiard_roll':
        x = lp(noise(c['dur']), 260) * np.sin(np.pi * np.linspace(0, 1, int(c['dur'] * SR))) * 0.8
        place(voice_fx, x, t, -20, -0.2)
    elif k == 'tunnel_hum':
        place(beds, s_hum(c['dur'], 66, 0.6), t, -22, 0, 0.3, 2.0, 0.6)
    elif k == 'footprint_tap':
        place(voice_fx, s_footprint_tap(c.get('k', 0)), t, -22, 0, 0.35, 1.8)
    elif k == 'record_scratch':
        place(music, s_pizz(hz('E3')) + s_pizz(hz('A2')) * 0.6, t + 0.35, -20, 0, 0.3)
    elif k == 'sat_beep':
        place(voice_fx, s_beeps(2, 2400), t, -26, 0.4, 0.4, 1.8)
    elif k == 'iss_hum':
        place(beds, s_hum(c['dur'], 120, 1.0) * 0.5, t, -28, 0, 0.4, 2.5, 0.6)
    elif k == 'number_slam':
        place(voice_fx, lp(s_click(2600, 0.04, 6), 6000), t, -23, 0, 0.25)
        place(sub, s_hit(0), t, -19)
    elif k == 'whoosh_up':
        place(voice_fx, s_whoosh(0.7, 300, 4500), t, -28, 0, 0.35, 1.2, 0.5)
    elif k == 'stamp':
        place(voice_fx, lp(s_stamp(), 6000), t, -18, 0, 0.25)
    elif k == 'balloon_squeak':
        place(voice_fx, s_squeak(), t, -26, -0.4, 0.4, 1.8)
        place(voice_fx, s_squeak(), t + 0.7, -28, 0.4, 0.4, 1.8)
    elif k == 'paper_flutter':
        place(voice_fx, s_flutter(c['dur']), t, -20, 0, 0.3, 1.4, 0.6)
    elif k == 'branch_split':
        tt_ = tt(1.5)
        up = np.sin(np.cumsum(2 * np.pi * (440 + 300 * tt_) / SR))
        dn = np.sin(np.cumsum(2 * np.pi * (440 - 160 * tt_) / SR))
        e = env_ad(len(tt_), 0.05, 1.2, 3)
        place(music, np.vstack([up * e * 0.25, dn * e * 0.25]), t, -16, 0, 0.45, 2.4)
    elif k == 'tape_stop':
        place(music, s_tape_stop(0.9, 110), t, -18, 0, 0.3)
    elif k == 'crown_press':
        place(voice_fx, s_brass_click(), t, -14, 0, 0.1)
        place(sub, s_sub_drop() * 0.6, t + 0.05, -14)
    elif k == 'riser':
        d = c['dur']
        place(music, s_whoosh(d + 0.2, 200, 5000) * 1.0 + s_shepard(d + 0.2) * 0.6, t, -21, 0, 0.35, 1.6)
    elif k == 'footsteps':
        for i in range(c.get('n', 4)):
            place(voice_fx, s_footstep(c.get('surface', 'stairs')), t + i * c.get('rate', 0.42), -18, -0.1 + 0.2 * (i % 2), 0.15)
    elif k == 'door_knob':
        place(voice_fx, s_click(1900, 0.06, 6) * 0.7, t, -18, 0.25, 0.1)
        place(voice_fx, s_click(1200, 0.08, 4), t + 0.25, -16, 0.25, 0.1)
    elif k == 'door_open':
        place(voice_fx, s_creak(1.1), t, -20, 0.2, 0.3, 1.2)
        place(voice_fx, s_whoosh(1.2, 200, 1500, False) * 0.6, t + 0.2, -24, 0, 0.4, 1.6, 0.5)
    elif k == 'kettle_click':
        place(voice_fx, s_click(2200, 0.04, 8) * 0.8, t, -24, -0.5, 0.3)
    elif k == 'phone_ring_far':
        d = c['dur']
        # her ringback in the kitchen (left), your younger phone buzzing across town (right)
        place(voice_fx, s_ringback(d), t, -30, -0.7, 0.2)
        place(voice_fx, s_buzz(d, 0.0), t + 0.15, -22, 0.8, 0.0)
    elif k == 'cup_slide':
        place(voice_fx, s_scrape(0.9, 400, 2600), t, -20, 0.1, 0.15)
        place(voice_fx, s_clink(2900) * 0.5, t + 0.9, -22, 0.1, 0.2)
    elif k == 'chair':
        place(voice_fx, s_creak(0.6) * 0.7 + np.pad(s_scrape(0.4, 200, 1200), (0, int(0.2 * SR))), t, -22, 0, 0.15)
    elif k == 'window_creak':
        place(voice_fx, s_creak(0.8) * 0.5, t, -28, -0.3, 0.3)
    elif k == 'cup_saucer':
        place(voice_fx, s_clink(2500), t, -18, 0.1, 0.25)
    elif k == 'loop_closed':
        place(music, s_chime(['A4', 'C#5', 'E5', 'A5'], 3.0, 1.8), t, -14, 0, 0.5, 3.0, 0.6)
    elif k == 'shimmer':
        tt_ = tt(2.0)
        x = sum(np.sin(2 * np.pi * hz(n) * tt_) for n in ['A5', 'C#6', 'E6']) * env_ad(len(tt_), 0.4, 1.6, 3) * 0.12
        place(music, x, t, -18, 0, 0.6, 3.0, 0.6)
    elif k == 'phone_ring':
        place(voice_fx, s_ring(c['dur'] + 0.2), t, -20, -0.1, 0.3, 0.8)
    elif k == 'pickup_click':
        place(voice_fx, lp(s_click(1400, 0.05, 6), 4000), t, -24, -0.1, 0.2)
    elif k == 'endcard_ding':
        place(music, s_chime(['A4', 'E5', 'A5'], 2.4, 1.8), t, -18, 0, 0.55, 2.8)
    elif k == 'screen_dive':
        place(voice_fx, s_whoosh(0.6, 300, 5000), t - 0.3, -25, 0, 0.3, 1.2, 0.6)
        place(voice_fx, s_tape_suck(0.35), t - 0.35, -25, 0, 0.2)
    elif k == 'layer_split':
        for i in range(3):
            place(voice_fx, s_whoosh(0.3, 600, 4000), t - 0.25 + i * 0.07, -31, -0.4 + i * 0.4, 0.3)
    elif k == 'flatten':
        place(voice_fx, lp(s_click(2500, 0.03, 4) + bp(noise(0.03), 2000, 6000) * 0.4, 6000), t, -22, 0, 0.25)
        place(voice_fx, s_reverse_swell(0.25) * 0.5, t - 0.25, -24)
    elif k == 'loop_wipe':
        place(music, s_shepard(0.7), t - 0.4, -23, 0, 0.35, 1.6, 0.5)
        place(voice_fx, s_whoosh(0.7, 200, 2500), t - 0.35, -27, 0, 0.4, 1.6, 0.6)
    elif k == 'eye_match':
        place(voice_fx, lp(s_breath(0.5, True), 1500), t - 0.25, -18)
    elif k == 'shoulder_detach':
        place(voice_fx, s_breath(0.6, False), t - 0.1, -20)
        place(voice_fx, s_whoosh(0.9, 150, 2000, False) * 0.7, t, -29, 0, 0.5, 1.8, 0.6)
    elif k == 'flash_cut':
        place(music, s_chime(['A5', 'E6'], 1.8, 1.2), t, -19, 0, 0.5, 2.4)
        place(sub, s_hit(0), t, -16, 0, 0.3, 2.0)
    elif k == 'rect_cut':
        place(voice_fx, s_whoosh(0.3, 500, 3500), t - 0.15, -30, 0, 0.25)
    elif k == 'impact':
        place(sub, s_hit(0), t, -14, 0, 0.25, 2.0)
        place(voice_fx, lp(s_click(3000, 0.05, 3), 6000), t, -23, 0, 0.2)
    elif k == 'loop_ping':
        place(voice_fx, s_whoosh(0.5, 300, 2000) * 0.8, t - 0.3, -28, 0, 0.4)


# ---------------- build ----------------
def build():
    narr, sr = sf.read(os.path.join(HERE, 'voice', 'narration_48k.wav'))
    assert sr == SR
    if narr.ndim > 1:
        narr = narr.mean(1)
    vb = np.zeros(N)
    vb[: len(narr)] = narr[:N]
    # voice: tiny room so it sits in the world (about 7 percent wet, 0.3 s)
    bq, aq = signal.iirpeak(3000 / (SR / 2), 2.0)
    vb = vb - signal.lfilter(bq, aq, vb) * 0.2  # about -2 dB around 3 kHz
    voice = reverb(np.vstack([vb, vb]), 0.35, 0.1, 6000, seed=3)

    for c in TL['sfx']:
        if c['kind'] not in ('loop_note', 'dip', 'silence'):
            cue_sfx(c)

    # loop note echoes: the last word returns, band limited and reverbed, one Loop Motif beat later
    for c in TL['sfx']:
        if c['kind'] != 'loop_note':
            continue
        we = c['word_end']
        a = int((we - 0.42) * SR)
        b = int((we + 0.05) * SR)
        w = vb[a:b].copy()
        w *= np.hanning(len(w)) ** 0.3
        w = bp(w, 300, 3000)
        if c.get('resolve'):
            tt_ = tt(3.2)
            chord = sum(np.sin(2 * np.pi * hz(n) * tt_) for n in ['A3', 'C#4', 'E4', 'A4']) * env_ad(len(tt_), 0.6, 2.4, 2.5) * 0.08
            place(music, chord, we + BEAT * 0.5, -10, 0, 0.5, 3.0, 0.6)
        else:
            place(voice_fx, w, we - 0.42 + BEAT, -13, 0.0, 0.65, 2.2, 0.7)

    # ---- ticks ----
    for a, b, kind in TL['ticks']:
        tpos = np.ceil(a)
        k = 0
        while tpos < b:
            jit = 0.0
            pitch = 1.0
            g = -26
            if kind == 'glitchy':
                jit = RNG.uniform(-0.12, 0.12)
                pitch = 1 + RNG.uniform(-0.15, 0.1)
                g = -27
            elif kind == 'slow':
                g = -24
            place(voice_fx, s_tick(pitch), tpos + jit, g, 0.15, 0.1)
            tpos += 1.0 if kind != 'slow' else 1.25
            k += 1

    # ---- pulse (heartbeat feel, not literally a heart) ----
    pk = TL['pulse']
    tpos = 0.3
    while tpos < DUR - 2:
        bpm = 0
        for tt0, v in pk:
            if tpos >= tt0:
                bpm = v
        if bpm <= 0:
            tpos += 0.25
            continue
        place(sub, s_heartbeat(), tpos, -17)
        tpos += 60.0 / bpm

    # ---- beds ----
    for bd in TL['beds']:
        a, b = bd['start'], bd['end'] + 0.3
        d = b - a
        if d <= 0.05:
            continue
        kind = bd['kind']
        t = tt(d)
        fade = np.minimum(1, t / 0.25) * np.minimum(1, (d - t) / 0.3)
        g = -38
        if kind == 'workshop':
            x = lp(pink(d), 700) * 0.4 + s_hum(d, 60, 0.1) * 0.25
            g = -34
        elif kind == 'memory':
            x = hp(pink(d), 3000) * 0.08 + lp(pink(d), 400) * 0.5
            g = -36
        elif kind == 'rain':
            x = bp(pink(d), 500, 5000) * 0.6 + (RNG.random(len(t)) > 0.9985) * bp(noise(d), 1200, 4500) * 1.5
            g = -30
        elif kind == 'void':
            x = lp(pink(d), 300) * 0.6 + np.sin(2 * np.pi * 110 * t) * 0.03
            g = -38
        elif kind == 'station':
            mur = bp(pink(d), 250, 2500) * (0.6 + 0.4 * lp(np.abs(noise(d)), 3))
            pa = np.sin(2 * np.pi * 523 * t) * ((t % 7) < 0.25) * 0.05
            x = mur + pa
            g = -32
        elif kind == 'city':
            x = lp(pink(d), 400) * 0.8 + bp(pink(d), 1000, 4000) * 0.1
            g = -32
        elif kind == 'room':
            x = lp(pink(d), 900) * 0.5
            g = -38
        elif kind == 'hall':
            x = lp(pink(d), 600) * 0.5 + s_hum(d, 100, 0.05) * 0.15
            g = -36
        elif kind == 'space':
            x = bp(pink(d), 3000, 12000) * 0.15 + lp(pink(d), 120) * 0.6
            g = -34
        elif kind == 'party':
            laugh = bp(pink(d), 300, 2000) * (lp((RNG.random(len(t)) > 0.9997).astype(float) * 80, 6) > 0.02) * 0.4
            x = lp(pink(d), 800) * 0.4 + lp(laugh, 900)
            g = -34
        elif kind == 'stairs':
            x = lp(pink(d), 500) * 0.5
            g = -38
        elif kind == 'kitchen':
            simmer = bp(pink(d), 1500, 6000) * 0.08
            rainw = bp(pink(d), 1000, 7000) * 0.12
            wc = np.zeros(len(t))
            for k in range(int(d / 1.2)):
                c = s_tick(0.55) * 0.5
                i = int(k * 1.2 * SR)
                wc[i : i + len(c)] += c[: len(wc) - i]
            x = lp(pink(d), 600) * 0.4 + simmer + rainw + wc * 0.6
            g = -32
        elif kind == 'street':
            x = bp(pink(d), 500, 5500) * 0.8 + lp(pink(d), 200) * 0.5
            g = -28
        else:
            continue
        pan = 0.0
        st = stereo(x * fade, pan, 0.8)
        beds.add(st, a, g + 14)

    # ---- music ----
    motif = ['A4', 'C5', 'E5', 'G5']
    major = ['A4', 'C#5', 'E5', 'F#5']
    for mu in TL['music']:
        a, b, kind = mu['start'], mu['end'], mu['kind']
        d = b - a
        if kind in ('motif_cold', 'motif_drive', 'motif_shimmer'):
            step = BEAT if kind != 'motif_drive' else BEAT / 2
            tpos = a
            k = 0
            while tpos < b:
                f = hz(motif[k % 4]) * (2 if kind == 'motif_shimmer' and k % 8 >= 4 else 1)
                wob = 1 + 0.004 * np.sin(2 * np.pi * 0.4 * tpos) if kind == 'motif_cold' else 1
                n = s_music_box_note(f * wob, 1.8 if kind != 'motif_drive' else 0.8, 0.6 if kind == 'motif_cold' else 1.0)
                g = -22 if kind == 'motif_cold' else (-24 if kind == 'motif_drive' else -26)
                place(music, n, tpos, g, 0.25 * np.sin(k), 0.45 if kind != 'motif_drive' else 0.25, 2.6)
                if kind == 'motif_drive' and k % 2 == 0:
                    place(music, s_pizz(hz(['A2', 'E2', 'C3', 'B2'][(k // 2) % 4])), tpos, -18, 0, 0.15)
                tpos += step
                k += 1
            if kind == 'motif_shimmer':
                place(music, s_pad([hz('A3'), hz('C4'), hz('E4'), hz('B4')], d, 1400, 0.005, 0.5), a, -24, 0, 0.5, 3.0, 0.8)
                # bass pizz every two beats, walking A E C B
                tpos = a
                k = 0
                while tpos < b:
                    place(music, s_pizz(hz(['A2', 'E2', 'C3', 'B2'][k % 4])), tpos, -20, 0, 0.2)
                    tpos += BEAT * 3
                    k += 1
            if kind == 'motif_cold':
                place(music, s_pad([hz('A2'), hz('E3')], d, 500, 0.006, 0.6), a, -26, 0, 0.4, 3.0, 0.8)
        elif kind == 'arp':
            step = BEAT / 4
            seq = ['A4', 'C5', 'E5', 'A5', 'G5', 'E5', 'C5', 'E5']
            tpos = a
            k = 0
            while tpos < b:
                accel = 1 + 0.6 * ((tpos - a) / d)
                place(music, s_arp_note(hz(seq[k % 8]) / 2), tpos, -24, 0.5 * np.sin(k * 0.7), 0.2)
                tpos += step / accel
                k += 1
        elif kind == 'heavy':
            place(music, s_pad([hz('A1'), hz('E2'), hz('A2')], d, 300, 0.003, 0.9), a, -20, 0, 0.4, 3.0, 0.7)
            tpos = a + 0.4
            k = 0
            while tpos < b - 0.5:
                place(music, s_piano(hz(['A3', 'C4', 'E4', 'G4'][k % 4]) / 2, 2.5, 0.5), tpos, -22, 0, 0.5, 2.6)
                tpos += BEAT * 2
                k += 1
        elif kind == 'kitchen_piano':
            tpos = a + 0.3
            k = 0
            while tpos < b - 0.2:
                late = RNG.uniform(0.0, 0.06)
                place(music, s_piano(hz(motif[k % 4]), 3.0, 0.55 + 0.1 * RNG.random()), tpos + late, -20, -0.1, 0.45, 2.2)
                if k % 4 == 0:
                    place(music, s_piano(hz('A2'), 3.5, 0.5), tpos + late, -22, 0, 0.45, 2.2)
                tpos += BEAT * 1.25
                k += 1
        elif kind == 'kitchen_resolve':
            tpos = a + 0.05
            k = 0
            while tpos < b - 0.2:
                late = RNG.uniform(0.0, 0.05)
                place(music, s_piano(hz(major[k % 4]), 3.0, 0.6), tpos + late, -19, -0.1, 0.45, 2.2)
                if k % 4 == 0:
                    place(music, s_piano(hz('A2'), 3.5, 0.55) + s_piano(hz('E3'), 3.5, 0.4), tpos + late, -21, 0, 0.45, 2.2)
                tpos += BEAT * 1.25
                k += 1
        elif kind == 'strings':
            place(music, s_pad([hz('A3'), hz('C#4'), hz('E4')], d, 1800, 0.006, 0.6), a, -26, 0, 0.5, 3.0, 0.8)
        elif kind == 'turn':
            place(music, s_pad([hz('A2'), hz('E3'), hz('C#4'), hz('F#4')], d, 1600, 0.006, 0.7), a, -22, 0, 0.5, 3.0, 0.8)
            tpos = a + 0.2
            k = 0
            while tpos < b - 0.3:
                place(music, s_piano(hz(major[k % 4]) * (2 if k >= 4 else 1), 3.0, 0.5), tpos, -21, 0, 0.5, 2.6)
                tpos += BEAT
                k += 1

    # ---- sub pad: warm 55 Hz with a detuned partner, saturation for phones ----
    t = np.arange(N) / SR
    inten = np.interp(t, [0, TL['shots'][6]['start'], TL['shots'][11]['start'], TL['shots'][12]['start'], TL['shots'][21]['start'], TL['shots'][25]['start'], TL['shots'][33]['start'], DUR],
                      [0.25, 0.5, 0.75, 0.6, 0.45, 0.35, 0.4, 0.2])
    pad = np.sin(2 * np.pi * 55 * t) + 0.8 * np.sin(2 * np.pi * 55.8 * t)
    pad = np.tanh(pad * 1.6) * 0.5
    sub.add(np.vstack([pad * inten, pad * inten]), 0, -27)

    # ---- mix with ducking ----
    venv = np.abs(vb)
    venv = signal.lfilter([1 - np.exp(-1 / (0.02 * SR))], [1, -np.exp(-1 / (0.02 * SR))], venv)
    venv = venv / (np.percentile(venv[venv > 1e-4], 95) + 1e-9)
    target = np.clip(venv * 1.5, 0, 1)
    # attack 80 ms, release 400 ms
    duck = np.zeros(N)
    aa = np.exp(-1 / (0.08 * SR))
    ar = np.exp(-1 / (0.4 * SR))
    g = 0.0
    tg = target
    # vectorised approximation: smooth up quickly, down slowly
    up = signal.lfilter([1 - aa], [1, -aa], tg)
    down = signal.lfilter([1 - ar], [1, -ar], tg)
    duck = np.maximum(up, down)
    duck_db = -8.5 * np.clip(duck, 0, 1)
    dg = 10 ** (duck_db / 20)
    sub_dg = 10 ** ((duck_db * 0.35) / 20)

    mix = voice + voice_fx.x * 1.0 + beds.x * dg + music.x * dg * db(2) + sub.x * sub_dg
    _m = pyln.Meter(SR)
    for nm, bx in (('voice', voice), ('fx', voice_fx.x), ('beds', beds.x * dg), ('music', music.x * dg), ('sub', sub.x * sub_dg)):
        print(nm, round(_m.integrated_loudness(bx[:, : int(DUR * SR)].T), 1), 'peak', round(20 * np.log10(np.max(np.abs(bx)) + 1e-9), 1))

    # sound dips before important lines: whole mix minus 6 dB for 0.4 s
    gain = np.ones(N)
    for c in TL['sfx']:
        if c['kind'] == 'dip':
            a = int(c['t'] * SR)
            b = int((c['t'] + 0.4) * SR)
            gain[a:b] = np.minimum(gain[a:b], db(-6))
    # designed near silences: everything drops to almost nothing (a faint room tone stays)
    for a, b in TL['silences']:
        ia = int(a * SR)
        ib = int(b * SR)
        ramp = int(0.08 * SR)
        rout = int(0.6 * SR)
        gain[ia:ib] = np.minimum(gain[ia:ib], db(-34))
        gain[max(0, ia - ramp):ia] = np.minimum(gain[max(0, ia - ramp):ia], np.linspace(1, db(-34), ia - max(0, ia - ramp)))
        m = min(rout, N - ib)
        gain[ib:ib + m] = np.minimum(gain[ib:ib + m], db(-34) + (1 - db(-34)) * np.linspace(0, 1, m) ** 2)
    gsm = signal.lfilter([1 - np.exp(-1 / (0.01 * SR))], [1, -np.exp(-1 / (0.01 * SR))], gain)
    mix = mix * gsm
    room = lp(pink(DUR + 1, seed=99), 700)[:N] * db(-56)
    mix += np.vstack([room, room])

    # ---- master: glue compression, normalise to -14 LUFS, true peak limit -1 dBTP ----
    def comp(x, thr=-18, ratio=2.0):
        e = np.max(np.abs(x), axis=0)
        e = signal.lfilter([1 - np.exp(-1 / (0.01 * SR))], [1, -np.exp(-1 / (0.01 * SR))], e)
        d_ = 20 * np.log10(e + 1e-9)
        gr = -np.maximum(0, d_ - thr) * (1 - 1 / ratio)
        gr = signal.lfilter([1 - np.exp(-1 / (0.15 * SR))], [1, -np.exp(-1 / (0.15 * SR))], gr)
        return x * 10 ** (gr / 20)

    mix = comp(mix)
    mix = mix[:, : int(DUR * SR)]
    meter = pyln.Meter(SR)
    from scipy.ndimage import minimum_filter1d, uniform_filter1d

    def limiter(x, ceil_db=-1.5):
        up = signal.resample_poly(x, 4, 1, axis=1)
        pk = np.max(np.abs(up), axis=0)
        pk = pk[: (len(pk) // 4) * 4].reshape(-1, 4).max(axis=1)
        pk = np.concatenate([pk, np.full(x.shape[1] - len(pk), pk[-1] if len(pk) else 0)])[: x.shape[1]]
        g = np.minimum(1.0, db(ceil_db) / (pk + 1e-9))
        la = int(0.004 * SR)
        g = minimum_filter1d(g, size=2 * la + 1)
        rel = np.exp(-1 / (0.06 * SR))
        gs = signal.lfilter([1 - rel], [1, -rel], g)
        g = np.minimum(g, gs)
        g = uniform_filter1d(g, size=la)
        return x * g

    for _ in range(4):
        L = meter.integrated_loudness(mix.T)
        mix *= db(-14.0 - L)
        mix = limiter(mix, -1.4)
    up4 = signal.resample_poly(mix, 4, 1, axis=1)
    tp = 20 * np.log10(np.max(np.abs(up4)) + 1e-12)
    if tp > -1.0:
        mix *= db(-1.05 - tp)
    L = meter.integrated_loudness(mix.T)
    up4 = signal.resample_poly(mix, 4, 1, axis=1)
    tp = 20 * np.log10(np.max(np.abs(up4)) + 1e-12)
    # short term loudness range
    hop = SR
    st = []
    for i in range(0, mix.shape[1] - 3 * SR, hop):
        v = meter.integrated_loudness(mix[:, i : i + 3 * SR].T)
        if np.isfinite(v) and v > -60:
            st.append(v)
    lra = float(np.percentile(st, 95) - np.percentile(st, 10))
    sf.write(os.path.join(OUT, 'audio_mix.wav'), mix.T, SR, subtype='PCM_24')
    vm = voice[:, : int(DUR * SR)]
    vm *= db(-16 - meter.integrated_loudness(vm.T))
    sf.write(os.path.join(OUT, 'voiceover_master.wav'), vm[0], SR, subtype='PCM_24')
    stats = dict(lufs=round(L, 2), true_peak=round(tp, 2), lra=round(lra, 2), duration=round(mix.shape[1] / SR, 2), loop_note_delay=round(BEAT, 4), motif_beat=round(BEAT, 4))
    json.dump(stats, open(os.path.join(OUT, 'audio_stats.json'), 'w'), indent=1)
    print(stats)


if __name__ == '__main__':
    build()
