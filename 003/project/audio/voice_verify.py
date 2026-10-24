"""Transcribe each chosen beat with a Gemini speech model and diff it against
the script (catches skipped, repeated or misread words). Key from env only."""
import base64, difflib, json, os, re, sys, time, urllib.request, urllib.error
import gemini_tts as g
import align

HERE = os.path.dirname(os.path.abspath(__file__))


def transcribe(path, model="gemini-3.5-transcribe"):
    pool = g.pool()
    data = base64.b64encode(open(path, "rb").read()).decode()
    body = {"contents": [{"parts": [{"inlineData": {"mimeType": "audio/wav", "data": data}}]}]}
    for attempt in range(12):
        j = pool.pick(model)
        req = urllib.request.Request(f"{g.API}/{model}:generateContent", data=json.dumps(body).encode(),
                                     headers={"x-goog-api-key": pool.keys[j], "Content-Type": "application/json"})
        try:
            r = json.load(urllib.request.urlopen(req, timeout=300))
            parts = r["candidates"][0]["content"]["parts"]
            return " ".join(p.get("audioTranscription", {}).get("text", "") or p.get("text", "") for p in parts)
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")
            if e.code == 429 and "PerDay" in msg:
                pool.dead.add((j, model))
            time.sleep(5)
    raise RuntimeError("transcription failed")


def main():
    gate = json.load(open(os.path.join(HERE, "gate.json")))
    beats = {b["id"]: b for b in json.load(open(os.path.join(HERE, "script.json")))}
    report = []
    for r in gate["chosen"]:
        txt = transcribe(os.path.join(HERE, r["path"]))
        want = align.norm_words(g.CALIBRATION + " " + beats[r["beat"]]["text"])
        got = align.norm_words(txt.replace("41", "forty one").replace("412", "four hundred and twelve"))
        sm = difflib.SequenceMatcher(a=want, b=got)
        diffs = [(op, " ".join(want[a1:a2]), " ".join(got[b1:b2])) for op, a1, a2, b1, b2 in sm.get_opcodes() if op != "equal"]
        report.append({"beat": r["beat"], "take": r["take"], "ratio": round(sm.ratio(), 3), "diffs": diffs})
        print(r["beat"], r["take"], round(sm.ratio(), 3), diffs, flush=True)
    json.dump(report, open(os.path.join(HERE, "verify.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
