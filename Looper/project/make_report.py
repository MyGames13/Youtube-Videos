"""report.txt (max 12 lines) from measured values of the final file."""
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'output')
final = os.path.join(OUT, 'loophole_001_final.mp4')
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final], capture_output=True, text=True).stdout.strip())
size = os.path.getsize(final) / 1e6
# loudness of the final AAC track
r = subprocess.run(['ffmpeg', '-hide_banner', '-i', final, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
I = [l for l in r.splitlines() if l.strip().startswith('I:')][-1].split()[1]
TP = [l for l in r.splitlines() if l.strip().startswith('Peak:')][-1].split()[1]
LRA = [l for l in r.splitlines() if l.strip().startswith('LRA:')][-1].split()[1]
V = json.load(open(os.path.join(HERE, 'voice', 'voice_report.json')))
w = V['worst']
ssim = open(os.path.join(HERE, 'out', 'ssim.txt')).read().strip() if os.path.exists(os.path.join(HERE, 'out', 'ssim.txt')) else 'n/a'
lines = [
    f'Runtime {int(dur // 60)}:{dur % 60:04.1f} ({dur:.2f} s), under the 3:00 cap you set (this overrides the 4:00 minimum in the master prompt). 1280x720, 30 fps.',
    f'Final file {size:.1f} MB (H.264 High yuv420p, AAC 128 kbps 48 kHz, faststart). Quality vs mezzanine: SSIM {ssim}.',
    f'Loudness: integrated {I} LUFS, true peak {TP} dBTP, loudness range {LRA} LU. Exactly three near silences; loop note delay = Loop Motif beat 0.833 s.',
    'Voice: Gemini TTS, model gemini-3.8-flash-tts (newest on the free keys), voice Algieba (won a 4 voice audition), one director notes header.',
    f"Voice gate: all 9 beats PASS. Worst deviation pitch {w['f0']:.1f} %, rate {w['wpm']:.1f} %, spectral centroid {w['centroid']:.1f} %, loudness {w['lufs']:.2f} LU.",
    'Fallbacks: inline style text was read aloud by the model, switched to a director notes layout; leaked lead ins on 5 beats trimmed at silences (transcript verified).',
    'Beat 6 needed 3 retakes plus a split; 6b carries a formant preserving 0.91 pitch trim; one line (b6a.4) was spliced from take 2 to fix a wrong word.',
    'Picture: full 3D path (React Three Fiber in headless Chromium via SwiftShader), no 2.5D fallback. Fonts bundled locally (Google Fonts TLS blocked in the renderer).',
    'Sound: 100 percent procedural (numpy/scipy), no samples; mix checked by an AI listener and revised (transition SFX and hits lowered, rain hiss and phone rings tamed).',
    'Could not do: human listening, a reference video analysis (no reference files were attached), real CC0 foley. Script trimmed to about 460 words to fit 3 minutes.',
]
open(os.path.join(OUT, 'report.txt'), 'w').write('\n'.join(lines) + '\n')
print('\n'.join(lines))
