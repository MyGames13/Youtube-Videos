#!/bin/bash
# Re-render only patched frame ranges, then splice them into the mezzanine (frame accurate).
set -e
HS=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
RANGES=${RANGES:-"985-1122 2230-2356 3175-3526 4652-4883"}
mkdir -p out/fix
i=0
for r in $RANGES; do
  [ -s out/fix/r_$i.mp4 ] || npx remotion render src/index.ts Loophole001 out/fix/r_$i.mp4 --frames=$r --gl=swangle --browser-executable=$HS --concurrency=4 --codec=h264 --crf=12 --pixel-format=yuv420p --muted --timeout=120000 > out/fix/r_$i.log 2>&1 || { echo "range $r failed"; exit 1; }
  i=$((i+1))
done
python3 - <<'PY'
import os, subprocess
R=os.environ.get('RANGES','985-1122 2230-2356 3175-3526 4652-4883').split()
total=int(subprocess.run(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames','-of','csv=p=0','out/picture.mp4'],capture_output=True,text=True).stdout.strip().split(',')[0])
parts=[]; inputs=['-i','out/picture.mp4']; f=[]; pos=0
for k,r in enumerate(R):
    a,b=map(int,r.split('-'))
    f.append(f"[0:v]trim=start_frame={pos}:end_frame={a},setpts=PTS-STARTPTS[m{k}]"); parts.append(f"[m{k}]")
    inputs+=['-i',f'out/fix/r_{k}.mp4']; parts.append(f"[{k+1}:v]"); pos=b+1
f.append(f"[0:v]trim=start_frame={pos}:end_frame={total},setpts=PTS-STARTPTS[mend]"); parts.append("[mend]")
fc=';'.join(f)+';'+''.join(parts)+f"concat=n={len(parts)}:v=1:a=0[v]"
subprocess.run(['ffmpeg','-y','-loglevel','error',*inputs,'-filter_complex',fc,'-map','[v]','-c:v','libx264','-preset','medium','-crf','10','-pix_fmt','yuv420p','-r','30','out/picture_fixed.mp4'],check=True)
n=int(subprocess.run(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames','-of','csv=p=0','out/picture_fixed.mp4'],capture_output=True,text=True).stdout.strip().split(',')[0])
print('frames', total, '->', n)
assert n==total
os.replace('out/picture.mp4','out/picture_v1.mp4'); os.replace('out/picture_fixed.mp4','out/picture.mp4')
PY
