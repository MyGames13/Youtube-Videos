#!/bin/bash
# Render the picture in segments (each logged), then join them losslessly.
HS=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
FRAMES=$(python3 -c "import json;print(json.load(open('src/timeline.json'))['frames'])")
RANGES=${RANGES:-"0-1499 1500-2999 3000-4199 4200-$((FRAMES-1))"}
mkdir -p out/seg
i=0
for r in $RANGES; do
  f=out/seg/seg_$i.mp4
  if [ ! -s "$f" ]; then
    npx remotion render src/index.ts Loophole001 "$f" --frames=$r --gl=swangle --browser-executable=$HS --concurrency=4 --codec=h264 --crf=12 --pixel-format=yuv420p --muted --timeout=120000 > out/seg/seg_$i.log 2>&1 || { echo "segment $i ($r) failed"; grep -i -E "error|threw" out/seg/seg_$i.log | head -5; }
  fi
  echo "file 'seg_$i.mp4'" >> out/seg/list.tmp
  i=$((i+1))
done
mv out/seg/list.tmp out/seg/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/seg/list.txt -c copy out/picture.mp4 && ffprobe -v error -show_entries format=duration -of csv=p=0 out/picture.mp4
