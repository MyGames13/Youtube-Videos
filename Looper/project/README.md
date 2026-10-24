# Loophole 001: Time Travel Is Useless... And Physics Explains Why

Remotion 4 + React Three Fiber project. One `src/timeline.json` drives picture and sound.

## Render

```bash
npm install
# 1. voice (needs GEMINI_API_KEY in the environment; never written to disk)
cd voice && python3 gen_beats.py && python3 process_voice.py && python3 patch_line.py && cd ..
# 2. timeline, docs and sound
python3 director.py && python3 build_audio.py && python3 make_docs.py
# 3. picture (headless WebGL via SwiftShader) then final encode
./render_segments.sh && ./render_fix.sh && ./encode.sh
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
Line b6a.4 was spliced from take 2 of beat 6 (`voice/patch_line.py`) because the b6a take said "your grandma" instead of "a grandma";
the splice keeps the narration tempo and sits on the existing caption times, so no timing changed. Every beat was transcript checked by a Gemini listener.

### Consistency gate (section 7.4)

Median: pitch 89.4 Hz, rate 165.3 wpm, centroid 1603 Hz.
Worst case: pitch 9.6 %, rate 12.9 %, centroid 15.0 %, loudness 0.42 LU.

| beat | pitch Hz | d % | wpm | d % | centroid Hz | d % | LUFS | gate |
|---|---|---|---|---|---|---|---|---|
| b1 | 88.9 | 0.6 | 168.5 | 1.9 | 1537 | 4.1 | -20.05 | PASS |
| b2 | 89.4 | 0.0 | 159.8 | 3.3 | 1605 | 0.1 | -19.91 | PASS |
| b3 | 89.4 | 0.0 | 186.2 | 12.6 | 1784 | 11.3 | -20.09 | PASS |
| b4 | 92.5 | 3.5 | 186.6 | 12.9 | 1603 | 0.0 | -20.24 | PASS |
| b5 | 90.4 | 1.1 | 151.2 | 8.5 | 1646 | 2.7 | -20.07 | PASS |
| b6a | 87.3 | 2.3 | 165.3 | 0.0 | 1404 | 12.4 | -20.51 | PASS |
| b6b | 98.0 | 9.6 | 155.6 | 5.9 | 1363 | 15.0 | -20.11 | PASS |
| b7 | 87.1 | 2.6 | 152.0 | 8.0 | 1579 | 1.5 | -20.06 | PASS |
| b8 | 87.8 | 1.8 | 173.8 | 5.1 | 1717 | 7.1 | -20.13 | PASS |

## Structure

- `director.py`: captions, shots, HUD, cue sheet from measured voice timings
- `src/Main.tsx`: shot switching and the transition library (dive, dive out, layer split, flatten, loop wipe, eye match, shoulder detach, flash, impact, glitch, split, coat push)
- `src/lib/rig.ts`: the one stickman rig (two bone IK, grip sockets, pose library) shared by `three/Stickman3D.tsx` and `two/Stick2D.tsx`
- `src/scenes/*`: workshop, station, billiards, footprints, space, party, kitchen and street
- `build_audio.py`: every sound is synthesised (no samples): beds, foley, Loop Motif, loop note echoes, ducking, master to -14 LUFS
