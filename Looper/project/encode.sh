#!/bin/bash
# Final encode: mezzanine picture + mixed audio -> loophole_001_final.mp4 (H.264 High, yuv420p, AAC 128k, faststart, < 100 MB)
set -e
OUT=../output
CRF=${CRF:-18}
for attempt in 1 2 3 4; do
  ffmpeg -y -loglevel error -i out/picture.mp4 -i $OUT/audio_mix.wav -map 0:v:0 -map 1:a:0 \
    -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -r 30 -g 60 -keyint_min 30 -crf $CRF -maxrate 4.5M -bufsize 9M \
    -x264-params "aq-mode=3:aq-strength=0.9:deblock=-1,-1" \
    -c:a aac -b:a 128k -ar 48000 -ac 2 -movflags +faststart -shortest $OUT/loophole_001_final.mp4
  SIZE=$(stat -c %s $OUT/loophole_001_final.mp4)
  echo "crf $CRF size $((SIZE/1000000)) MB"
  if [ $SIZE -gt 95000000 ]; then CRF=$((CRF+1)); else break; fi
done
ffmpeg -loglevel error -i $OUT/loophole_001_final.mp4 -i out/picture.mp4 -lavfi "[0:v][1:v]ssim" -f null - 2>&1 | tail -1 || true
ffmpeg -i $OUT/loophole_001_final.mp4 -i out/picture.mp4 -lavfi "[0:v][1:v]ssim=stats_file=-" -f null - 2>&1 | grep -o "All:[0-9.]*" | tail -1
