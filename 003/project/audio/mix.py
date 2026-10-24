"""Notice 003: sound design, music, mix and master.

Reads ../src/timeline.json (voice lines, meter, silences) and events.json (shots,
glitches, flickers, flashes, exported from src/events.ts), so every cue lands on
the same anchor as the picture. Everything is procedural (synth.py).

Buses: voice, amb (room, street, rain), sub (drone), pad (tension pad, warm chord),
music (pizzicato, electric piano, piano, strings), sfx (foley and transitions),
photo (sounds inside the photograph: behind, right, warmer), post (designed sounds
inside the three near silences, never masked).

Writes out/audio_mix.wav (48 kHz, 24 bit) at -14 LUFS, true peak under -1 dBTP.
"""
import json
import os
import re
import subprocess

import numpy as np
import pyloudnorm
import soundfile as sf
from scipy import signal
from scipy.ndimage import uniform_filter1d

import synth as S
from dsp import limiter, true_peak_db
from synth import SR

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
TL = json.load(open(os.path.join(HERE, "..", "src", "timeline.json")))
EV = json.load(open(os.path.join(HERE, "events.json")))
D = TL["duration"]
N = int(np.ceil(D * SR))
LINES = {l["id"]: l for l in TL["lines"]}
SHOT = {s["id"]: s for s in EV["shots"]}
SEC = TL["sections"]
SIL = {s["name"]: (s["t0"], s["t1"]) for s in TL["silences"]}
LAUGH_T = TL["laugh_t"]


def at(a):
    """same grammar as at() in src/events.ts"""
    if isinstance(a, (int, float)):
        return float(a)
    m = re.match(r"^(L\d{3})\.(ss|se|s|e|w\d+|we\d+)([+-]\d+(?:\.\d+)?)?$", a)
    if not m:
        raise ValueError(a)
    l = LINES[m.group(1)]
    k = m.group(2)
    if k == "ss":
        t = l["sound_start"]
    elif k == "se":
        t = l["sound_end"]
    elif k == "s":
        t = l["start"]
    elif k == "e":
        t = l["end"]
    elif k.startswith("we"):
        t = l["words_abs"][int(k[2:])][2]
    else:
        t = l["words_abs"][int(k[1:])][1]
    return t + (float(m.group(3)) if m.group(3) else 0.0)


def st(i):
    return SHOT[i]["start"]


def en(i):
    return SHOT[i]["end"]


def ease_in_out(x):
    x = min(1.0, max(0.0, x))
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def inv(f, y, lo=0.0, hi=1.0):
    for _ in range(40):
        mid = (lo + hi) / 2
        if f(mid) < y:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def db(x):
    return 10 ** (x / 20)


# ---------------------------------------------------------------- buses
class Bus:
    def __init__(self, name):
        self.name = name
        self.x = np.zeros((N + SR * 6, 2), np.float32)

    def add(self, s, t, gain_db=0.0, pan=0.0, width=0.0):
        if s.ndim == 1:
            s = S.stereo(s, pan, width)
        i = int(round(t * SR))
        if i < 0:
            s = s[-i:]
            i = 0
        j = min(len(self.x), i + len(s))
        if j > i:
            self.x[i:j] += (s[: j - i] * db(gain_db)).astype(np.float32)

    def env(self, pts):
        """multiply by a gain curve given as [(t, dB), ...] (linear in dB between points)"""
        ts = np.array([p[0] for p in pts]) * SR
        ds = np.array([p[1] for p in pts])
        n = len(self.x)
        g = np.empty(n, np.float32)
        for a in range(0, n, SR * 20):
            idx = np.arange(a, min(n, a + SR * 20))
            g[idx] = db(np.interp(idx, ts, ds))
        self.x *= g[:, None]


B = {k: Bus(k) for k in ["amb", "sub", "pad", "music", "sfx", "photo", "post"]}


def fade(x, a=0.01, r=0.05):
    x = x.copy()
    na, nr = int(a * SR), int(r * SR)
    if na:
        x[:na] *= np.linspace(0, 1, na)[:, None] if x.ndim == 2 else np.linspace(0, 1, na)
    if nr:
        x[-nr:] *= np.linspace(1, 0, nr)[:, None] if x.ndim == 2 else np.linspace(1, 0, nr)
    return x


def seg_layer(gen, t0, t1, gain_db, pan=0.0, width=0.0, bus="amb", fin=0.25, fout=0.35):
    """an ambience layer for a time span, with fades"""
    if t1 <= t0:
        return
    x = gen(t1 - t0 + fout)
    x = fade(x, fin, fout)
    B[bus].add(x, t0, gain_db, pan, width)


# ---------------------------------------------------------------- the bed
def intensity(t):
    """0 to 1: 0.2 in the hook, +0.1 per Thing, ramps to 1.0 into the reveal, then no bed"""
    if t < SEC["thing1"] - 1.0:
        return 0.2
    if t < st("T2_title"):
        return 0.3
    if t < st("T3_title"):
        return 0.4
    if t < st("T4_title"):
        return 0.5
    if t < st("T4_happening"):
        return 0.6
    if t < SIL["before_reveal"][0]:
        k = (t - st("T4_happening")) / (SIL["before_reveal"][0] - st("T4_happening"))
        return 0.6 + 0.4 * k
    return 0.0


def traffic(d, seed):
    return S.hp(S.traffic(d, seed), 110, 2)


def soft_cloth(d, seed):
    return S.lp(S.cloth(d, seed), 3200, 2)


def soft(x, f=5500):
    """foley through a gentle low pass: no harsh friction on top"""
    return S.lp(x, f, 2)


def build_bed():
    n = N + SR * 2
    t = np.arange(n) / SR
    # sub drone: 38 and 40.5 Hz beating, saturated so 76 and 114 Hz read on phones
    drone = np.sin(2 * np.pi * 38 * t) + np.sin(2 * np.pi * 40.5 * t + 1.0)
    drone = np.tanh(1.8 * drone) / 1.2
    drone += 0.18 * np.sin(2 * np.pi * 114 * t)
    tk = np.arange(0, D + 2, 0.05)
    lev = np.array([intensity(x) for x in tk])
    lev_db = np.where(lev > 0, -43 + 14 * lev, -120)
    g = db(np.interp(t, tk, lev_db))
    g *= np.minimum(1, t / 2.5)  # fades up under the first line
    B["sub"].add((drone * g).astype(np.float32), 0, -6)

    # room tone: pink, low passed near 700 Hz, about -40 dB; fridge hum -46 dB
    room = S.lp(S.pink(n, 101), 1100, 2)
    room = room / np.sqrt(np.mean(room ** 2)) * db(-40)
    fr = sum(a * np.sin(2 * np.pi * f * t + p) for f, a, p in [(50, 1, 0), (100, 0.6, 1), (150, 0.35, 2), (200, 0.2, 0.3), (300, 0.08, 1.2)])
    fr *= 1 + 0.08 * np.sin(2 * np.pi * 0.13 * t)
    fr = fr / np.sqrt(np.mean(fr ** 2)) * db(-46)
    street = S.lp(S.pink(n, 103), 450, 2) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.05 * t))
    street = street / np.sqrt(np.mean(street ** 2)) * db(-54)
    # where the room changes: dead quiet phone, a flat reveal, warmer turn
    pts = [(0, -60), (2.5, 0)]
    pts += [(st("T2_phone"), 0), (st("T2_phone") + 0.2, -12), (en("T2_phone") - 0.1, -12), (en("T2_phone") + 0.2, 0)]
    pts += [(st("T2_call"), 0), (st("T2_call") + 0.2, -10), (en("T2_call") - 0.1, -10), (en("T2_call") + 0.2, 0)]
    pts += [(SEC["reveal"], -3), (SEC["escape"], -3), (SEC["escape"] + 2, 0), (D + 6, 0)]
    pts.sort()
    tt = np.array([p[0] for p in pts])
    dd = np.array([p[1] for p in pts])
    rg = db(np.interp(t, tt, dd))
    # fridge and street drop out for the reveal (only room tone, the ring of the hit, the voice)
    rv = np.interp(t, [0, SIL["before_reveal"][0], SIL["before_reveal"][0] + 0.05, SEC["escape"], SEC["escape"] + 3, D + 6], [1, 1, 0, 0, 1, 1])
    room2 = S.lp(S.pink(n, 102), 1100, 2)
    room2 = room2 / np.sqrt(np.mean(room2 ** 2)) * db(-40)
    left = room * rg + (fr + street) * rg * rv
    right = room2 * rg + (fr + np.roll(street, 480)) * rg * rv
    B["amb"].add((np.stack([left, right], 1) * 0.75).astype(np.float32), 0, 0)

    # a distant clock, one tick a second, until it stops dead at the reveal
    for k in np.arange(3.0, SIL["before_reveal"][0], 1.0):
        B["amb"].add(S.lp(S.clock_tick(int(k)), 2500), k + 0.5, -54, 0.35)

    # tension pad: B and C, detuned saws, low passed near 1.2 kHz with a slow filter move
    t0, t1 = st("T2_title"), SIL["before_reveal"][0]
    m = int((t1 - t0 + 1) * SR)
    raw = S.saw_cluster([S.note_freq("B2"), S.note_freq("C3")], m / SR, 105)
    tt = np.arange(m) / SR
    cut = 900 + 350 * np.sin(2 * np.pi * 0.035 * tt)
    pad = np.zeros(m)
    blk = 4800
    zi = None
    for i in range(0, m, blk):
        sos = signal.butter(2, cut[i], btype="lowpass", fs=SR, output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        pad[i:i + blk], zi = signal.sosfilt(sos, raw[i:i + blk], zi=zi)
    pad = pad / np.sqrt(np.mean(pad ** 2))
    lv = np.array([intensity(t0 + x) for x in tt[::480]])
    gl = db(np.interp(tt, tt[::480], -46 + 18 * lv)) * np.minimum(1, tt / 4.0)
    gl[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    B["pad"].add(S.stereo(pad * gl, 0, 1.0), t0, 0)

    # escape: the bed releases to a warm low chord
    e0, e1 = SEC["escape"], st("O1_revision") + 1.5
    ch = S.string_pad([S.note_freq("F2"), S.note_freq("C3"), S.note_freq("A3"), S.note_freq("E4")], e1 - e0, 107)
    ch = S.hp(S.lp(ch, 1100), 120)
    ch = ch / np.sqrt(np.mean(ch ** 2))
    B["pad"].add(S.stereo(fade(ch, 3.0, 2.5), 0, 0.8), e0, -36)


# ---------------------------------------------------------------- pulse, clock, brushes
def bpm_for(dist):
    k = (np.log(40) - np.log(dist)) / (np.log(40) - np.log(0.3))
    return 54 + (80 - 54) * k


def build_pulse():
    keys = [m for m in TL["meter"] if m["kind"] == "m"]
    t = keys[0]["t"]
    stop = SIL["before_reveal"][0] - 0.05
    beats = []
    while t < stop:
        d = [m["value"] for m in keys if m["t"] <= t][-1]
        beats.append(t)
        t += 60.0 / bpm_for(d)
    t = SEC["escape"] + 1.5
    while t < LAUGH_T - 0.3:
        beats.append(t)
        t += 60.0 / 50
    pb = S.pulse_beat()
    for i, b in enumerate(beats):
        lv = -33 + 7 * max(intensity(b), 0.3 if b > SEC["escape"] else 0)
        B["sub"].add(pb, b, lv)
        # brushes on the off beat, only in Things 3 and 4
        if st("T3_title") <= b < SIL["before_reveal"][0] - 1 and i + 1 < len(beats):
            mid = (b + beats[i + 1]) / 2
            B["music"].add(S.brush(200 + i), mid, -44, -0.3 if i % 2 else 0.3, 0.6)
    return beats


def build_clock():
    tick = S.clock_tick(29)
    # meter highlights: "check the corner", then each new distance
    p0 = TL["punches"][0]
    for k in range(11):
        B["sfx"].add(tick, p0 + k, -30 + (2 if k == 0 else 0), 0.15)
    for mt in [m["t"] for m in TL["meter"] if m["kind"] == "m"][1:4]:
        for k in range(3):
            B["sfx"].add(tick, mt + k, -34, 0.15)
    # Thing 4 ends: louder each second, then it stops dead
    t = st("T4_happening")
    while t < SIL["before_reveal"][0] - 0.1:
        k = (t - st("T4_happening")) / (SIL["before_reveal"][0] - st("T4_happening"))
        B["sfx"].add(tick, t, -34 + 8 * k, 0.15)
        t += 1.0
    # escape: it returns and slows with the countdown
    c0 = [m for m in TL["meter"] if m["kind"] == "count"]
    t, end = c0[0]["t"], c0[1]["until"]
    while t < end:
        k = (t - c0[0]["t"]) / (end - c0[0]["t"])
        B["sfx"].add(tick, t, -32, 0.15)
        t += 1.0 + 0.8 * k
    B["sfx"].add(tick, TL["punches"][2], -28, 0.15)


# ---------------------------------------------------------------- noir layer and music
def build_pizz():
    walk = ["A1", "E2", "C2", "B1"]
    lines = TL["lines"]
    blocked = [(st("T2_phone"), en("T2_call")), (st("T1_title"), st("T1_dive") + 0.5), (st("T2_title"), st("T2_putdown")),
               (st("T3_title"), st("T3_hand")), (st("T4_title"), st("T4_warm")), (st("T2_trailer"), en("T2_trailer"))]
    last = -10.0
    k = 0
    for a, b in zip(lines, lines[1:]):
        g0, g1 = a["sound_end"], b["sound_start"]
        if g0 < 30 or g0 > SIL["before_reveal"][0] - 2:
            continue
        if any(x0 - 0.2 < g0 < x1 for x0, x1 in blocked):
            continue
        t = g0 + 0.06
        while t < g1 - 0.15:
            if t - last >= 2.0:
                f = S.note_freq(walk[k % 4])
                B["music"].add(S.ks_bass(f, 1.7, 300 + k), t, -23, -0.12, 0.4)
                last = t
                k += 1
                t += 2.6
            else:
                t = last + 2.0


def motif(t, major=False, gain=-28):
    notes = ["C5", "E5", "D5", "G4"] if major else ["A4", "C5", "B4", "E4"]
    for i, nm in enumerate(notes):
        x = S.epiano(S.note_freq(nm), 2.6 if i == 3 else 1.8)
        B["music"].add(x, t + i * 0.42 + (0.03 if i == 2 else 0), gain - (2 if i == 3 else 0), -0.25, 0.6)


def build_turn_music():
    t0 = at("L098.ss") - 0.05
    pin_t = at("L108.se") + 0.75 + 1.4
    t_end = SIL["before_endcard"][0] - 0.2
    chords = [
        ["C3", "G3", "C4", "E4"],
        ["G2", "D3", "B3", "D4"],
        ["A2", "E3", "A3", "C4"],
        ["F2", "C3", "A3", "C4"],
    ]
    dur = 2.5
    r = np.random.default_rng(11)
    t = t0
    i = 0
    while t < t_end - 1.0:
        ch = chords[i % 4]
        for j, nm in enumerate(ch):
            off = [0.0, 0.16, 0.31, 0.45][j] + r.uniform(-0.015, 0.015)
            vel = [-2.0, -7.0, -6.5, -5.5][j] + r.uniform(-1, 1)
            B["music"].add(S.piano(S.note_freq(nm), 3.6, 500 + i * 4 + j), t + off, -24 + vel, -0.1 + 0.08 * j, 0.5)
        pad = S.string_pad([S.note_freq(n) for n in ch[1:]], dur + 1.2, 600 + i)
        B["music"].add(S.stereo(S.lp(pad, 2200), 0, 1.0), t - 0.3, -36)
        t += dur
        i += 1
    # fade under the second photograph
    B["music"].env([(0, 0), (pin_t - 1.0, 0), (t_end, -40), (D + 6, -80)])


# ---------------------------------------------------------------- transitions
def stronger_shutter(t, g=-30):
    B["sfx"].add(S.shutter(0.6, 7, advance=False), t, g)


def fingerprint(shot):
    tr, t = shot["trans"], shot["start"]
    sid = shot["id"]
    if tr == "into":
        B["sfx"].add(S.lp(S.whoosh(0.8, 250, 1800, 200 + int(t)), 3500), t - 0.4, -30, 0.0, 1.0)
        bloom = S.lp(S.pink(int(1.2 * SR), 210 + int(t)), 1600) * S.env_exp(int(1.2 * SR), 0.35) * (1 - np.exp(-np.arange(int(1.2 * SR)) / (0.08 * SR)))
        B["sfx"].add(S.stereo(S.norm(bloom), 0, 1.0), t, -34)
        stronger_shutter(t + 0.05)
    elif tr == "flatten":
        B["sfx"].add(S.reverse_swell(0.55, 220 + int(t), 110), t - 0.1, -27)
        B["sfx"].add(S.paper_snap(230 + int(t)), t + 0.45, -25, 0.2, 0.5)
        stronger_shutter(t + 0.45, -32)
    elif tr == "popout":
        pass  # timed per shot (the pop is mid shot)
    elif tr == "lift":
        B["sfx"].add(S.whoosh(0.95, 200, 2400, 240), t - 0.05, -27, 0.0, 1.0)
        stronger_shutter(t + 0.05, -32)
    elif tr == "layersplit":
        B["sfx"].add(S.whoosh(0.5, 1500, 7000, 250 + int(t)), t - 0.15, -30, 0.0, 1.0)
        B["sfx"].add(S.thump(260, 90, 0.25), t + 0.1, -28)
        B["sfx"].add(S.glitch_zap(0.08, 270 + int(t)), t + 0.05, -36)
        stronger_shutter(t + 0.1, -33)
    elif tr == "scalejump":
        B["sfx"].add(S.riser(1.8, 280 + int(t)), t - 1.8, -31, 0.0, 1.0)
        B["sfx"].add(S.sub_drop(1.1), t, -21)
    elif tr == "pageflip":
        B["sfx"].add(soft(S.paper_flip(290 + int(t)), 5000), t, -29, 0.15, 0.6)
    elif tr == "shutter":
        B["sfx"].add(S.lp(S.flash_pop(310 + int(t)), 3500), t - 0.45, -38)
        B["sfx"].add(S.lp(S.shutter(1.0, 11 + int(t) % 7), 7000), t, -20)


def heading(t):
    B["sfx"].add(S.reverse_swell(1.1, 320 + int(t), 98), t - 1.1, -25)
    B["sfx"].add(S.hp(S.sub_drop(1.2, 90, 30), 32), t, -24)


# ---------------------------------------------------------------- foley by shot
def riffle_n(lt, t0, t1):
    x = max(0.0, lt - t0)
    span = t1 - t0
    k = min(x, span)
    return 3 * k + 13 * k * k / (2 * span) + (16 * (x - span) if x > span else 0)


def foley():
    sfx, ph = B["sfx"], B["photo"]
    # ---- hook
    s = st("H01_book")
    sfx.add(S.shutter(0.55, 3), 0.22, -25)
    sfx.add(soft_cloth(0.4, 400), s + 0.18, -33, 0.4, 0.8)
    sfx.add(soft(S.paper_slide(1.25, 401, 1.2), 6000), s + 0.78, -22, 0.2, 0.8)
    sfx.add(S.hp(S.thump(402, 220, 0.12), 400), s + 2.68, -30, 0.1)
    sfx.add(soft_cloth(0.4, 403), s + 2.8, -33, 0.45, 0.8)
    # do not throw it away: pedal bin
    s = st("H02_bin")
    sfx.add(S.paper_slide(0.25, 404, 2.5), at("L002.w2"), -36, -0.1)
    lid = S.hp(S.thump(405, 180, 0.15), 150) * 0.8 + 0.6 * S.bell(950, 0.35)[: int(0.15 * SR)] * S.env_exp(int(0.15 * SR), 0.03)
    sfx.add(S.norm(lid), at("L002.w4") + 0.31, -24, -0.15)
    sfx.add(soft_cloth(0.35, 406), at("L002.w4") + 0.05, -33, 0.2, 0.8)
    # do not show it to anyone
    s = st("H02_show")
    sfx.add(soft_cloth(0.35, 407), s + 0.02, -34, 0.2, 0.8)
    sfx.add(S.paper_snap(408), s + 0.42, -36, 0.1)
    sfx.add(S.whoosh(0.4, 400, 1800, 409), at("L002.w10") - 0.05, -31, -0.3, 0.8)
    sfx.add(soft_cloth(0.4, 410), at("L002.w10") + 0.05, -31, -0.35, 0.8)
    # do not try to remember: the calendar riffles backwards, then jams
    s = st("H02_remember")
    t_jam = at("L003.w8") - s
    t_try = at("L003.w3") - s
    prev = 0
    lt = 0.2
    while lt < t_jam:
        nn = int(riffle_n(lt, 0.2, t_jam))
        if nn > prev:
            rate = (riffle_n(lt + 0.05, 0.2, t_jam) - riffle_n(lt, 0.2, t_jam)) / 0.05
            sfx.add(soft(S.page_flick(420 + nn, 0.5 + 0.04 * rate), 5000), s + lt, -36 + min(4, rate * 0.25), 0.3 if nn % 2 else 0.18, 0.4)
            prev = nn
        lt += 1 / 600
    sfx.add(S.reverse_swell(t_jam - t_try + 0.3, 425, 98), s + t_try - 0.3, -32)
    sfx.add(S.glitch_zap(0.14, 426), s + t_jam, -27, 0.2)
    for k in range(3):
        sfx.add(S.page_flick(427 + k, 0.7), s + t_jam + 0.03 + 0.045 * k, -31, 0.25)
    sfx.add(S.puff(428, 1000, 0.08), s + t_jam + 0.4, -33, 0.3)
    # you already looked at it twice
    l4 = at("L004.ss")
    for g in (l4 - 0.15, l4 + 0.6):
        sfx.add(soft_cloth(0.3, 430 + int(g * 10)), g, -38, -0.3, 0.8)
    sfx.add(S.bp(S.noise(int(0.12 * SR), 431), 1500, 4000) * S.adsr(int(0.12 * SR), 0.02, 0.03, 0.5, 0.05), st("H03_compare") + 0.3, -38, -0.2)
    s = st("H05_diagram")
    sfx.add(S.paper_slide(0.6, 433, 1.5), s + 0.55, -31, -0.35, 0.8)
    sfx.add(soft(S.pen_scratch(0.45, 434), 4200), s + 1.15, -39, 0.2)
    sfx.add(soft_cloth(0.35, 435), at("L009.w9"), -34, 0.3, 0.8)
    s = st("H07_notice")
    sfx.add(soft(S.paper_slide(1.1, 436, 1.0), 6000), s + 0.15, -23, 0.3, 0.8)
    sfx.add(S.paper_flip(437), s + 1.6, -26, 0.1, 0.5)
    # check the corner: the punch
    sfx.add(S.hp(S.thump(438, 66, 0.35), 45), TL["punches"][0], -30)
    # 3 m to 40 m, and the zoom lens
    s = st("H09_distance")
    sfx.add(S.whoosh(0.9, 2500, 300, 439), at("L014.ss") - 0.15, -29, 0.0, 1.0)
    lens = S.booth_whirr(2.0, 440)
    lens = S.hp(lens, 300) * np.linspace(0.6, 1.0, len(lens))
    sfx.add(S.norm(lens), at("L015.ss") + 0.05, -36, 0.25)
    # four things: four pips light
    l16 = at("L016.w4")
    for k in range(4):
        sfx.add(S.wood_tok(520 * 2 ** (k * 2 / 12), 440 + k), l16 + 0.55 * k, -30, -0.15 + 0.1 * k)
    # when: the clock face spins, then the open loop rings
    s = st("H11_when")
    ang, lt = 0.0, 0.0
    while lt < 1.7:
        a2 = lt * lt * 9
        if int(a2 / (np.pi / 6)) > int(ang / (np.pi / 6)):
            sfx.add(S.clock_tick(441 + int(lt * 100)), s + lt, -33, 0.1)
        ang = a2
        lt += 1 / 1000
    sfx.add(S.ping(1000, 1.8), at("L017.w8"), -25)

    # ---- Thing 1
    seg_layer(lambda d: S.stereo(S.rain(d, 450, 0.35), 0, 1.0), st("T1_dive"), en("T1_flatten"), -25, bus="photo")
    seg_layer(lambda d: S.stereo(traffic(d, 451), 0, 1.0), st("T1_dive"), en("T1_flatten"), -30, bus="photo")
    sfx.add(soft_cloth(0.35, 452), at("L020.ss") - 0.1, -34, 0.2, 0.8)
    ph.add(S.hp(S.bus_pass(3.4, 453), 70), at("L022.w1") - 0.5, -22)
    ph.add(S.sip(454), at("L022.w4") + 0.15, -26)
    # the rule: a riser into the kinetic type
    sfx.add(S.riser(1.6, 456), at("L026.ss") - 1.6, -30, 0.0, 1.0)
    sfx.add(S.thump(457, 80, 0.3), at("L026.ss"), -27)
    sfx.add(S.low_hit(1.4, 458), at("L026.w6") - 0.05, -24)
    s = st("T1_lineup")
    t = s + 0.2
    k = 0
    while t < en("T1_lineup") - 0.3:
        sfx.add(S.footstep(460 + k), t, -37, -0.5 + (k % 7) / 6, 0.5)
        t += 0.31
        k += 1
    seg_layer(lambda d: S.stereo(traffic(d, 461), 0, 1.0), st("T1_street"), en("T1_street"), -27, bus="photo")
    seg_layer(lambda d: S.stereo(S.rain(d, 462, 0.5), 0, 1.0), st("T1_street"), en("T1_street"), -31, bus="photo")
    for k in range(6):
        ph.add(S.footstep(463 + k, "wet"), st("T1_street") + 0.3 + 0.42 * k, -36, 0.6 - 0.2 * k)
    # the tally to 41
    w = lambda i: at(f"L030.w{i}")
    a, b = w(4) - 0.4, w(8) + 0.15
    prev = 0
    for i in range(0, 4000):
        tt = a + (b - a) * i / 4000
        x = (tt - a) / (b - a)
        cnt = int(41 * (1 - (1 - x) ** 3))
        if cnt > prev:
            sfx.add(S.relay(464 + cnt), tt, -39, 0.1)
            prev = cnt
    sfx.add(S.thump(465, 70, 0.3), b, -27)
    # meter changes: a short descending blip
    for m in [m for m in TL["meter"] if m["kind"] == "m"][1:]:
        sfx.add(S.relay(int(m["t"])), m["t"], -29, 0.35)
        sfx.add(S.relay(int(m["t"]) + 1), m["t"] + 0.09, -33, 0.35)

    # ---- Thing 2
    sfx.add(S.hp(S.thump(470, 200, 0.12), 300), at("L032.w2") + 0.3, -27)
    sfx.add(soft_cloth(0.4, 471), at("L032.w3"), -35, -0.3, 0.8)
    sfx.add(S.whoosh(0.35, 600, 3000, 472), at("L032.w6") + 0.12, -29, 0.2, 0.8)
    sfx.add(S.glitch_zap(0.06, 473), at("L032.w6") + 0.4, -36)
    sfx.add(soft_cloth(0.7, 474), st("T2_scarf") + 0.15, -28, 0.3, 1.0)
    for i in range(4):
        sfx.add(S.paper_snap(475 + i), st("T2_places") + 0.25 + 0.35 * i, -31, -0.45 + 0.3 * i)
    s = st("T2_phone")
    sfx.add(S.phone_buzz(476), s + 0.05, -27, -0.1)
    for k in range(3):
        sfx.add(S.hp(S.page_flick(477 + k, 0.6), 1500), s + 1.4 + k / 1.1, -40, -0.1)
    s = st("T2_call")
    sfx.add(S.lp(np.concatenate([S.beep(660, 0.1), np.zeros(int(0.04 * SR)), S.beep(990, 0.14)]), 2500), s + 0.1, -35)
    call_room = lambda d: S.stereo(S.bp(S.pink(int(d * SR), 478), 300, 3400) * 0.5, 0, 0.3)
    seg_layer(call_room, s, en("T2_call"), -40)
    seg_layer(lambda d: S.bp(S.keyboard_typing(d, 479), 600, 3400), s + 0.4, en("T2_call"), -40, 0.35)
    s = st("T2_booth")
    seg_layer(lambda d: S.stereo(S.booth_whirr(d, 480), 0, 0.5), s, en("T2_booth"), -32)
    for f in [0.3, 0.75, 1.2, 1.65]:
        sfx.add(S.shutter(0.8, 481 + int(f * 10), advance=False), s + f, -24, 0.1)
        sfx.add(soft(S.flash_pop(482 + int(f * 10)), 3500), s + f - 0.45, -39, 0.1)
    s = st("T2_shop")
    seg_layer(lambda d: S.stereo(S.lp(traffic(d, 483), 380), 0, 1.0), s, en("T2_shop"), -26, bus="photo")
    seg_layer(lambda d: S.stereo(S.lp(S.rain(d, 484, 0.3), 3000), 0, 1.0), s, en("T2_shop"), -31, bus="photo")
    for k in range(6):
        ph.add(S.footstep(485 + k, "wet"), s + 0.15 + 0.36 * k, -33, -0.2 + 0.08 * k)
    ph.add(S.bell(1320, 1.4), s + 1.0, -42, 0.5)
    for k in range(4):
        ph.add(S.footstep(490 + k, "wet"), at("L040.ss") + 0.1 + 0.4 * k, -34, 0.3 - 0.1 * k)
    s = st("T2_grid")
    for k in range(12):
        sfx.add(S.paper_snap(495 + k), s + 0.32 + 0.055 * k, -36, -0.6 + 0.1 * k)
    t = at("L042.w5") - 0.05
    sfx.add(S.reverse_swell(0.9, 496, 55), t - 0.9, -26)
    sfx.add(S.hp(S.braam(2.4, 497), 45), t, -28)
    sfx.add(S.hp(S.low_hit(2.0, 498), 40), t, -35)

    # ---- Thing 3
    pop_t = at("L044.w5") + 0.5
    sfx.add(S.thump(500, 75, 0.25), pop_t, -22)
    sfx.add(soft_cloth(0.3, 501), pop_t + 0.02, -29, 0.4, 0.8)
    motif(st("T3_ecu") + 0.1)
    s = st("T3_escape")
    t_esc = at("L048.w3") - s
    t_man = at("L048.w7") - s
    for k, (d, p) in enumerate([(0.0, 0.15), (0.22, 0.35), (0.42, 0.55)]):
        sfx.add(S.puff(504 + k, 1300 + 150 * k), s + t_esc + d, -31, p)
    sfx.add(S.hp(S.thump(502, 300, 0.07), 800), s + t_man - 0.06, -31, -0.05)
    sfx.add(S.puff(509, 1800, 0.04), s + t_man + 0.35, -40, 0.2)
    s = st("T3_request")
    sfx.add(S.puff(510, 1100), at("L049.w1") - 0.05, -34, -0.3)
    tr = at("L049.w5") + 0.1
    sfx.add(soft(S.flash_pop(503), 3500), tr - 0.45, -38, -0.3)
    sfx.add(S.shutter(0.9, 504), tr, -22, -0.3)
    # cheese: a rising chorus of tiny shutter clicks as the cards stack, then cut
    s = st("T3_cheese")
    not_cheese = at("L051.w4") - s
    cut = s + not_cheese - 0.3
    for i in range(9):
        sfx.add(S.early_click(505 + i), s + 0.15 + 0.18 * i, -30, -0.6 + 0.15 * i)
    r = np.random.default_rng(506)
    t = s + 0.1
    while t < cut:
        k = (t - s) / (cut - s)
        sfx.add(S.early_click(int(r.integers(1, 9999))), t, -38 + 6 * k, r.uniform(-0.8, 0.8))
        t += 1 / (3 + 22 * k)
    sfx.add(S.paper_slide(0.6, 507, 1.6), cut + 0.02, -27, 0.4)
    for i in range(9):
        sfx.add(S.hp(S.thump(508 + i, 180, 0.1), 300), s + not_cheese + 0.5 + i * 0.06 + 0.2, -33, -0.6 + 0.15 * i)
    sfx.add(S.thump(518, 80, 0.3), at("L052.ss"), -28)
    sfx.add(S.low_hit(1.4, 519), at("L052.w7") - 0.05, -24)
    sfx.add(soft(S.paper_flip(520), 4500), at("L053.ss") + 0.5, -31, 0.1, 0.6)
    w_line = LINES["L054"]["start"]
    sfx.add(S.ping(1000, 1.8), w_line, -26)
    sfx.add(soft(S.pen_scratch(0.55, 521), 4200), w_line + 0.1, -40, -0.1)
    sfx.add(S.paper_slide(0.5, 522, 1.5), st("T3_compare"), -32, -0.2)
    lt_light = at("L056.w8")
    sfx.add(S.warm_hum(1.6, 523), lt_light - 0.3, -30, -0.2)
    sfx.add(S.stamp_hit(524), at("L058.w4"), -17)
    sfx.add(S.low_hit(1.6, 525), at("L058.w4"), -27)

    # ---- Thing 4
    s = st("T4_warm")
    sfx.add(S.warm_hum(en("T4_warm") - s, 530), s, -31, 0.0, 0.6)
    adv = S.shutter(0.4, 531)
    sfx.add(adv, s + 0.3, -27, 0.2)
    d0, d1 = at("L060.ss") + 0.1, at("L060.w8")
    hiss = S.hp(S.pink(int((d1 - d0 + 0.5) * SR), 532), 3000) * np.linspace(0.2, 1, int((d1 - d0 + 0.5) * SR)) ** 2
    sfx.add(S.stereo(fade(hiss, 0.3, 0.5), 0.1, 1.0), d0, -36)
    pop_t = st("T4_popout") + 0.9
    sfx.add(S.thump(533, 75, 0.25), pop_t, -22)
    sfx.add(soft_cloth(0.3, 534), pop_t + 0.02, -29, 0.3, 0.8)
    motif(st("T4_popout") + 2.9, gain=-31)
    p0, p1 = at("L062.ss") - 0.1, at("L062.w4")
    t = p0
    feed = int((p1 - p0) * SR)
    tt = np.arange(feed) / SR
    paper = S.bp(S.noise(feed, 531), 600, 3500) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 14 * tt)))
    sfx.add(S.lp(paper, 3500) * np.minimum(1, tt / 0.2), p0, -44, 0.1)
    sfx.add(S.relay(532), p1 + 0.03, -31)
    s = st("T4_drawer")
    sfx.add(S.drawer(1.0, 535), s + 0.2, -24, 0.2)
    drop_n = int(0.9 * SR)
    tt = np.arange(drop_n) / SR
    tape = np.sin(2 * np.pi * np.cumsum(196 * (0.5 ** (tt / 0.9))) / SR) * S.adsr(drop_n, 0.02, 0.1, 0.8, 0.3)
    sfx.add(S.norm(tape), at("L064.ss"), -31)
    keep = at("L066.ss")
    sfx.add(S.drawer(0.7, 536), keep + 0.15, -26, 0.2)
    sfx.add(S.thump(537, 110, 0.2), keep + 0.86, -21, 0.2)
    seg_layer(lambda d: S.stereo(S.rain(d, 538, 0.45), 0, 1.0), st("T4_happening"), SIL["before_reveal"][0], -28, bus="photo", fout=0.03)

    # ---- reveal: no music, room tone, the ring of the flip, the voice
    flip = TL["camera_icon"]
    sfx.add(S.lp(S.low_hit(5.0, 540, ring=True), 2600), flip, -17)
    sfx.add(S.sub_drop(1.6, 80, 24), flip, -19)
    sfx.add(S.thump(541, 80, 0.3), at("L070.w4") - 0.05, -26)
    fingerprint_extra = st("R4_ruler")
    sfx.add(S.whoosh(1.6, 900, 200, 542), fingerprint_extra + 1.6, -33, 0.0, 1.0)
    # the calendar tunnel: a rising riffle of pages, then cut dry
    s = st("R5_tunnel")
    cut = at("L073.ss") - 0.05
    t = s + 0.1
    r = np.random.default_rng(544)
    while t < cut:
        k = (t - s) / (cut - s)
        sfx.add(soft(S.page_flick(int(r.integers(1, 9999)), 0.5 + 0.7 * k), 5000), t, -47 + 13 * k, r.uniform(-0.7, 0.7), 0.3)
        t += 1 / (5 + 40 * k ** 1.5)
    # the items: a dry laugh a beat early
    sfx.add(soft_cloth(0.5, 545), at("L074.w1"), -31, 0.3, 0.8)
    sfx.add(S.hp(S.thump(546, 240, 0.08), 500), at("L074.w3") + 0.1, -31, 0.2)
    sfx.add(S.formant_laugh(4, 230, 547), at("L074.w8") - 0.55, -27, 0.25)
    sfx.add(S.stereo(S.norm(S.lp(S.pink(int(1.6 * SR), 548), 500) * np.hanning(int(1.6 * SR))), 0, 1.0), st("R7_weather") + 0.2, -33)
    s = st("R8_envelope")
    sfx.add(S.paper_slide(0.9, 549, 1.2), s + 1.5, -28, 0.1)
    sfx.add(S.paper_snap(550), at("L078.ss") - 0.1, -30, 0.1)
    s = st("R9_post")
    sfx.add(S.stamp_hit(551), s + 0.42, -18)
    sfx.add(S.paper_slide(1.8, 552, 0.8), at("L079.w8"), -30, 0.2, 0.8)
    seg_layer(lambda d: S.stereo(S.lp(traffic(d, 553), 350), 0, 1.0), st("R10_window"), en("R10_window") + 0.5, -32, bus="photo")

    # ---- escape
    p = lambda x: ease_in_out(x)
    a, b = at("L081.ss") - 0.4, at("L082.ss") - 0.1
    press = a + (b - a) * inv(p, 0.78)
    sfx.add(S.hp(S.thump(560, 320, 0.06), 900), press, -27, 0.4)
    sfx.add(S.clock_tick(561), press + 0.02, -33, 0.4)
    for wd in ["L083.we6", "L083.se"]:
        sfx.add(soft(S.pen_scratch(0.3, 562 + len(wd)), 4200), at(wd), -34, -0.1)
    s = st("E3_arrange")
    stiff = at("L084.we12")
    flash_t = stiff - 0.75
    sfx.add(S.switch_click(563), s + 0.42, -29, 0.3)
    t = s + 1.0
    while t < flash_t - 0.05:
        sfx.add(S.lp(S.beep(2000, 0.05), 3500), t, -38, 0.3)
        t += 0.5
    for k in range(4):
        sfx.add(S.footstep(564 + k), s + 0.85 + 0.27 * k, -31, 0.3 - 0.2 * k)
    sfx.add(soft(S.flash_pop(568), 3500), flash_t - 0.45, -37, 0.3)
    sfx.add(S.shutter(0.9, 569), flash_t, -22, 0.3)
    sfx.add(S.body_thud(570), stiff + 0.55, -19, -0.1)
    s = st("E4_work")
    home = at("L085.w3") - 0.15
    pas = at("L085.w5") - 0.15
    seg_layer(lambda d: S.keyboard_typing(d, 571), s + 0.1, home, -33, -0.2, bus="sfx", fin=0.05, fout=0.05)
    sfx.add(S.key_lock(1.5, 572), home - 0.1, -24, 0.25)
    for k in range(5):
        sfx.add(S.footstep(573 + k), pas + 0.1 + 0.45 * k, -32, -0.1 + 0.1 * k)
    seg_layer(lambda d: S.kettle(d, 578), pas + 0.8, en("E4_work") + 0.3, -35, 0.3, bus="sfx", fin=0.6)
    # the days: a soft rhythm of pages
    bnd = [st("E5_days"), at("L087.ss") - 0.2, at("L087.w6") - 0.15, at("L088.ss") - 0.2, at("L089.ss") - 0.2, at("L089.w5") - 0.15, at("L090.ss") - 0.2]
    for i, t in enumerate(bnd[1:]):
        sfx.add(S.paper_flip(580 + i), t, -26, 0.15 - 0.05 * i, 0.6)
    sfx.add(S.sip(587), bnd[0] + 0.7, -32, -0.1)
    sfx.add(S.clink(588), bnd[0] + 2.1, -27, -0.1)
    seg_layer(lambda d: S.stereo(S.rain(d, 589, 0.7), 0, 1.0), bnd[3], bnd[4], -28, bus="photo")
    for k in range(3):
        sfx.add(S.paper_snap(590 + k), bnd[4] + 0.18 + 0.35 * k, -34, 0.2)
    # the countdown to zero
    c1 = [m for m in TL["meter"] if m["kind"] == "count"][1]
    prev = 38
    for i in range(3000):
        tt = c1["t"] + (c1["until"] - c1["t"]) * i / 3000
        x = i / 3000
        e = 1 - (1 - x) ** 2.2
        v = round(38 - 38 * e)
        if v < prev:
            if v % 2 == 0 or v < 10:
                sfx.add(S.relay(590 + v), tt, -37, 0.1)
            prev = v
    sfx.add(S.hp(S.thump(595, 66, 0.35), 45), TL["punches"][2], -30)
    # the ordinary Tuesday
    seg_layer(lambda d: S.stereo(S.rain(d, 596, 0.2), 0, 1.0), st("E7_tuesday"), SIL["after_laugh"][0], -31, bus="photo", fin=1.0, fout=0.05)
    seg_layer(lambda d: S.stereo(traffic(d, 597), 0, 1.0), st("E7_tuesday"), SIL["after_laugh"][0], -38, bus="photo", fin=1.2, fout=0.05)
    ph.add(soft_cloth(0.4, 598), at("L092.w4"), -28, 0.2)
    ph.add(S.murmur(1.1, 599), at("L092.w9"), -31, 0.5)

    # ---- turn
    s = st("O1_earlier")
    sfx.add(S.play_clunk(600), s - 0.05, -27)
    seg_layer(lambda d: S.stereo(S.lp(S.bp(S.pink(int(d * SR), 601), 1500, 7000), 5000), 0, 0.8), s + 0.2, en("O1_earlier"), -50, fin=0.4, fout=0.1)
    sfx.add(S.whoosh(0.5, 300, 1400, 602), at("L096.w9") - 0.05, -32, -0.3, 0.8)
    sfx.add(soft_cloth(0.4, 603), at("L096.w9") + 0.05, -33, -0.3, 0.8)
    s = st("O1_reviewed")
    sfx.add(soft(S.pen_scratch(0.3, 604), 4200), s + 0.05, -39, 0.1)
    rev = at("L097.w3")
    sfx.add(S.stamp_hit(605), rev + 0.05, -19)
    sfx.add(soft(S.pen_scratch(0.35, 606), 4200), rev + 0.42, -35, 0.1)
    s = st("O2_frame")
    sfx.add(S.thump(607, 115, 0.2), s + 1.8, -26, 0.3)
    sfx.add(S.shutter(0.35, 608, advance=False), s + 2.05, -30, 0.3)
    sfx.add(soft_cloth(0.35, 609), at("L100.ss") - 0.1, -34, 0.2, 0.8)
    seg_layer(lambda d: S.stereo(traffic(d, 610), 0, 1.0), st("O3_nobody"), en("O3_nobody"), -33, bus="photo")
    motif(st("O5_glad") + 0.3, major=True, gain=-27)
    seg_layer(lambda d: soft(S.pen_scratch(d, 611), 4200), at("L103.ss") + 0.2, at("L104.se") - 0.4, -41, -0.15, bus="sfx", fin=0.25, fout=0.3)
    sl = at("L105.w4") - 0.1
    sfx.add(S.paper_slide(1.0, 612, 0.6), sl, -29, 0.0)
    sfx.add(S.bell(2093, 1.6), sl + 0.3, -41, 0.1)
    off_t = at("L108.se") + 0.75
    pin_t = off_t + 1.4
    sfx.add(S.switch_click(613), off_t - 0.02, -22, 0.5)
    sfx.add(S.shutter(0.35, 614, advance=False), pin_t + 1.2, -30, -0.1)
    # end: near silence, one shutter click very slightly early, then the card's ding
    card = st("O9_card")
    B["post"].add(S.shutter(0.75, 615), card - 0.14, -23)
    B["post"].add(S.bell(1568, 2.4), card + 0.06, -25)
    # the one perfect click, both channels together, exactly on the laugh
    B["post"].add(S.lp(S.shutter(1.0, 616), 7000), LAUGH_T, -23)


def early_clicks():
    for c in TL["early_clicks"]:
        B["sfx"].add(S.early_shutter(700 + int(c["t"] * 10)), c["t"], -27, 0.3, 0.6)


def events():
    for g in EV["glitches"]:
        B["sfx"].add(soft(S.glitch_zap(max(0.06, g["dur"]), 800 + int(g["t"] * 10)), 7000), g["t"], -31 + 3 * (g.get("amt", 0.8) - 0.8), 0.1)
    for f in EV["flickers"]:
        B["sfx"].add(S.flicker_buzz(0.32, 810 + int(f["t"])), f["t"], -30, 0.0)
    for sh in EV["shots"]:
        fingerprint(sh)
    for tid in ["T1_title", "T2_title", "T3_title", "T4_title"]:
        heading(st(tid))
    # new open loops ring a clean 1 kHz tone: the meter (B), loop D (the laugh gets wider)
    B["sfx"].add(S.ping(1000, 1.8), at("L061.w9"), -27)


# ---------------------------------------------------------------- photo world and acoustics
def room_ir(rt60, seed, lp_hz=5000, hp_hz=200):
    n = int(rt60 * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    ir = r.standard_normal((n, 2)) * np.exp(-6.9 * t / rt60)[:, None]
    ir = signal.sosfilt(signal.butter(2, [hp_hz, lp_hz], btype="bandpass", fs=SR, output="sos"), ir, axis=0)
    return ir / np.sqrt(np.sum(ir ** 2))


def process_photo_bus():
    """the photograph's world: slightly behind and to the right, a little warmer"""
    x = B["photo"].x.astype(np.float64)
    m = x.mean(1)
    left, right = m * 0.62, m * 0.92
    y = np.stack([left, right], 1)
    y = signal.sosfilt(signal.butter(2, 5200, btype="lowpass", fs=SR, output="sos"), y, axis=0)
    y = y + 0.25 * signal.sosfilt(signal.butter(2, 300, btype="lowpass", fs=SR, output="sos"), y, axis=0)
    wet = signal.fftconvolve(y, room_ir(0.6, 31, 4500), axes=0)[: len(y)]
    B["sfx"].x += (y * 0.85 + wet * 0.35).astype(np.float32)


def voice_bus():
    v, sr = sf.read(os.path.join(OUT, "voiceover_master.wav"))
    assert sr == SR
    x = np.zeros(N + SR * 6)
    x[: len(v)] = v
    # the room changes: dry, then a hallway, then dry again
    spans = [(st("H06_flash"), en("H06_flash")), (st("R10_window"), en("R10_window")), (st("O3_nobody"), en("O3_nobody"))]
    send = np.zeros(len(x))
    for a, b in spans:
        send += np.interp(np.arange(len(x)) / SR, [a - 0.3, a, b - 0.2, b + 0.2], [0, 1, 1, 0], left=0, right=0)
    wet = signal.fftconvolve(x * send, room_ir(0.9, 41, 4500, 250)[:, 0])[: len(x)]
    x = x + 0.16 * wet
    # designed dynamics: Thing 3 a little closer, the reveal very close (softer, with
    # proximity warmth), the turn gentle
    tt = np.arange(len(x)) / SR
    pts = [(0, 0), (SEC["thing3"] - 0.5, 0), (SEC["thing3"] + 0.5, -1.0), (SEC["thing4"] - 0.5, -1.0), (SEC["thing4"] + 0.5, -0.5),
           (SEC["reveal"] - 1.2, -0.5), (SEC["reveal"] - 0.2, -3.0), (SEC["escape"] - 0.6, -3.0), (SEC["escape"] + 0.6, -1.0),
           (SEC["turn"] - 0.6, -1.0), (SEC["turn"] + 0.6, -2.0), (D + 6, -2.0)]
    g = db(np.interp(tt, [p[0] for p in pts], [p[1] for p in pts]))
    close = np.interp(tt, [SEC["reveal"] - 1.2, SEC["reveal"] - 0.2, SEC["escape"] - 0.6, SEC["escape"] + 0.6], [0, 1, 1, 0], left=0, right=0)
    warm = signal.sosfilt(signal.butter(2, 220, btype="lowpass", fs=SR, output="sos"), x)
    x = (x + 0.32 * warm * close) * g
    return deess(x)


def deess(x, f=4800, thr_db=-33.0, ratio=3.0):
    h = signal.firwin(255, f, pass_zero=False, fs=SR)
    hi = signal.fftconvolve(x, h)[127: 127 + len(x)]
    lo = x - hi
    e = np.sqrt(np.maximum(uniform_filter1d(hi ** 2, int(0.005 * SR)), 1e-14))
    over = np.maximum(0, 20 * np.log10(e) - thr_db)
    red = over * (1 - 1 / ratio)
    red = np.maximum(red, uniform_filter1d(red, int(0.03 * SR)))
    red = uniform_filter1d(red, int(0.003 * SR))
    print(f"de-esser: max {red.max():.1f} dB, active {np.mean(red > 1) * 100:.2f} % of the time")
    return lo + hi * db(-red)


# ---------------------------------------------------------------- dynamics
def duck_gain(v, depth_db, attack=0.08, release=0.4):
    hop = int(0.01 * SR)
    n = len(v) // hop
    rms = np.sqrt(np.mean(v[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    d = 20 * np.log10(rms)
    act = np.clip((d + 50) / 14, 0, 1)
    out = np.zeros(n)
    a_at = np.exp(-0.01 / attack)
    a_rel = np.exp(-0.01 / release)
    y = 0.0
    for i in range(n):
        a = a_at if act[i] > y else a_rel
        y = a * y + (1 - a) * act[i]
        out[i] = y
    g = db(-depth_db * out)
    return np.interp(np.arange(len(v)), np.arange(n) * hop + hop / 2, g)


def dips():
    """the sound dip: the whole mix (not the voice) drops 6 dB for 0.4 s before an important line"""
    pts = [(0, 0)]
    for lid in ["L012", "L026", "L053", "L091", "L098"]:
        t = LINES[lid]["sound_start"]
        pts += [(t - 0.48, 0), (t - 0.4, -6), (t - 0.02, -6), (t + 0.12, 0)]
    # Thing 4: a held breath after the drawer shuts
    k = at("L066.ss") + 0.95
    pts += [(k, 0), (k + 0.08, -8), (k + 0.6, -8), (k + 0.9, 0)]
    pts.append((D + 6, 0))
    return sorted(pts)


def silence_curve():
    pts = [(0, 0)]
    for a, b in SIL.values():
        pts += [(a - 0.06, 0), (a, -40), (b, -40), (b + 0.12, 0)]
    pts.append((D + 6, 0))
    return sorted(pts)


def main():
    build_bed()
    build_pulse()
    build_clock()
    build_pizz()
    build_turn_music()
    foley()
    early_clicks()
    events()
    process_photo_bus()
    x = B["sfx"].x.astype(np.float64)
    wet = signal.fftconvolve(x, room_ir(0.45, 51, 5000, 180), axes=0)[: len(x)]
    B["sfx"].x += (0.22 * wet).astype(np.float32)
    del x, wet

    v = voice_bus()
    n = len(v)
    print("ducking")
    g_bed = duck_gain(v, 7.5)[:, None]
    g_sub = duck_gain(v, 4.0)[:, None]
    g_sfx = duck_gain(v, 2.0)[:, None]
    # bus trims (dB): the bed has to read on a phone, the voice stays king
    trim = {"amb": 6.0, "pad": 4.0, "music": 3.5, "sub": -1.0, "sfx": 2.0}
    mix = np.zeros((n, 2))
    mix += v[:, None]
    for name in ["amb", "pad", "music"]:
        mix += B[name].x[:n] * g_bed * db(trim[name])
    mix += B["sub"].x[:n] * g_sub * db(trim["sub"])
    mix += B["sfx"].x[:n] * g_sfx * db(trim["sfx"])
    # dips and the three near silences apply to everything but the voice
    nonvoice = mix - v[:, None]
    tt = np.arange(n) / SR
    for pts in (dips(), silence_curve()):
        g = db(np.interp(tt, [p[0] for p in pts], [p[1] for p in pts]))
        nonvoice *= g[:, None]
    mix = v[:, None] + nonvoice + B["post"].x[:n]
    np.save("/root/work/stem_voice.npy", v[:N].astype(np.float32))
    np.save("/root/work/stem_rest.npy", (nonvoice + B["post"].x[:n])[:N].astype(np.float32))
    mix = mix[:N]
    mix = signal.sosfilt(signal.butter(2, 22, btype="highpass", fs=SR, output="sos"), mix, axis=0)

    meter = pyloudnorm.Meter(SR)
    for it in range(3):
        L = meter.integrated_loudness(mix)
        mix *= db(-14.0 - L)
        mix, gr = limiter(mix, -1.3, SR, lookahead_ms=5.0, release_ms=120.0)
        L2 = meter.integrated_loudness(mix)
        print(f"pass {it}: {L:.2f} -> {L2:.2f} LUFS, max limiting {gr.max():.2f} dB")
        if abs(L2 + 14.0) < 0.15:
            break
    tp = true_peak_db(mix)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "audio_mix.wav")
    sf.write(path, mix.astype(np.float32), SR, subtype="PCM_24")
    print(f"wrote {path}: {meter.integrated_loudness(mix):.2f} LUFS, true peak {tp:.2f} dBTP, {len(mix) / SR:.2f} s")
    qa(mix, path)


def qa(mix, path):
    meter = pyloudnorm.Meter(SR)
    # loudness range and short term spread from ffmpeg
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    summ = r.stderr[r.stderr.rfind("Summary:"):]
    print(" ".join(summ.split()))
    # the three near silences (non voice energy)
    for name, (a, b) in SIL.items():
        seg = mix[int(a * SR) + 2400: int(b * SR) - 2400]
        print(f"silence {name}: {20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12):.1f} dBFS rms")
    # phone check: through a 200 Hz high pass
    hp = signal.sosfilt(signal.butter(4, 200, btype="highpass", fs=SR, output="sos"), mix, axis=0)
    print(f"phone check (HP 200 Hz): {meter.integrated_loudness(hp):.2f} LUFS")
    st_l = []
    for i in range(0, len(mix) - 3 * SR, SR):
        st_l.append(meter.integrated_loudness(mix[i:i + 3 * SR]) if np.any(mix[i:i + 3 * SR]) else -70)
    st_l = np.array([x for x in st_l if x > -60])
    print(f"short term loudness p10 {np.percentile(st_l, 10):.1f}, p50 {np.percentile(st_l, 50):.1f}, p95 {np.percentile(st_l, 95):.1f} LUFS")


if __name__ == "__main__":
    main()
