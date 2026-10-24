#!/bin/bash
# Bonus: vertical shorts (720x1280) recomposed from the same timeline, audio cut from the final mix.
set -e
HS=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
OUT=../output
read HOOK_TO REV_FROM REV_TO ENDCARD <<< $(python3 -c "
import json;T=json.load(open('src/timeline.json'));L={l['id']:l for l in T['lines']}
print(round(L['b2.5']['start']-0.1,2), round(L['b6b.4']['end']+0.55,2), round(L['b8.6']['start']-0.1,2), [s for s in T['shots'] if s['id']=='endcard'][0]['start'])")
mkdir -p out/shorts
for id in ShortHook ShortReveal; do
  [ -s out/shorts/$id.mp4 ] || npx remotion render src/index.ts $id out/shorts/$id.mp4 --gl=swangle --browser-executable=$HS --concurrency=4 --codec=h264 --crf=14 --muted --timeout=120000 > out/shorts/$id.log 2>&1
done
# end card chime from the main mix
ffmpeg -y -loglevel error -ss $ENDCARD -t 2.3 -i $OUT/audio_mix.wav -af "afade=t=in:d=0.05" out/shorts/chime.wav
mk() { # $1 id $2 from $3 to $4 out
  D=$(python3 -c "print(round($3-$2,3))")
  ffmpeg -y -loglevel error -ss $2 -t $D -i $OUT/audio_mix.wav -af "afade=t=in:d=0.25,afade=t=out:st=$(python3 -c "print(round($D-0.6,3))"):d=0.6" out/shorts/$1_a.wav
  ffmpeg -y -loglevel error -i out/shorts/$1_a.wav -i out/shorts/chime.wav -filter_complex "[1:a]adelay=$(python3 -c "print(int($D*1000))")|$(python3 -c "print(int($D*1000))")[c];[0:a][c]amix=inputs=2:normalize=0,apad=pad_dur=3[a]" -map "[a]" -t $(python3 -c "print(round($D+2.6,3))") out/shorts/$1_mix.wav
  ffmpeg -y -loglevel error -i out/shorts/$1.mp4 -i out/shorts/$1_mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -crf 20 -maxrate 3.5M -bufsize 7M -c:a aac -b:a 128k -movflags +faststart -shortest $4
  echo "$4 $(du -m $4 | cut -f1) MB"
}
mk ShortHook 0 $HOOK_TO $OUT/short_hook.mp4
mk ShortReveal $REV_FROM $REV_TO $OUT/short_reveal.mp4
