#!/usr/bin/env bash
# Final delivery encode: mezzanine + mastered mix -> MP4 under 100 MB.
# libx264 slow, High profile, yuv420p, 30 fps, keyframe every 2 s, CRF with a bitrate
# cap, AAC 128 kbps 48 kHz, faststart. Then SSIM against the mezzanine.
# usage: scripts/encode_final.sh <mezz.mp4> <mix.wav> <out.mp4> [crf]
set -euo pipefail
MEZZ=$1
MIX=$2
OUT=$3
CRF=${4:-20}
ffmpeg -y -loglevel error -i "$MEZZ" -i "$MIX" -map 0:v:0 -map 1:a:0 \
	-c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -r 30 -g 60 -keyint_min 60 \
	-crf "$CRF" -maxrate 2.2M -bufsize 4.4M \
	-c:a aac -b:a 128k -ar 48000 -movflags +faststart -shortest "$OUT"
ls -l "$OUT" | awk '{printf "size %.1f MB\n", $5 / 1048576}'
ffmpeg -hide_banner -nostats -i "$OUT" -i "$MEZZ" -lavfi "[0:v][1:v]ssim" -f null - 2>&1 | grep -o "All:[0-9.]*"
