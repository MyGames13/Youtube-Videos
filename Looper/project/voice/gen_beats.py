"""Generate narration beats (cached). Usage: gen_beats.py [beat ids...]"""
import json, sys
from gemini_tts import synth, VOICE, MODEL
S = json.load(open('script.json'))
want = set(sys.argv[1:])
res = {}
for b in S['beats']:
    if want and b['id'] not in want: continue
    text = ' '.join(b['lines'])
    tag = b.get('take', '')
    p, fresh = synth(text, VOICE, MODEL, tag=tag, min_gap=12)
    res[b['id']] = p
    print(b['id'], p, 'new' if fresh else 'cached', flush=True)
try:
    old = json.load(open('beats.json'))
except Exception:
    old = {}
old.update(res)
json.dump(old, open('beats.json', 'w'), indent=1)
