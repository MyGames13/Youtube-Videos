"""Voice metrics for the consistency gate (section 7.4)."""
import sys, json
import numpy as np, soundfile as sf, librosa, pyloudnorm as pyln

def speech_mask(y, sr, thr_db=-38, hop=0.01):
    h = int(sr*hop)
    rms = librosa.feature.rms(y=y, frame_length=h*3, hop_length=h)[0]
    db = 20*np.log10(rms+1e-9)
    ref = np.percentile(db, 95)
    return db > ref + thr_db + 10, h

def segments(y, sr, min_sil=0.25, thr=-30):
    m, h = speech_mask(y, sr, thr)
    segs=[]; start=None; sil=0
    n=len(m); minf=int(min_sil/0.01)
    for i,v in enumerate(m):
        if v:
            if start is None: start=i
            last=i
        elif start is not None and i-last>=minf:
            segs.append((start*h/sr, (last+1)*h/sr)); start=None
    if start is not None: segs.append((start*h/sr,(last+1)*h/sr))
    return [s for s in segs if s[1]-s[0]>0.08]

def metrics(path, words=None):
    y, sr = sf.read(path)
    if y.ndim>1: y=y.mean(1)
    dur=len(y)/sr
    segs=segments(y,sr)
    active=sum(b-a for a,b in segs)
    f0,vf,_=librosa.pyin(y,fmin=60,fmax=300,sr=sr,frame_length=1024)
    f0=f0[~np.isnan(f0)]
    cent=librosa.feature.spectral_centroid(y=y,sr=sr)[0]
    m,_=speech_mask(y,sr)
    cent=np.median(cent[:len(m)][m[:len(cent)]]) if m.any() else np.median(cent)
    flat=librosa.feature.spectral_flatness(y=y)[0]
    lufs=pyln.Meter(sr).integrated_loudness(y)
    out=dict(dur=round(dur,2), active=round(active,2), nseg=len(segs),
             f0_med=round(float(np.median(f0)),1) if len(f0) else 0,
             f0_range=round(float(np.percentile(f0,95)-np.percentile(f0,5)),1) if len(f0) else 0,
             centroid=round(float(cent)), flat95=round(float(np.percentile(flat,95)),3),
             lufs=round(lufs,1), peak=round(float(np.abs(y).max()),3),
             maxgap=round(max([segs[i+1][0]-segs[i][1] for i in range(len(segs)-1)] or [0]),2))
    if words: out['wpm_active']=round(words/active*60,1); out['wpm_total']=round(words/dur*60,1)
    return out, segs

if __name__=='__main__':
    for p in sys.argv[1:]:
        o,s=metrics(p, 42)
        print(p.split('/')[-1], json.dumps(o))
        print('   segs', [(round(a,2),round(b,2)) for a,b in s][:30])
