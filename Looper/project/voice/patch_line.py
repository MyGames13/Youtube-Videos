"""Replace line b6a.4 ("You could save a grandma. Just not yours.") in the assembled narration
with the take that says the words correctly (the b6a take said "your grandma").
The replacement goes through the same processing chain, is level and spectrum matched to the
original segment, and is stretched to exactly the same length, so no timing in the video changes."""
import json, os, shutil
import numpy as np, soundfile as sf, librosa, pyloudnorm as pyln
from process_voice import chain, band_levels, match_eq, speech_runs, align_lines, SR

HERE = os.path.dirname(os.path.abspath(__file__))
L = {l['id']: l for l in json.load(open(os.path.join(HERE, 'lines.json')))['lines']}
narr_p = os.path.join(HERE, 'narration_48k.wav')
if not os.path.exists(narr_p + '.orig'):
    shutil.copy(narr_p, narr_p + '.orig')
narr, sr = sf.read(narr_p + '.orig')
line = L['b6a.4']
a = int((line['start'] - 0.03) * SR)
b = int((line['end'] + 0.06) * SR)
orig = narr[a:b].copy()
target = (b - a) / SR

# source: take 2 of beat 6, line 4
y, sr0 = sf.read(os.path.join(HERE, 'cache', 'b6_take2_keep.wav'))
lines = ["There's one way out.", "Physicist David Deutsch said the universe might split.", "Change the past, and you make a new timeline.",
         "You could save a grandma. Just not yours.", "You don't want a grandma.", "You want her.", "So you stop trying to fix it.",
         "Attempt two hundred and fifteen. You just go."]
y = librosa.resample(y, orig_sr=sr0, target_sr=SR, res_type='soxr_hq')
runs = speech_runs(y, SR)
bounds = align_lines(runs, lines)
s0, s1 = bounds[3]
seg = y[int((s0 - 0.03) * SR):int((s1 + 0.06) * SR)]
seg = chain(seg, SR)
# keep the narration tempo (1.045) and place each sentence where its caption already starts
TL = json.load(open(os.path.join(HERE, '..', 'src', 'timeline.json')))
caps = [c for c in TL['captions'] if c['line'] == 'b6a.4']
inner = speech_runs(seg, SR)
gaps = [(inner[k][1], inner[k + 1][0]) for k in range(len(inner) - 1)]
g = max(gaps, key=lambda x: x[1] - x[0])  # the sentence break
s1 = seg[: int((g[0] + 0.04) * SR)]
s2 = seg[int((g[1] - 0.04) * SR):]
def tempo(x, r):
    tmp_in, tmp_out = '/tmp/_patch_in.wav', '/tmp/_patch_out.wav'
    sf.write(tmp_in, x, SR, subtype='FLOAT')
    os.system(f'ffmpeg -y -loglevel error -i {tmp_in} -af "rubberband=tempo={r:.6f}:pitchq=quality" -ar {SR} -c:a pcm_f32le {tmp_out}')
    return sf.read(tmp_out)[0]
s1 = tempo(s1, 1.045)
s2 = tempo(s2, 1.045)
n = b - a
new = np.zeros(n)
o2 = int((caps[1]['start'] + 0.03 - 0.04 - (line['start'] - 0.03)) * SR) if len(caps) > 1 else len(s1) + int(0.3 * SR)
s1 = s1[: max(0, o2 - int(0.02 * SR))]
new[: len(s1)] = s1
new[o2:o2 + len(s2)] = s2[: max(0, n - o2)]
ratio = 1.045
# spectrum and level match to the original segment
new = match_eq(new, SR, band_levels(orig, SR), band_levels(new, SR))
m = pyln.Meter(SR)
new *= 10 ** ((m.integrated_loudness(orig) - m.integrated_loudness(new)) / 20)
f = int(0.015 * SR)
new[:f] *= np.linspace(0, 1, f)
new[-f:] *= np.linspace(1, 0, f)
out = narr.copy()
out[a:b] = new
sf.write(narr_p, out, SR, subtype='PCM_24')
sf.write('/tmp/b6a4_patched.wav', out[a - int(0.5 * SR):b + int(0.3 * SR)], SR)
print(f'patched {line["id"]}: {target:.3f} s, stretch ratio {ratio:.3f}, peak {np.abs(new).max():.3f}')
json.dump({'line': 'b6a.4', 'source': 'b6_take2_keep.wav line 4', 'stretch_ratio': round(ratio, 4), 'reason': 'b6a take said "your grandma"'}, open(os.path.join(HERE, 'line_patch.json'), 'w'), indent=1)
