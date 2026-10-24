"""Generate retakes for one beat with distinct tags; keep each as <id>_<tag>.wav for the gate."""
import json, sys, shutil
from gemini_tts import synth, VOICE, MODEL
bid = sys.argv[1]; tags = sys.argv[2:]
S = {b['id']: b for b in json.load(open('script.json'))['beats']}
text = ' '.join(S[bid]['lines'])
for tag in tags:
    p, fresh = synth(text, VOICE, MODEL, tag=tag, min_gap=12)
    print(bid, tag, p, 'new' if fresh else 'cached', flush=True)
