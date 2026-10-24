"""Director: builds timeline.json (captions, shots, HUD, sound cues) from measured voice timings.
Both the picture (Remotion) and the audio build read this one file, so they cannot drift.
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
L = json.load(open(os.path.join(HERE, 'voice', 'lines.json')))
LINES = {l['id']: l for l in L['lines']}
FPS = 30


def S(i):
    return LINES[i]['start']


def E(i):
    return LINES[i]['end']


# ---------------- captions ----------------
DISPLAY = [
    (r'\bNine fourteen at night\b', '9:14 at night'),
    (r'\bNine fourteen\b', '9:14'),
    (r'\bEleven years ago\b', '11 years ago'),
    (r'\bTwo hundred and fourteen\b', '214'),
    (r'\btwo hundred and fifteen\b', '215'),
    (r'\bIn the eighties\b', 'In the 1980s'),
    (r'\ba fiftieth of a second\b', '1/50 of a second'),
    (r'\bknocks\b', 'knocks'),
]
EMPH = {
    'USELESS': 'gold', 'USELESS...': 'gold', 'RULE.': 'coral', 'NO.': 'coral', 'HER.': 'gold', 'CAME.': 'coral',
    'UP.': 'teal', 'COAT.': 'blue', 'PRANK.': 'coral', 'REASON.': 'gold', 'FIX': 'teal', 'PAPER.': 'violet',
    'SHORTCUT.': 'coral', 'JAMS.': 'coral', 'CANCELLED.': 'coral', 'EDIT': 'coral', 'SPLIT.': 'violet',
    'ALONE.': 'gold', 'EXPLAIN.': 'gold', 'THERE.': 'teal', 'PAST.': 'violet', 'FUTURE.': 'teal', 'CHOOSE.': 'teal',
    'NAME': 'gold', 'GO.': 'teal', 'SIT.': 'gold', '214': 'coral', '215': 'teal', 'GRANDMA': 'gold',
}


def display(text):
    t = text
    for a, b in DISPLAY:
        t = re.sub(a, b, t)
    return t.upper()


def chunk_line(text):
    """Split a line into caption chunks of 3 to 9 words, preferring sentence ends then commas."""
    words = display(text).split()
    if len(words) <= 9:
        return [' '.join(words)]
    # sentence or comma boundaries
    cuts = [i + 1 for i, w in enumerate(words[:-1]) if w.endswith(('.', '?', ',', '...'))]
    best = None
    for c in cuts:
        a, b = c, len(words) - c
        if 2 <= a <= 9 and 2 <= b <= 9:
            score = abs(a - b) - (3 if words[c - 1].endswith(('.', '?')) else 0)
            if best is None or score < best[0]:
                best = (score, c)
    if best is None:
        c = len(words) // 2
    else:
        c = best[1]
    return [' '.join(words[:c])] + chunk_line(' '.join(words[c:]).lower()) if len(words) - c > 9 else [' '.join(words[:c]), ' '.join(words[c:])]


def time_chunks(line, chunks):
    """Time each chunk; boundaries snap to the internal speech runs."""
    runs = line['runs']
    if len(chunks) == 1:
        return [(line['start'], line['end'])]
    tot = sum(len(c) for c in chunks)
    out = []
    t0 = line['start']
    span = line['end'] - line['start']
    acc = 0
    bounds = []
    for c in chunks[:-1]:
        acc += len(c)
        target = t0 + span * acc / tot
        gaps = [(runs[k][1], runs[k + 1][0]) for k in range(len(runs) - 1)]
        if gaps:
            g = min(gaps, key=lambda g: abs((g[0] + g[1]) / 2 - target))
            if abs((g[0] + g[1]) / 2 - target) < 0.9:
                target = g[1]
        bounds.append(target)
    edges = [t0] + bounds + [line['end']]
    for k in range(len(chunks)):
        out.append((edges[k], edges[k + 1]))
    return out


captions = []
for l in L['lines']:
    ch = chunk_line(l['text'])
    for c, (a, b) in zip(ch, time_chunks(l, ch)):
        emph = None
        for w in c.split():
            if w in EMPH:
                emph = (w, EMPH[w])
        captions.append(dict(line=l['id'], text=c, start=round(a - 0.03, 3), end=round(b + 0.05, 3), emph=emph))
# hold captions until the next one starts (hard cut), capped so a caption never lingers
for i, c in enumerate(captions):
    nxt = captions[i + 1]['start'] if i + 1 < len(captions) else c['end'] + 0.6
    c['end'] = round(min(nxt - 0.02, c['end'] + 0.45), 3)
# younger self caption (coral, parentheses), above the narrator during "He thinks it's a prank"
youngcap = dict(text='"(WHO IS THIS? IS THIS A PRANK?)"', start=round(E('b2.5') + 0.05, 3), end=round(S('b2.6') + 1.25, 3))

# ---------------- shots ----------------
END_PICK = E('b8.9')
BLACK_START = END_PICK + 0.75
END_CARD = BLACK_START + 1.7
TOTAL = END_CARD + 2.3

shots = []


def shot(id, start, end, trans='cut', tdur=0.4, **kw):
    shots.append(dict(id=id, start=round(start, 3), end=round(end, 3), trans=trans, tdur=tdur, **kw))


shot('ws_hook', 0.0, S('b1.3') - 0.12)
shot('mem_call', S('b1.3') - 0.12, E('b1.6') + 0.25, 'dive', 0.5)
shot('mem_funeral', E('b1.6') + 0.25, E('b1.9') + 0.2, 'layer', 0.45)
shot('ws_charge', E('b1.9') + 0.2, S('b1.11') - 0.85, 'diveout', 0.55)
shot('useless', S('b1.11') - 0.85, S('b1.12') - 0.05, 'cut')
shot('ring_promise', S('b1.12') - 0.05, S('b2.1') - 0.1, 'glitch', 0.2)
shot('station_cancel', S('b2.1') - 0.1, S('b2.2') - 0.08, 'loop', 0.5)
shot('zip_fp', S('b2.2') - 0.08, S('b2.3') - 0.08, 'eye', 0.35)
shot('taxi', S('b2.3') - 0.08, S('b2.5') - 0.08, 'flatten', 0.35)
shot('call_panel', S('b2.5') - 0.08, S('b2.7') - 0.08, 'rect', 0.3)
shot('race', S('b2.7') - 0.08, S('b2.8') - 0.12, 'dive', 0.3)
shot('rule_freeze', S('b2.8') - 0.12, S('b3.1') - 0.1, 'impact', 0.15)
shot('novikov', S('b3.1') - 0.1, S('b3.2') - 0.08, 'loop', 0.55)
shot('film', S('b3.2') - 0.08, S('b3.4') - 0.1, 'layer', 0.4)
shot('billiard_a', S('b3.4') - 0.1, S('b4.1') - 0.05, 'dive', 0.5)
shot('billiard_b', S('b4.1') - 0.05, S('b4.3') - 0.1, 'impact', 0.12)
shot('footprints', S('b4.3') - 0.1, S('b4.5') - 0.1, 'flash', 0.3)
shot('real', S('b4.5') - 0.1, S('b4.6') - 0.1, 'flatten', 0.3)
shot('space', S('b4.6') - 0.1, S('b5.1') - 0.1, 'layer', 0.45)
shot('paper', S('b5.1') - 0.1, S('b5.3') - 0.1, 'flatten', 0.35)
shot('party', S('b5.3') - 0.1, S('b6a.1') - 0.15, 'dive', 0.5)
shot('branches', S('b6a.1') - 0.15, S('b6b.1') - 0.12, 'loop', 0.55)
shot('floor', S('b6b.1') - 0.12, S('b6b.3') - 0.1, 'diveout', 0.5)
shot('crown_fp', S('b6b.3') - 0.1, S('b6b.4') - 0.05, 'eye', 0.35)
shot('stand', S('b6b.4') - 0.05, E('b6b.4') + 0.55, 'detach', 0.3)
shot('door_fp', E('b6b.4') + 0.55, S('b7.2') - 0.1, 'flash', 0.35)
shot('kitchen_reveal', S('b7.2') - 0.1, S('b7.3') - 0.1, 'detach', 0.4)
shot('split', S('b7.3') - 0.1, S('b7.5') - 0.1, 'split', 0.45)
shot('kitchen_sees', S('b7.5') - 0.1, S('b7.7') - 0.12, 'rect', 0.35)
shot('cup_fp', S('b7.7') - 0.12, S('b8.1') - 0.1, 'eye', 0.4)
shot('kitchen_wide', S('b8.1') - 0.1, S('b8.3') - 0.1, 'detach', 0.45)
shot('neighbor', S('b8.3') - 0.1, S('b8.4') - 0.1, 'rect', 0.35)
shot('loop_closed', S('b8.4') - 0.1, S('b8.6') - 0.1, 'coat', 0.45)
shot('now_ring', S('b8.6') - 0.1, E('b8.7') + 0.25, 'flatten', 0.4)
shot('present', E('b8.7') + 0.25, BLACK_START, 'loop', 0.55)
shot('black', BLACK_START, END_CARD, 'cut')
shot('endcard', END_CARD, TOTAL, 'cut')

# act starts (Loop Ring pips)
acts = [0.0, S('b2.1') - 0.1, S('b3.1') - 0.1, S('b4.5') - 0.1, S('b6a.1') - 0.15, E('b6b.4') + 0.55, S('b8.6') - 0.1]

# ---------------- HUD ----------------
fails = [E('b2.1') - 0.05, E('b2.2') - 0.05, E('b2.4') - 0.05, E('b2.6') - 0.2]
race_a, race_b = S('b2.7') - 0.05, E('b2.7') + 0.1
hud = dict(
    teaser=round(S('b1.12') - 0.05, 3),
    wake=round(S('b2.1') - 0.1, 3),
    attempts=[[round(S('b2.1'), 3), 1], [round(S('b2.2'), 3), 2], [round(S('b2.3'), 3), 3], [round(S('b2.5'), 3), 4],
              [round(race_a, 3), 5], [round(race_b, 3), 214], [round(S('b6b.4') + 0.3, 3), 215]],
    race=[round(race_a, 3), round(race_b, 3)],
    fails=[round(f, 3) for f in fails],
    quiet=[round(E('b6b.4') + 0.55, 3), round(S('b8.4') + 0.2, 3)],
    loopClosed=round(S('b8.4') + 0.2, 3),
    off=round(BLACK_START, 3),
    acts=[round(a, 3) for a in acts],
)

# ---------------- sound cues ----------------
sfx = []


def cue(t, kind, **kw):
    sfx.append(dict(t=round(t, 3), kind=kind, **kw))


# transitions fingerprints
TRANS_SFX = {'dive': 'screen_dive', 'diveout': 'screen_dive', 'layer': 'layer_split', 'flatten': 'flatten', 'loop': 'loop_wipe',
             'eye': 'eye_match', 'detach': 'shoulder_detach', 'flash': 'flash_cut', 'rect': 'rect_cut', 'glitch': 'glitch',
             'impact': 'impact', 'split': 'layer_split', 'coat': 'loop_ping'}
for sh in shots[1:]:
    k = TRANS_SFX.get(sh['trans'])
    if k:
        cue(sh['start'], k)

hk = shots[0]
cue(0.15, 'breath_in')
cue(0.55, 'brass_click')
cue(1.6, 'crown_turn')
cue(1.45, 'phone_buzz', dur=1.1, pan=-0.35, dist=0.6)
cue(3.2, 'shoulder_detach')
cue(S('b1.3') - 0.1, 'ping_1k')
cue(S('b1.4') + 0.1, 'phone_buzz', dur=2.4, pan=0.25, dist=0.3)
cue(S('b1.5') + 0.9, 'phone_flip')
cue(S('b1.6') + 0.3, 'light_off')
cue(S('b1.8') + 0.2, 'ping_1k')
cue(S('b1.9') + 0.3, 'glitch')
cue(shots[3]['start'], 'machine_charge', dur=S('b1.11') - 0.85 - shots[3]['start'])
cue(S('b1.11') - 0.85, 'power_cut')
cue(S('b1.11'), 'hit_low', big=1)
cue(S('b1.11'), 'glitch')
cue(S('b1.12') - 0.05, 'reverse_swell')
cue(S('b1.12') + 0.3, 'ping_1k')
# act 2
cue(S('b2.1') - 0.1, 'sub_drop')
cue(S('b2.1') + 0.2, 'board_flip')
cue(S('b2.1') + 0.5, 'train_chime')
for f in fails:
    cue(f, 'thunk')
    cue(f + 0.03, 'coral_click')
cue(S('b2.2') + 0.25, 'zip_jam')
cue(S('b2.3') + 0.1, 'taxi', dur=E('b2.4') - S('b2.3') + 0.3)
cue(S('b2.5') + 0.05, 'phone_ring_short')
cue(E('b2.5') + 0.1, 'hangup_click', pan=0.4)
cue(race_a, 'shepard', dur=race_b - race_a + 0.2)
for k in range(14):
    tt = race_a + (race_b - race_a) * (1 - (1 - (k + 1) / 15) ** 1.6)
    cue(tt, 'thunk', short=1)
cue(race_b + 0.05, 'hit_low')
cue(S('b2.9'), 'loop_note', word_end=E('b2.9'))
cue(E('b2.9') + 0.05, 'hit_low')
# act 3
cue(S('b3.1') - 0.1, 'sub_drop')
cue(S('b3.1') + 0.4, 'chalk', dur=1.6)
cue(S('b3.2') + 0.2, 'projector', dur=E('b3.3') - S('b3.2'))
cue(S('b3.3') + 0.9, 'scissor_snip')
cue(S('b3.4') + 0.6, 'billiard_knock')
cue(S('b3.5') + 0.3, 'tunnel_hum', dur=E('b4.2') - S('b3.5'))
cue(S('b3.5') + 1.4, 'billiard_roll', dur=1.2)
cue(S('b3.7'), 'glitch')
cue(S('b3.7') + 0.05, 'hit_low')
cue(S('b3.7'), 'loop_note', word_end=E('b3.7'))
cue(S('b4.1') + 0.8, 'billiard_knock', soft=1)
cue(S('b4.1') + 1.6, 'billiard_knock')
cue(S('b4.2') + 0.6, 'ping_1k')
fp0 = S('b4.3') - 0.1
for k in range(7):
    cue(fp0 + 0.35 + k * 0.55, 'footprint_tap', k=k)
# act 4
cue(S('b4.5') - 0.1, 'sub_drop')
cue(E('b4.5') - 0.5, 'record_scratch')
cue(S('b4.6') + 0.2, 'sat_beep')
cue(S('b4.6') + 0.1, 'iss_hum', dur=E('b4.6') - S('b4.6') + 0.4)
cue(S('b4.6') + 2.8, 'number_slam')
cue(S('b5.1') + 0.3, 'whoosh_up')
cue(S('b5.2') + 0.5, 'stamp')
cue(S('b5.3') + 0.4, 'balloon_squeak')
cue(S('b5.4') + 0.2, 'paper_flutter', dur=1.6)
cue(S('b5.4') + 1.1, 'stamp')
cue(S('b5.5') - 0.35, 'dip')
cue(S('b5.5'), 'loop_note', word_end=E('b5.5'))
cue(S('b5.6') + 0.4, 'ping_1k')
cue(S('b5.7') - 0.3, 'dip')
cue(S('b5.7'), 'loop_note', word_end=E('b5.7'))
# act 5
cue(S('b6a.1') - 0.15, 'sub_drop')
cue(S('b6a.2') + 0.6, 'branch_split')
cue(S('b6b.2') - 0.3, 'dip')
cue(S('b6b.2'), 'loop_note', word_end=E('b6b.2'))
cue(S('b6b.3') + 0.2, 'tape_stop')
cue(S('b6b.4') + 0.25, 'crown_press')
cue(E('b6b.4') + 0.2, 'riser', dur=0.35)
# act 6
k0 = E('b6b.4') + 0.55
cue(k0 + 0.05, 'footsteps', surface='stairs', n=4, rate=0.42)
cue(S('b7.1') + 0.9, 'door_knob')
cue(S('b7.1') + 1.3, 'door_open')
cue(S('b7.2') + 0.1, 'kettle_click')
cue(S('b7.3') + 0.4, 'phone_ring_far', dur=E('b7.4') - S('b7.3') + 0.2)
cue(S('b7.5') + 0.3, 'ping_1k')
cue(S('b7.6') + 1.4, 'cup_slide')
cue(S('b7.7') + 0.3, 'chair')
cue(E('b7.7') + 0.1, 'silence', dur=1.15)
cue(E('b7.7'), 'loop_note', word_end=E('b7.7'), resolve=1)
cue(S('b8.3') + 0.2, 'window_creak')
cue(S('b8.4') + 1.2, 'cup_saucer')
cue(S('b8.4') + 0.2, 'loop_closed')
# act 7
cue(S('b8.6') - 0.1, 'shimmer')
cue(S('b8.8') + 0.2, 'phone_buzz', dur=0.9, pan=-0.2, dist=0.2)
cue(S('b8.9') - 0.25, 'phone_ring', dur=0.7)
cue(E('b8.9') + 0.35, 'pickup_click')
cue(E('b8.9'), 'loop_note', word_end=E('b8.9'), resolve=1)
cue(END_CARD + 0.15, 'endcard_ding')

# location beds (ambience regions)
BED = {
    'ws_hook': 'workshop', 'mem_call': 'memory', 'mem_funeral': 'rain', 'ws_charge': 'workshop', 'useless': None, 'ring_promise': 'void',
    'station_cancel': 'station', 'zip_fp': 'station', 'taxi': 'city', 'call_panel': 'memory', 'race': 'station', 'rule_freeze': 'void',
    'novikov': 'room', 'film': 'room', 'billiard_a': 'hall', 'billiard_b': 'hall', 'footprints': 'void', 'real': 'void', 'space': 'space',
    'paper': 'room', 'party': 'party', 'branches': 'void', 'floor': 'workshop', 'crown_fp': 'workshop', 'stand': 'workshop',
    'door_fp': 'stairs', 'kitchen_reveal': 'kitchen', 'split': 'kitchen', 'kitchen_sees': 'kitchen', 'cup_fp': 'kitchen',
    'kitchen_wide': 'kitchen', 'neighbor': 'street', 'loop_closed': 'kitchen', 'now_ring': 'void', 'present': 'workshop', 'black': None, 'endcard': None,
}
beds = [dict(kind=BED[s['id']], start=s['start'], end=s['end']) for s in shots if BED.get(s['id'])]

# music and intensity sections
music = [
    dict(kind='motif_cold', start=0.4, end=S('b1.11') - 0.85),
    dict(kind='motif_drive', start=S('b2.1') - 0.1, end=S('b2.9') + 0.3),
    dict(kind='arp', start=S('b2.1') - 0.1, end=S('b2.8')),
    dict(kind='motif_shimmer', start=S('b3.1') - 0.1, end=S('b5.7') + 0.6),
    dict(kind='heavy', start=S('b6a.1') - 0.15, end=E('b6b.4') + 0.55),
    dict(kind='kitchen_piano', start=S('b7.2') - 0.1, end=E('b7.7') + 0.05),
    dict(kind='kitchen_resolve', start=E('b7.7') + 1.25, end=S('b8.6') - 0.1),
    dict(kind='strings', start=S('b7.1'), end=BLACK_START),
    dict(kind='turn', start=S('b8.6') - 0.1, end=BLACK_START),
]
pulse = [[0.0, 60], [S('b2.1'), 84], [S('b2.7'), 96], [S('b2.8'), 70], [S('b3.1'), 0], [S('b6a.1'), 52], [E('b6b.4') + 0.5, 0],
         [E('b7.7') + 1.3, 52], [S('b8.6'), 0]]
ticks = [[0.3, S('b1.11') - 0.85, 'steady'], [S('b2.1'), S('b2.8') - 0.2, 'glitchy'], [S('b6a.1'), S('b6b.4'), 'slow'],
         [E('b8.7') + 0.25, S('b8.9') - 0.3, 'steady']]
silences = [[S('b1.11') - 0.85, S('b1.11') - 0.02], [E('b7.7') + 0.08, E('b7.7') + 1.2], [BLACK_START + 0.05, END_CARD]]

tl = dict(fps=FPS, duration=round(TOTAL, 3), frames=int(round(TOTAL * FPS)), narrationDuration=L['duration'],
          lines=L['lines'], captions=captions, youngCaption=youngcap, shots=shots, hud=hud, sfx=sorted(sfx, key=lambda c: c['t']),
          beds=beds, music=music, pulse=pulse, ticks=ticks, silences=silences)
json.dump(tl, open(os.path.join(HERE, 'src', 'timeline.json'), 'w'), indent=1)
print('total', round(TOTAL, 2), 's', tl['frames'], 'frames;', len(captions), 'captions;', len(shots), 'shots;', len(sfx), 'cues')
lens = [c['end'] - c['start'] for c in captions]
print('caption avg', round(sum(lens) / len(lens), 2), 'max', round(max(lens), 2), 'min', round(min(lens), 2))
for s in shots:
    print(f"{s['id']:15s} {s['start']:7.2f} {s['end'] - s['start']:5.2f} {s['trans']}")
