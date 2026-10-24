# Building Notice 003: If You Find A Photo Of Yourself You Never Took... KEEP IT

Management Regrets. A Remotion + react three fiber project where one camera and one
world slide between a flat vector look (mode 0) and full 3D (mode 1), and a procedural
sound build that reads the same timeline as the picture.

## Layout

```
src/
  events.ts          shot list, mode switches, glitch/flicker/flash events (anchored to voice words)
  timeline.json      voice lines, word times, meter keys, silences (written by audio/timeline.py)
  Notice003.tsx      the director: shot for the current time, Stage, HUD, captions
  shots/             one file per act: hook, thing1..thing4, reveal, escape, turn
  world/             unified camera (mode.ts), stickman rig and props, hallway, photo world,
                     street, rooms, ink materials with constant width outlines
  post/PostFX.tsx    HDR scene target, bloom, FXAA, grade, grain, glitch
  overlay/           HUD (seven segment meter, pips), captions, kinetic type
  Thumbnail.tsx      the thumbnail still
audio/
  script_source.py   the script, beats and lines
  gemini_tts.py      Gemini TTS client (key from the GEMINI_API_KEY environment variable only)
  make_voice.py      generates the narrator beats (one model, one voice, one style header)
  voice_gate.py      consistency gate: f0, speaking rate, spectral centroid, creak vs the median
  voice_build.py     cuts lines, processes the voice chain
  timeline.py        lays lines on the timeline, writes timeline.json and voiceover_master.wav
  synth.py           every sound effect and instrument, procedural (numpy and scipy)
  mix.py             cue sheet from timeline.json and events.json, ducking, master to -14 LUFS
  dsp.py             true peak limiter, de-clicker
scripts/
  export-events.mjs  writes audio/events.json from src/events.ts
  render_final.sh    parallel, resumable chunk render of the 720p mezzanine
  encode_final.sh    final H.264 + AAC encode under 100 MB, SSIM check
  make_docs.py       captions.srt, script_final.md, metadata.txt from the timeline
```

## Build

```
npm install
# voice (only if regenerating; the key is read from the environment, never stored)
GEMINI_API_KEY=... python3 audio/make_voice.py
python3 audio/voice_gate.py && python3 audio/voice_build.py
python3 audio/timeline.py          # timeline.json + out/voiceover_master.wav
npm run events                     # audio/events.json from src/events.ts
python3 audio/mix.py               # audio/out/audio_mix.wav, -14 LUFS, true peak under -1 dBTP
npm run render                     # out/notice003_mezz.mp4 (1280x720, CRF 14)
scripts/encode_final.sh out/notice003_mezz.mp4 audio/out/audio_mix.wav ../notice003_final.mp4 20
npm run thumbnail && npm run docs
```

Rendering uses the headless Chromium at /opt/pw-browsers with `--gl=swangle` (ANGLE on
SwiftShader, the only GL path that creates a context in this container). Speed notes:
the costly parts in software GL were 4x MSAA targets and re-rendering the photograph
every frame. The project uses FXAA in the composite pass instead of MSAA, and caches
the photograph's render target until its content changes. Two worker processes render
chunks in parallel; a chunk can be re-rendered on its own by deleting its file.

## Voice

Model gemini-3.8-flash-tts, voice Iapetus, one structured style header and one
calibration line for every beat, seed 1003, temperature 0.7. Every beat was generated in
several takes and the gate picked the combination closest to the median, then each chosen
beat was transcribed and diffed against the script. The voice chain is identical for
every line (high pass, spectral match capped at 3 dB, warmth, de-ess, 3:1 compression,
-20 LUFS per line, look-ahead peak limiter, de-clicker between words).

| Beat | Take | f0 (Hz) | WPM | Centroid (Hz) | f0 dev | WPM dev | Centroid dev | Creak | Gate |
|---|---|---|---|---|---|---|---|---|---|
| B01 | 2 | 108.7 | 256 | 1378 | 4.3% | 12.1% | 3.5% | 17% | pass |
| B02 | 0 | 96.9 | 240 | 1134 | 7.1% | 4.9% | 14.8% | 16% | pass |
| B03 | 0 | 107.5 | 224 | 1399 | 3.1% | 1.9% | 5.1% | 5% | pass |
| B04 | 0 | 105.0 | 219 | 1472 | 0.7% | 4.0% | 10.6% | 32% | pass |
| B05 | 1 | 95.8 | 225 | 1523 | 8.1% | 1.6% | 14.4% | 38% | pass |
| B06 | 0 | 99.7 | 232 | 1343 | 4.4% | 1.6% | 0.9% | 16% | pass |
| B07 | 0 | 103.8 | 243 | 1301 | 0.4% | 6.1% | 2.3% | 22% | pass |
| B08 | 5 | 110.6 | 243 | 1242 | 6.1% | 6.4% | 6.7% | 11% | pass |
| B09 | 3 | 104.1 | 213 | 1320 | 0.1% | 6.7% | 0.9% | 32% | pass |
| B10 | 0 | 104.4 | 217 | 1320 | 0.1% | 5.0% | 0.9% | 34% | pass |
| median | | 104.2 | 229 | 1332 | | | | | |

Tolerances: f0 10%, WPM 15%, centroid 15%. All ten beats pass.

## Sound

Everything is procedural: a 38 and 40.5 Hz sub drone, room tone and fridge hum, a B and C
tension pad from Thing 2, a low pulse whose tempo tracks the photographer's distance
(54 to 80 bpm, gone at the reveal, back at 50 bpm in the escape), mechanical shutters,
the early click signature on eight key words (0.4 s early, shrinking to exactly on the
laugh), a sonic fingerprint per transition type, plucked string bass in the pauses, an
electric piano motif in A minor that returns in C major in the turn, a C G Am F piano and
string pad from "Frame it", three designed near silences, voice ducking 7.5 dB (80 ms
attack, 400 ms release), master at -14 LUFS integrated with true peak under -1 dBTP.
