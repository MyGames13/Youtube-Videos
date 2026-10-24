#!/usr/bin/env bash
# Render the 1280x720 mezzanine (H.264 CRF 14) as resumable chunks with parallel
# workers (each worker has its own browser, so its own SwiftShader GPU process), then
# join the chunks losslessly. A fix only needs its chunk deleted and this re-run.
# usage: scripts/render_final.sh <outDir> [workers] [chunkFrames]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-out/chunks}
WORKERS=${2:-2}
STEP=${3:-900}
CHROME=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
FRAMES=$(node -e "console.log(require('./src/timeline.json').frames)")
mkdir -p "$OUT"
npx remotion bundle src/index.ts --out-dir "$OUT/bundle" --log=error
worker() {
	local w=$1 i=0 a b f
	for ((a = 0; a < FRAMES; a += STEP)); do
		if ((i % WORKERS == w)); then
			b=$((a + STEP - 1))
			if ((b > FRAMES - 1)); then b=$((FRAMES - 1)); fi
			f=$(printf "%s/chunk_%05d.mp4" "$OUT" "$a")
			if [[ ! -s "$f" ]]; then
				echo "worker $w: frames $a-$b"
				npx remotion render "$OUT/bundle" Notice003 "$f.part.mp4" --frames="$a-$b" \
					--browser-executable="$CHROME" --gl=swangle --codec=h264 --crf=14 \
					--pixel-format=yuv420p --concurrency=1 --log=error
				mv "$f.part.mp4" "$f"
				echo "worker $w: done $a-$b"
			fi
		fi
		i=$((i + 1))
	done
}
for ((w = 0; w < WORKERS; w++)); do worker "$w" & done
wait
(cd "$OUT" && ls chunk_*.mp4 | sed "s/^/file '/; s/$/'/" > list.txt)
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/list.txt" -c copy "$OUT/../notice003_mezz.mp4"
echo "MEZZANINE READY: $OUT/../notice003_mezz.mp4"
