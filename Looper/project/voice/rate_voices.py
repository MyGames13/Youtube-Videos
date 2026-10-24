import base64, json, urllib.request, sys
from gemini_tts import _keys, API
files = json.load(open('audition.json'))['files']
parts = []
for name, p in files.items():
    parts.append({"text": f"Voice {name}:"})
    parts.append({"inlineData": {"mimeType": "audio/wav", "data": base64.b64encode(open(p,'rb').read()).decode()}})
parts.append({"text": ("You are a demanding audio director casting a narrator for a late night, intimate, warm "
  "YouTube storytelling video about time travel and a grandmother. Ignore the words themselves (each clip reads some stage directions). "
  "Judge only the voice and delivery. For each voice give scores 1 to 10 for: human naturalness (no robotic or synthetic artifacts), "
  "warmth and intimacy, clarity, emotional range without overacting, and any glitches heard (timestamps). Then name the single best "
  "voice for this job and why, in one sentence. Answer as compact JSON.")})
body = {"contents": [{"parts": parts}], "generationConfig": {"temperature": 0.2}}
import time
k = _keys()[0]
MODEL=sys.argv[1] if len(sys.argv)>1 else "gemini-3.8-flash"
for attempt in range(5):
  try:
    req = urllib.request.Request(f"{API}/models/{MODEL}:generateContent", data=json.dumps(body).encode(), method="POST")
    req.add_header("x-goog-api-key", k); req.add_header("Content-Type", "application/json")
    d = json.loads(urllib.request.urlopen(req, timeout=300).read()); break
  except Exception as e:
    print("retry", e, file=sys.stderr); time.sleep(20*(attempt+1)); MODEL = "gemini-2.5-flash" if attempt>=1 else MODEL
print("".join(p.get("text","") for p in d["candidates"][0]["content"]["parts"]))
