"""README for the project folder, with the voice consistency table."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(os.path.join(HERE, 'voice', 'voice_report.json')))
rows = '\n'.join(f"| {b['beat']} | {b['f0']} | {b['d_f0']} | {b['wpm']} | {b['d_wpm']} | {b['centroid']} | {b['d_centroid']} | {b['lufs']} | {'PASS' if b['pass'] else 'FAIL'} |" for b in R['beats'])
txt = f"""# Loophole 001: Time Travel Is Useless... And Physics Explains Why

Remotion 4 + React Three Fiber project. One `src/timeline.json` drives picture and sound.

## Render

```bash
npm install
# 1. voice (needs GEMINI_API_KEY in the environment; never written to disk)
cd voice && python3 gen_beats.py && python3 process_voice.py && cd ..
# 2. timeline, docs and sound
python3 director.py && python3 build_audio.py && python3 make_docs.py
# 3. picture (headless WebGL via SwiftShader) then final encode
./render_segments.sh && ./encode.sh
```

`render_segments.sh` renders in four logged segments and joins them losslessly. Single pass alternative:
`npx remotion render src/index.ts Loophole001 out/picture.mp4 --gl=swangle --concurrency=4 --crf=12`.
Thumbnails: `npx remotion still src/index.ts ThumbA ../output/thumbnail_a.png --gl=swangle` (and ThumbB).

Keys: `voice/gemini_tts.py` reads `GEMINI_API_KEYS` (comma separated, rotated) or `GEMINI_API_KEY` from the environment only.
Cached clips live in `voice/cache` keyed by a hash of model, voice, style and text, so re runs spend no quota.

## Voice lock

Model `gemini-3.8-flash-tts`, voice `Algieba` (chosen by audition), one identical director's notes header on every request,
one processing chain (80 Hz high pass, de ess, 3:1 compression, warmth, proximity shelf, spectral match to the median beat, max 3 dB per band),
then a uniform 4.5 percent pitch preserving tempo lift. Beat 6b used a formant preserving pitch trim (0.91) after three retakes ran high.

### Consistency gate (section 7.4)

Median: pitch {R['median']['f0']:.1f} Hz, rate {R['median']['wpm']:.1f} wpm, centroid {R['median']['centroid']:.0f} Hz.
Worst case: pitch {R['worst']['f0']:.1f} %, rate {R['worst']['wpm']:.1f} %, centroid {R['worst']['centroid']:.1f} %, loudness {R['worst']['lufs']:.2f} LU.

| beat | pitch Hz | d % | wpm | d % | centroid Hz | d % | LUFS | gate |
|---|---|---|---|---|---|---|---|---|
{rows}

## Structure

- `director.py`: captions, shots, HUD, cue sheet from measured voice timings
- `src/Main.tsx`: shot switching and the transition library (dive, dive out, layer split, flatten, loop wipe, eye match, shoulder detach, flash, impact, glitch, split, coat push)
- `src/lib/rig.ts`: the one stickman rig (two bone IK, grip sockets, pose library) shared by `three/Stickman3D.tsx` and `two/Stick2D.tsx`
- `src/scenes/*`: workshop, station, billiards, footprints, space, party, kitchen and street
- `build_audio.py`: every sound is synthesised (no samples): beds, foley, Loop Motif, loop note echoes, ducking, master to -14 LUFS
"""
open(os.path.join(HERE, 'README.md'), 'w').write(txt)
print('README written')
