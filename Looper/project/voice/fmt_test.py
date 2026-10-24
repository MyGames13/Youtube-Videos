import json, base64, urllib.request, os, time, sys
from gemini_tts import _keys, write_wav, API
keys=_keys()
TEXT="Tonight, the time machine works. The taxi driver knows a shortcut. He does not know a shortcut. And you sit."
STYLE_SHORT=("A warm, quiet, late night storyteller, close to the microphone, like a thoughtful friend "
 "telling you something astonishing. Natural and human, a small smile on dry jokes, gentle in sad parts, "
 "steady easy pace, soft downward endings.")
variants={
 "sys": {"systemInstruction":{"parts":[{"text":"You are a voice actor. Speak the user's text exactly, nothing else. Delivery: "+STYLE_SHORT}]},
         "contents":[{"role":"user","parts":[{"text":TEXT}]}]},
 "notes": {"contents":[{"parts":[{"text":"### DIRECTOR'S NOTES\n"+STYLE_SHORT+"\n\n### TRANSCRIPT\n"+TEXT}]}]},
}
voice=sys.argv[1]
for i,(name,body) in enumerate(variants.items()):
    body["generationConfig"]={"responseModalities":["AUDIO"],"temperature":1.0,
        "speechConfig":{"voiceConfig":{"prebuiltVoiceConfig":{"voiceName":voice}}}}
    req=urllib.request.Request(f"{API}/models/gemini-3.8-flash-tts:generateContent",data=json.dumps(body).encode(),method="POST")
    req.add_header("x-goog-api-key",keys[i%len(keys)]); req.add_header("Content-Type","application/json")
    try:
        d=json.loads(urllib.request.urlopen(req,timeout=120).read())
        pcm=b"".join(base64.b64decode(p["inlineData"]["data"]) for p in d["candidates"][0]["content"]["parts"] if "inlineData" in p)
        write_wav(f"cache/fmt_{name}_{voice}.wav",pcm); print(name,"ok",len(pcm)/48000,"s")
    except urllib.error.HTTPError as e: print(name,"HTTP",e.code,e.read().decode()[:300])
