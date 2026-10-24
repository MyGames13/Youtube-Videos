"""Write captions.srt, script_final.md and metadata.txt from the same timeline the
film is built from, so captions, chapters and the script match the final cut.

usage: python3 scripts/make_docs.py <outDir>
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "..")
TL = json.load(open(os.path.join(ROOT, "src", "timeline.json")))
EV = json.load(open(os.path.join(ROOT, "audio", "events.json")))
SHOT = {s["id"]: s for s in EV["shots"]}
LINES = TL["lines"]


def srt_time(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def mmss(t):
    t = int(t)
    return f"{t // 60}:{t % 60:02d}"


def wrap(text, width=42):
    if len(text) <= width:
        return text
    words = text.split(" ")
    best, cut = None, 0
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        # balanced lines, but a break after a full stop or comma reads far better
        score = max(len(a), len(b)) - (12 if a[-1] in ".?!" else 6 if a[-1] in ",:;" else 0)
        if best is None or score < best:
            best, cut = score, i
    return " ".join(words[:cut]) + "\n" + " ".join(words[cut:])


def captions():
    cues = []
    for i, l in enumerate(LINES):
        t0 = l["sound_start"]
        t1 = l["sound_end"] + 0.3
        if i + 1 < len(LINES):
            t1 = min(t1, LINES[i + 1]["sound_start"] - 0.05)
        cues.append((t0, max(t0 + 0.8, t1), l["text"]))
    out = []
    for n, (a, b, text) in enumerate(cues, 1):
        out.append(f"{n}\n{srt_time(a)} --> {srt_time(b)}\n{wrap(text)}\n")
    return "\n".join(out)


def shot_notes():
    src = open(os.path.join(ROOT, "src", "events.ts")).read()
    notes = {}
    for m in re.finditer(r"\{id: '(\w+)', at: [^}]*?mode: '(\w+)'(?:, note: '([^']*)')?\}", src):
        notes[m.group(1)] = (m.group(2), m.group(3) or "")
    return notes


SECTION_TITLES = {
    "hook": "HOOK",
    "thing1": "THING 1: IT WAS TAKEN FROM FAR AWAY",
    "thing2": "THING 2: IT WILL NOT STAY THE SAME",
    "thing3": "THING 3: YOU ARE NOT ALONE IN IT",
    "thing4": "THING 4: IT WILL BE WARM",
    "reveal": "THE REVEAL: WHEN IT WAS TAKEN",
    "escape": "THE ESCAPE: HOW TO KEEP IT",
    "turn": "THE TURN: MANAGEMENT HAS REVIEWED THAT ADVICE",
}


def script():
    notes = shot_notes()
    shots = EV["shots"]
    lines = ["# BUILDING NOTICE 003: If You Find A Photo Of Yourself You Never Took... KEEP IT", "",
             "Final script as cut. Timestamps are from the finished film. N = narrator. W = handwritten on the back of the",
             "photograph (never voiced, shown as an amber handwritten caption). [VIS] lines are the shots, with their 2D, 3D or",
             "hybrid mode and the transition into them.", ""]
    section = None
    si = 0
    for l in LINES:
        while si < len(shots) and shots[si]["start"] <= l["sound_start"] + 0.01:
            s = shots[si]
            mode, note = notes.get(s["id"], (s["mode"], ""))
            sec = l["section"]
            if sec != section:
                section = sec
                lines += ["", f"## {SECTION_TITLES[sec]}", ""]
            tr = "" if s["trans"] == "cut" else f", {s['trans']}"
            lines.append(f"[VIS {mmss(s['start'])} {mode.upper()}{tr}] {note}")
            si += 1
        if l["section"] != section:
            section = l["section"]
            lines += ["", f"## {SECTION_TITLES[section]}", ""]
        sp = l.get("speaker", "N")
        lines.append(f"{mmss(l['sound_start'])}  {sp}: {l['text']}")
    while si < len(shots):
        s = shots[si]
        mode, note = notes.get(s["id"], (s["mode"], ""))
        lines.append(f"[VIS {mmss(s['start'])} {mode.upper()}] {note}")
        si += 1
    return "\n".join(lines) + "\n"


def metadata():
    ch = [
        (0, "The photograph"),
        (SHOT["T1_title"]["start"], "One: it was taken from far away"),
        (SHOT["T2_title"]["start"], "Two: it will not stay the same"),
        (SHOT["T3_title"]["start"], "Three: you are not alone in it"),
        (SHOT["T4_title"]["start"], "Four: it will be warm"),
        (SHOT["R1_dark"]["start"], "When it was taken"),
        (SHOT["E1_pin"]["start"], "How to keep it"),
        (SHOT["O1_revision"]["start"], "Management has reviewed that advice"),
    ]
    chapters = "\n".join(f"{mmss(t)} {name}" for t, name in ch)
    tags = ["creepy photo", "photo of yourself you never took", "keep it", "found photo horror", "mysterious photograph",
            "deadpan horror", "building notice", "management regrets", "scary stories", "things you should never do",
            "survival guide horror", "creepy stories", "psychological horror", "photo from the future", "time horror"]
    return f"""TITLE
If You Find A Photo Of Yourself You Never Took... KEEP IT

DESCRIPTION
Do not throw it away. Do not show it to anyone.
And do not try to remember when it happened.

Building Notice 003 is a calm, deadpan briefing for anyone who has found a photo of themselves they never posed for: a candid photograph of you, laughing, taken by someone you never noticed. Management walks you through the four things that happen to a found photo like this one: it was taken from far away, it will not stay the same, you are not alone in it, and it is warm. The photographer gets closer every time you look. There is handwriting on the back. The laugh gets a little wider. And there is only one rule that matters: do not ask who took it. Ask when. A creepy photo story told completely straight, with a twist about time, and one instruction you will want to follow. Keep it.

Building Notice 003. Issued by Management.

CHAPTERS
{chapters}

ABOUT
@ManagementRegrets issues building notices for situations that should not exist. Every notice is read calmly, in order, by Management. Notices arrive when they arrive. Management regrets the misunderstanding.

This is a work of fiction. Candid photos often feel more like us than posed ones; that part is true. The rest is ours.

If the photograph in this video landed, it is worth telling someone about a good day you are looking forward to.

#photo #creepy #horror

TAGS
{", ".join(tags)}

PINNED COMMENT
Be honest: what is the best day you did not see coming?
"""


def main():
    os.makedirs(OUT, exist_ok=True)
    open(os.path.join(OUT, "captions.srt"), "w").write(captions())
    open(os.path.join(OUT, "script_final.md"), "w").write(script())
    open(os.path.join(OUT, "metadata.txt"), "w").write(metadata())
    for f in ["captions.srt", "script_final.md", "metadata.txt"]:
        txt = open(os.path.join(OUT, f)).read()
        assert chr(0x2014) not in txt and chr(0x2013) not in txt, f"dash in {f}"
        print(f, len(txt), "chars")


if __name__ == "__main__":
    main()
