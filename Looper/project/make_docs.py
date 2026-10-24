"""Writes captions.srt, script_final.md and metadata.txt from src/timeline.json."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'output')
TL = json.load(open(os.path.join(HERE, 'src', 'timeline.json')))


def ts(t, srt=True):
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    if srt:
        return f'{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)) % 1000:03d}'
    return f'{m}:{int(s):02d}'


# captions.srt: narrator captions plus the younger self line
caps = [(c['start'], c['end'], c['text']) for c in TL['captions']]
y = TL['youngCaption']
caps.append((y['start'], y['end'], y['text']))
caps.sort()
with open(os.path.join(OUT, 'captions.srt'), 'w') as f:
    for i, (a, b, text) in enumerate(caps, 1):
        f.write(f'{i}\n{ts(a)} --> {ts(b)}\n{text}\n\n')

ACT_NAMES = ['The Call', 'The Attempts', 'The Rule', 'The Math Is Real', 'The Last Hope', 'The Kitchen', 'The Turn']
acts = TL['hud']['acts']

# script_final.md
lines = TL['lines']
with open(os.path.join(OUT, 'script_final.md'), 'w') as f:
    f.write('# LOOPHOLE, Video 001: Time Travel Is Useless... And Physics Explains Why\n\n')
    f.write(f"Runtime {ts(TL['duration'], False)} ({TL['duration']:.1f} s). Narration {sum(len(l['text'].split()) for l in lines)} words. ")
    f.write('Narrator: Gemini TTS (gemini-3.8-flash-tts), voice Algieba, one locked style header.\n\n')
    f.write('N = narrator. S = the younger self, shown as a coral caption only (never voiced).\n\n')
    ai = 0
    for l in lines:
        while ai < len(acts) and l['start'] >= acts[ai] - 0.2:
            f.write(f"\n## Act {ai + 1}: {ACT_NAMES[ai]} ({ts(acts[ai], False)})\n\n")
            ai += 1
        f.write(f"- `{ts(l['start'], False)}.{int((l['start'] % 1) * 10)}` N: {l['text']}\n")
        if l['id'] == 'b2.5':
            f.write(f"- `{ts(y['start'], False)}.{int((y['start'] % 1) * 10)}` S: (Who is this? Is this a prank?)\n")
    f.write('\n## Shot list\n\n| # | shot | start | length | transition in |\n|---|---|---|---|---|\n')
    for i, s in enumerate(TL['shots'], 1):
        f.write(f"| {i} | {s['id']} | {s['start']:.2f} | {s['end'] - s['start']:.2f} | {s['trans']} |\n")

# metadata.txt
chap = '\n'.join(f'{ts(a, False)} {n}' for a, n in zip(acts, ACT_NAMES))
meta = f"""TITLE
Time Travel Is Useless... And Physics Explains Why

DESCRIPTION
Tonight, the machine works. And it cannot change a single second.
One trip back, one phone call you never answered, and the strange physics rule that says the past cannot be edited, only visited.

A short physics story for everyone, no maths needed: the Novikov self consistency principle, closed timelike curves, the grandfather paradox and why physics may forbid it, the billiard ball paradox, wormholes and exotic matter, Godel's rotating universe, Stephen Hawking's chronology protection idea and his party for time travellers, real time dilation (cosmonaut Sergei Krikalev and GPS satellite clocks), free will inside a time loop, and David Deutsch's branching timelines.

Loophole, Video 001.

CHAPTERS
{chap}

ABOUT @LoopholeVideos
Loophole tells mind bending ideas from physics as small human stories. Late night, warm, simple words, no jargon, and always one twist you did not see coming. New timeline logs regularly.

FICTION AND FACTS
The story of the traveller and the grandmother is fiction. The physics ideas are real but speculative: no time machine exists, travel into the past has never been shown to be possible, and the Novikov self consistency principle is a proposal, not a proven law. Facts and sources are listed below.

SOURCES
Novikov self consistency principle: https://en.wikipedia.org/wiki/Novikov_self-consistency_principle
Echeverria, Klinkhammer and Thorne, Billiard balls in wormhole spacetimes with closed timelike curves, Phys. Rev. D 44, 1077 (1991): https://doi.org/10.1103/PhysRevD.44.1077
Morris, Thorne and Yurtsever, Wormholes, Time Machines, and the Weak Energy Condition, Phys. Rev. Lett. 61, 1446 (1988): https://doi.org/10.1103/PhysRevLett.61.1446
Godel, An Example of a New Type of Cosmological Solutions of Einstein's Field Equations of Gravitation, Rev. Mod. Phys. 21, 447 (1949): https://doi.org/10.1103/RevModPhys.21.447
Hawking, Chronology protection conjecture, Phys. Rev. D 46, 603 (1992): https://doi.org/10.1103/PhysRevD.46.603
Hawking's time traveller party: https://en.wikipedia.org/wiki/Hawking%27s_time_traveller_party
Sergei Krikalev and time dilation: https://www.guinnessworldrecords.com/world-records/79267-greatest-time-dilation
GPS and relativity (Ohio State, R. Pogge): https://www.astronomy.ohio-state.edu/pogge.1/Ast162/Unit5/gps
Deutsch, Quantum mechanics near closed timelike lines, Phys. Rev. D 44, 3197 (1991): https://doi.org/10.1103/PhysRevD.44.3197

If someone came to mind during this video, it is worth calling them.

#timetravel #physics #mindblowing

TAGS (15)
time travel is useless, time travel explained, novikov self consistency principle, closed timelike curves, grandfather paradox explained, time travel paradox, time loop, bootstrap paradox, hawking time travel party, wormhole time travel, godel universe, gps relativity, free will and time travel, physics storytelling, mind blowing physics

PINNED COMMENT
Be honest: whose call would you pick up tonight, if you knew it was the last one?
"""
open(os.path.join(OUT, 'metadata.txt'), 'w').write(meta)
print('docs written; captions', len(caps), 'chapters:', chap.replace('\n', ' | '))
