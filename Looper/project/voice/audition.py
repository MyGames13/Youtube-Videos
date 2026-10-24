import sys, json
from gemini_tts import synth, pick_model
TEXT = ("Tonight, the time machine works. You get one trip. And you know exactly where. "
        "The taxi driver knows a shortcut. He does not know a shortcut. "
        "She doesn't ask who you are. She just slides a cup over. And you sit.")
model = pick_model()
print("model", model, flush=True)
out = {}
for v in sys.argv[1:]:
    p, fresh = synth(TEXT, v, model, tag="audition", min_gap=8)
    out[v] = p
    print(v, p, "new" if fresh else "cached", flush=True)
json.dump({"model": model, "files": out}, open("audition.json", "w"), indent=1)
