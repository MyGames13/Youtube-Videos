"""Gemini TTS client: structured style header, disk cache, key rotation, rate limits.

API keys are read only from the GEMINI_API_KEY environment variable (one key,
or several separated by commas) and are sent only as an HTTP header. They are
never written to disk or printed; logs refer to keys by index only.
"""
import base64
import hashlib
import json
import os
import struct
import time
import urllib.error
import urllib.request

API = "https://generativelanguage.googleapis.com/v1beta/models"

STYLE_HEADER = (
    "# AUDIO PROFILE: The Building Manager\n"
    "A patient, courteous building manager reading a printed notice aloud to one resident, "
    "standing close to the microphone.\n\n"
    "## THE SCENE\n"
    "A quiet apartment hallway in the evening. Nobody else is around.\n\n"
    "### DIRECTOR'S NOTES\n"
    "Style: calm, dry, deadpan, in a natural speaking voice at a steady, comfortable mid pitch. "
    "Relaxed and close, not tired, not whispering, no vocal fry. Natural and human, slightly warm "
    "underneath. Never acted, never theatrical, never like an announcer.\n"
    "Pacing: even and unhurried. Soft downward endings. Small natural pauses at commas "
    "and a clear pause between sentences.\n"
    "Accent: neutral.\n\n"
    "#### TRANSCRIPT\n"
)

CALIBRATION = "This notice applies to every resident on this floor."
GEN_SEED = 1003
GEN_TEMPERATURE = 0.7
PER_KEY_GAP = 22.0  # free tier allows 3 requests per minute per key and model


class KeyPool:
    def __init__(self):
        raw = os.environ.get("GEMINI_API_KEY", "")
        self.keys = [k.strip() for k in raw.split(",") if k.strip()]
        self.last = [0.0] * len(self.keys)
        self.dead = set()  # (key index, model) pairs out of daily quota
        self.i = 0

    def pick(self, model):
        live = [j for j in range(len(self.keys)) if (j, model) not in self.dead]
        if not live:
            raise RuntimeError("all keys out of daily quota for " + model)
        j = min(live, key=lambda k: self.last[k])
        wait = self.last[j] + PER_KEY_GAP - time.time()
        if wait > 0:
            time.sleep(wait)
        self.last[j] = time.time()
        return j


_pool = None


def pool():
    global _pool
    if _pool is None:
        _pool = KeyPool()
    return _pool


def cache_key(text, voice, model, header=STYLE_HEADER, calib=CALIBRATION):
    h = hashlib.sha256()
    for part in (text, voice, model, header, calib, f"{GEN_SEED}/{GEN_TEMPERATURE}"):
        h.update(part.encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()[:20]


def synth(text, voice, model, cache_dir, take=0, max_retries=8, log=print):
    """Return the path of a wav for STYLE_HEADER + CALIBRATION + text. Cached on disk."""
    os.makedirs(cache_dir, exist_ok=True)
    key = cache_key(text, voice, model)
    path = os.path.join(cache_dir, f"{key}_t{take}.wav")
    if os.path.exists(path):
        return path
    p = pool()
    if not p.keys:
        raise RuntimeError("GEMINI_API_KEY not set")
    prompt = STYLE_HEADER + CALIBRATION + "\n" + text
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "seed": GEN_SEED + take,
            "temperature": GEN_TEMPERATURE,
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }
    delay = 30.0
    for attempt in range(max_retries):
        j = p.pick(model)
        req = urllib.request.Request(
            f"{API}/{model}:generateContent",
            data=json.dumps(body).encode(),
            headers={"x-goog-api-key": p.keys[j], "Content-Type": "application/json"},
        )
        try:
            r = json.load(urllib.request.urlopen(req, timeout=300))
            parts = r["candidates"][0]["content"]["parts"]
            data = next(q["inlineData"] for q in parts if "inlineData" in q)
            raw = base64.b64decode(data["data"])
            if raw[:4] != b"RIFF":
                raw = _pcm_to_wav(raw, 24000)
            with open(path, "wb") as f:
                f.write(raw)
            meta = {"text": text, "voice": voice, "model": model, "take": take, "seed": GEN_SEED + take,
                    "temperature": GEN_TEMPERATURE, "key_index": j,
                    "modelVersion": r.get("modelVersion"), "usage": r.get("usageMetadata")}
            with open(path[:-4] + ".json", "w") as f:
                json.dump(meta, f, indent=1)
            log(f"ok key#{j} {os.path.basename(path)}")
            return path
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")
            if e.code == 429 and "PerDay" in msg:
                p.dead.add((j, model))
                log(f"key#{j} out of daily quota for {model}")
                continue
            log(f"HTTP {e.code} key#{j} attempt {attempt}")
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(delay)
                delay = min(delay * 1.5, 120)
                continue
            raise RuntimeError(f"HTTP {e.code}: {msg[:300]}")
        except (urllib.error.URLError, TimeoutError, KeyError, StopIteration) as e:
            log(f"error key#{j} attempt {attempt}: {type(e).__name__}")
            time.sleep(delay)
    raise RuntimeError("TTS failed after retries")


def _pcm_to_wav(pcm, sr):
    hdr = b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt " + struct.pack(
        "<IHHIIHH", 16, 1, 1, sr, sr * 2, 2, 16) + b"data" + struct.pack("<I", len(pcm))
    return hdr + pcm
