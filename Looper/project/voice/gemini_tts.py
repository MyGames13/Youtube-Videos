"""Gemini TTS client for Loophole 001.

Keys are read ONLY from the environment: GEMINI_API_KEYS (comma separated, rotated)
or GEMINI_API_KEY. Keys are never printed, logged or written to disk.
Every successful clip is cached by hash(model + voice + style + text).
"""
import base64
import hashlib
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
import wave

API = "https://generativelanguage.googleapis.com/v1beta"
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
os.makedirs(CACHE, exist_ok=True)

STYLE = (
    "A warm, quiet, late night storyteller, close to the microphone, like a thoughtful friend "
    "telling you something astonishing. Natural and human, a small smile on dry jokes, gentle in sad parts, "
    "steady easy pace, soft downward endings."
)
VOICE = "Algieba"
MODEL = "gemini-3.8-flash-tts"


def prompt_for(text):
    return "### DIRECTOR'S NOTES\n" + STYLE + "\n\n### TRANSCRIPT\n" + text


def _keys():
    raw = os.environ.get("GEMINI_API_KEYS") or os.environ.get("GEMINI_API_KEY") or ""
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    if not keys:
        raise SystemExit("No GEMINI_API_KEY set: use the fallback voice chain.")
    return keys


_last_use = {}


def _request(url, body, key, timeout=180):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("x-goog-api-key", key)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def list_tts_models():
    key = _keys()[0]
    d = _request(f"{API}/models?pageSize=200", None, key)
    out = []
    for m in d.get("models", []):
        if "tts" in m["name"] and "generateContent" in m.get("supportedGenerationMethods", []):
            out.append(m["name"].split("/", 1)[1])
    return out


def pick_model():
    models = list_tts_models()
    flash = [m for m in models if "flash" in m and "lite" not in m]

    def ver(m):
        parts = m.split("-")
        try:
            return float(parts[1])
        except Exception:
            return 0.0

    flash.sort(key=lambda m: (ver(m), "preview" not in m))
    return flash[-1] if flash else models[-1]


def cache_path(model, voice, text, tag=""):
    h = hashlib.sha256(f"{model}|{voice}|{STYLE}|{text}|{tag}".encode()).hexdigest()[:20]
    return os.path.join(CACHE, f"{voice}_{h}.wav")


def write_wav(path, pcm, rate=24000):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)


def synth(text, voice, model, tag="", min_gap=35.0, max_tries=8):
    """Return path of a cached wav for text. tag lets us request a retake."""
    path = cache_path(model, voice, text, tag)
    if os.path.exists(path):
        return path, False
    keys = _keys()
    body = {
        "contents": [{"parts": [{"text": prompt_for(text)}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "temperature": 1.0,
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }
    url = f"{API}/models/{model}:generateContent"
    tries = 0
    exhausted = set()
    while tries < max_tries:
        # pick the key that has rested longest and is not exhausted for the day
        usable = [i for i in range(len(keys)) if i not in exhausted]
        if not usable:
            raise RuntimeError("All keys exhausted for today")
        i = min(usable, key=lambda j: _last_use.get(j, 0))
        wait = _last_use.get(i, 0) + min_gap - time.time()
        if wait > 0:
            time.sleep(wait)
        _last_use[i] = time.time()
        tries += 1
        try:
            d = _request(url, body, keys[i])
            parts = d["candidates"][0]["content"]["parts"]
            pcm = b"".join(base64.b64decode(p["inlineData"]["data"]) for p in parts if "inlineData" in p)
            if len(pcm) < 24000:
                raise ValueError("audio too short")
            write_wav(path, pcm)
            return path, True
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="ignore")
            delay = 20 * tries
            if e.code == 429:
                if "PerDay" in msg or "per_day" in msg.lower() or "RequestsPerDay" in msg:
                    exhausted.add(i)
                    print(f"  key#{i} daily quota hit", file=sys.stderr)
                    continue
                try:
                    for det in json.loads(msg)["error"].get("details", []):
                        if "retryDelay" in det:
                            delay = float(det["retryDelay"].rstrip("s")) + 2
                except Exception:
                    pass
            print(f"  HTTP {e.code} on key#{i}, retry in {delay:.0f}s: {msg[:160]}", file=sys.stderr)
            time.sleep(delay + random.random())
        except Exception as e:  # network or malformed
            print(f"  error {type(e).__name__}: {str(e)[:120]}, retrying", file=sys.stderr)
            time.sleep(10 * tries)
    raise RuntimeError("TTS failed after retries")


def pick_text_model():
    key = _keys()[0]
    d = _request(f"{API}/models?pageSize=200", None, key)
    names = [m["name"].split("/", 1)[1] for m in d.get("models", [])
             if "generateContent" in m.get("supportedGenerationMethods", [])]
    pref = [n for n in names if n.startswith("gemini") and "flash" in n and not any(
        x in n for x in ("tts", "image", "audio", "live", "lite", "exp", "thinking", "robotics", "computer"))]

    def ver(m):
        try:
            return float(m.split("-")[1])
        except Exception:
            return 0.0
    pref.sort(key=lambda m: (ver(m), "preview" not in m, "latest" not in m))
    return pref[-1] if pref else "gemini-2.5-flash"


def listen(wav_path, prompt, model=None):
    """Ask a multimodal Gemini model to listen to audio (our QA ears)."""
    model = model or pick_text_model()
    with open(wav_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    body = {"contents": [{"parts": [{"inlineData": {"mimeType": "audio/wav", "data": b64}}, {"text": prompt}]}],
            "generationConfig": {"temperature": 0.2}}
    keys = _keys()
    for attempt in range(6):
        k = keys[(attempt + len(keys) - 1) % len(keys)]
        try:
            d = _request(f"{API}/models/{model}:generateContent", body, k)
            return "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"])
        except urllib.error.HTTPError as e:
            print(f"  listen HTTP {e.code}: {e.read().decode(errors='ignore')[:160]}", file=sys.stderr)
            time.sleep(15 * (attempt + 1))
    return ""
