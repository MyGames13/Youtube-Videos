"""Forced alignment of a known transcript with pocketsphinx (bundled en-us model)."""
import re
import numpy as np
import soundfile as sf
import librosa
from pocketsphinx import Decoder

# pronunciations for script words missing from the bundled dictionary
EXTRA = {"unbothered": "AH N B AA DH ER D"}


def norm_words(text):
    t = text.lower().replace("...", " ").replace("'", "")
    t = re.sub(r"[^a-z ]+", " ", t)
    return [w for w in t.split() if w]


def align(path, text):
    x, sr = sf.read(path)
    if x.ndim > 1:
        x = x.mean(axis=1)
    x = librosa.resample(x, orig_sr=sr, target_sr=16000)
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()
    words = norm_words(text)
    d = Decoder(samprate=16000, bestpath=False, loglevel="FATAL")
    for w, ph in EXTRA.items():
        if w in words:
            d.add_word(w, ph, True)
    d.set_align_text(" ".join(words))
    d.start_utt()
    d.process_raw(pcm, full_utt=True)
    d.end_utt()
    d.set_alignment()
    d.start_utt()
    d.process_raw(pcm, full_utt=True)
    d.end_utt()
    out = []
    for seg in d.get_alignment():
        if seg.name in ("<sil>", "(NULL)", "<s>", "</s>"):
            continue
        out.append((seg.name, seg.start / 100.0, (seg.start + seg.duration) / 100.0, seg.score))
    return out
