import json, sys, time
from gemini_tts import listen
B=json.load(open('beats.json'))
want=sys.argv[1:] or sorted(B)
out={}
try: out=json.load(open('transcripts.json'))
except Exception: pass
for k in want:
    t=listen(B[k], "Transcribe this audio verbatim with approximate start timestamps in seconds for each sentence, as lines like '[12.3] sentence'. "
             "After the transcript, add a line starting with ISSUES: and list any mispronunciations, whispering, robotic artifacts, voice changes, "
             "odd intonation, repeated or extra words, or glitches with timestamps. Write ISSUES: NONE if clean.", 'gemini-3.8-flash')
    out[k]={'file':B[k],'text':t}
    print('=====',k); print(t, flush=True)
    json.dump(out,open('transcripts.json','w'),indent=1)
